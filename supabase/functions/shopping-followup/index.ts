/**
 * Supabase Edge Function: shopping-followup
 *
 * Handles follow-up questions in the Shopping Assistant chat.
 * Uses Amazon Bedrock Nova 2 Lite (text) to respond to user questions with context
 * from the conversation history and inventory data.
 * Uses Amazon Nova Multimodal Embeddings for intent detection and semantic search.
 *
 * @requires AWS_ACCESS_KEY_ID environment variable
 * @requires AWS_SECRET_ACCESS_KEY environment variable
 * @requires AWS_REGION environment variable
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from 'npm:@aws-sdk/client-bedrock-runtime';
import { corsHeaders } from '../_shared/cors.ts';

// Types for conversation messages
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image' | 'analysis';
  imageUrl?: string;
  analysisData?: {
    detected_item?: {
      name: string;
      category_suggestion: string | null;
    } | null;
    similar_items?: Array<{
      name: string | null;
      similarity: number;
    }>;
  };
}

interface ShoppingFollowupRequest {
  message: string;
  conversation_history: ConversationMessage[];
}

interface ShoppingFollowupResponse {
  response: string;
  responded_at: string;
  usage: {
    text_count: number;
    text_limit: number;
  };
}

interface InventoryItem {
  id: string;
  name: string;
  category_name: string | null;
  location_path: string | null;
  quantity: number;
  created_at: string;
  tags: string[];
}

type UserIntent = 'declutter' | 'organize' | 'find' | 'compare' | 'general';

interface RelevantItem {
  id: string;
  name: string;
  category_name: string | null;
  location_path: string | null;
  reason: string;
  similarity?: number;
}

interface InventorySummary {
  total_items: number;
  items_by_category: Record<string, number>;
  recent_items: Array<{ name: string; category: string; added: string }>;
  locations_used: string[];
}

interface ApiError {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

// Rate limits
const DAILY_TEXT_LIMIT = 50;

const INTENT_EXAMPLES: Record<UserIntent, string[]> = {
  declutter: [
    'what can I get rid of',
    'what should I throw away',
    'help me clear out stuff',
    'what can I donate or sell',
    'I have too much stuff what should go',
  ],
  find: [
    'where is my passport',
    'do I have a blue shirt',
    'can you find my charger',
    'looking for my headphones',
    'can you locate my keys',
  ],
  organize: [
    'help me organize my closet',
    'I need to tidy up my stuff',
    'what needs to be put away',
    'how should I arrange my items',
  ],
  compare: [
    'do I have something similar to this',
    'is this like what I already own',
    'would this be a duplicate',
    'do I already have one of these',
  ],
  general: [
    'tell me about my inventory',
    'what do I have',
    'give me a summary',
    'show me what is in my inventory',
  ],
};

const INTENT_KEYWORDS: Record<UserIntent, string[]> = {
  declutter: ['drop', 'donate', 'sell', 'get rid of', 'throw away', 'declutter', 'remove', 'toss', 'discard'],
  find: [
    'where is',
    'where are',
    'do i have',
    'find my',
    'locate my',
    'looking for',
    'search for',
    'got any',
    'have any',
  ],
  organize: ['organize', 'sort', 'arrange', 'tidy', 'clean up', 'put away', 'need space'],
  compare: ['similar', 'like this', 'compared to', 'already have something like'],
  general: [],
};

// Module-level cache for intent embeddings
let intentEmbeddingsCache: Map<string, number[][]> | null = null;

function detectIntent(message: string): UserIntent {
  const lowerMessage = message.toLowerCase();

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return intent as UserIntent;
    }
  }

  return 'general';
}

/**
 * Generate a lightweight embedding (dimension 256) using Amazon Nova Multimodal
 * Embeddings. Used for intent detection where a small, fast embedding is sufficient.
 */
async function generateMessageEmbedding(
  text: string,
  client: BedrockRuntimeClient
): Promise<number[]> {
  const payload = {
    taskType: 'SINGLE_EMBEDDING',
    singleEmbeddingParams: {
      embeddingPurpose: 'GENERIC_RETRIEVAL',
      embeddingDimension: 256,
      text: { truncationMode: 'END', value: text },
    },
  };

  const command = new InvokeModelCommand({
    modelId: 'amazon.nova-2-multimodal-embeddings-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  return body.embeddings[0].embedding as number[];
}

function computeCosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);

  for (let i = 0; i < length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getIntentEmbeddings(
  client: BedrockRuntimeClient
): Promise<Map<string, number[][]>> {
  if (intentEmbeddingsCache) {
    return intentEmbeddingsCache;
  }

  const cache = new Map<string, number[][]>();

  for (const [intent, examples] of Object.entries(INTENT_EXAMPLES)) {
    const embeddings: number[][] = [];
    for (const example of examples) {
      const embedding = await generateMessageEmbedding(example, client);
      embeddings.push(embedding);
    }
    cache.set(intent, embeddings);
  }

  intentEmbeddingsCache = cache;
  return cache;
}

async function detectIntentByEmbedding(
  message: string,
  client: BedrockRuntimeClient
): Promise<{ intent: UserIntent; confidence: number }> {
  const SIMILARITY_THRESHOLD = 0.7;

  try {
    const messageEmbedding = await generateMessageEmbedding(message, client);
    const intentEmbeddings = await getIntentEmbeddings(client);

    let bestIntent: UserIntent = 'general';
    let bestScore = 0;

    for (const [intent, exampleEmbeddings] of intentEmbeddings.entries()) {
      if (exampleEmbeddings.length === 0) {
        continue;
      }
      const similarities = exampleEmbeddings.map(exampleEmbedding =>
        computeCosineSimilarity(messageEmbedding, exampleEmbedding)
      );
      const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;

      if (avgSimilarity > bestScore) {
        bestScore = avgSimilarity;
        bestIntent = intent as UserIntent;
      }
    }

    if (bestScore < SIMILARITY_THRESHOLD) {
      return { intent: 'general', confidence: bestScore };
    }

    return { intent: bestIntent, confidence: bestScore };
  } catch (error) {
    console.error('Embedding intent detection failed:', error);
    return { intent: detectIntent(message), confidence: 0.5 };
  }
}

function normalizeSearchQuery(message: string): string {
  const pattern = INTENT_KEYWORDS.find.join('|');
  return message
    .toLowerCase()
    .replace(new RegExp(pattern, 'g'), '')
    .replace(/[?!.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addRelevantCandidate(
  candidates: Map<string, RelevantItem>,
  item: InventoryItem,
  reason: string,
  similarity?: number
): void {
  const existing = candidates.get(item.id);
  if (existing) {
    if (!existing.reason.includes(reason)) {
      existing.reason = `${existing.reason}; ${reason}`;
    }
    if (similarity !== undefined) {
      existing.similarity = similarity;
    }
    return;
  }

  candidates.set(item.id, {
    id: item.id,
    name: item.name,
    category_name: item.category_name,
    location_path: item.location_path,
    reason,
    similarity,
  });
}

function fetchDeclutterCandidates(items: InventoryItem[]): RelevantItem[] {
  const candidates = new Map<string, RelevantItem>();

  const oldestItems = [...items].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  oldestItems.slice(0, 10).forEach(item => {
    addRelevantCandidate(candidates, item, 'Oldest item in your inventory');
  });

  items.filter(item => (item.quantity ?? 0) > 1).slice(0, 10).forEach(item => {
    addRelevantCandidate(candidates, item, 'Multiple quantities of this item');
  });

  items.filter(item => !item.location_path || item.location_path.trim().length === 0)
    .slice(0, 10)
    .forEach(item => {
      addRelevantCandidate(candidates, item, 'No storage location set');
    });

  return Array.from(candidates.values());
}

function fetchOrganizeCandidates(items: InventoryItem[]): RelevantItem[] {
  const candidates = new Map<string, RelevantItem>();

  items.filter(item => !item.location_path || item.location_path.trim().length === 0)
    .slice(0, 10)
    .forEach(item => {
      addRelevantCandidate(candidates, item, 'No storage location set');
    });

  const counts: Record<string, number> = {};
  for (const item of items) {
    const category = normalizeCategoryName(item.category_name);
    counts[category] = (counts[category] || 0) + 1;
  }

  const topCategories = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  for (const [category, count] of topCategories) {
    items.filter(item => normalizeCategoryName(item.category_name) === category)
      .slice(0, 3)
      .forEach(item => {
        addRelevantCandidate(candidates, item, `Category "${category}" has many items (${count})`);
      });
  }

  return Array.from(candidates.values());
}

/**
 * Generate a full-dimension embedding (dimension 1024) using Amazon Nova Multimodal
 * Embeddings. Used for item search to match against stored pgvector embeddings.
 */
async function generateQueryEmbedding(
  text: string,
  client: BedrockRuntimeClient
): Promise<number[]> {
  const payload = {
    taskType: 'SINGLE_EMBEDDING',
    singleEmbeddingParams: {
      embeddingPurpose: 'GENERIC_RETRIEVAL',
      embeddingDimension: 1024,
      text: { truncationMode: 'END', value: text },
    },
  };

  const command = new InvokeModelCommand({
    modelId: 'amazon.nova-2-multimodal-embeddings-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  return body.embeddings[0].embedding as number[];
}

async function fetchSearchResults(
  message: string,
  userId: string,
  inventoryItems: InventoryItem[],
  supabaseUrl: string,
  supabaseServiceKey: string,
  client: BedrockRuntimeClient
): Promise<RelevantItem[]> {
  const searchQuery = normalizeSearchQuery(message);
  if (!searchQuery) {
    return [];
  }

  const embedding = await generateQueryEmbedding(searchQuery, client);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const embeddingStr = `[${embedding.join(',')}]`;

  const { data, error } = await supabase.rpc('search_items_by_embedding', {
    query_embedding: embeddingStr,
    match_threshold: 0.5,
    match_count: 5,
    search_user_id: userId,
  });

  if (error || !data) {
    console.error('Error searching by embedding:', error);
    return [];
  }

  return (data as Array<{ id: string; name?: string | null; similarity: number }>).map(item => {
    const inventoryItem = inventoryItems.find(entry => entry.id === item.id);
    return {
      id: item.id,
      name: item.name?.trim() || inventoryItem?.name || 'Unnamed item',
      category_name: inventoryItem?.category_name ?? null,
      location_path: inventoryItem?.location_path ?? null,
      reason: `${Math.round(item.similarity * 100)}% match`,
      similarity: item.similarity,
    };
  });
}

async function fetchSimilarItems(
  message: string,
  userId: string,
  inventoryItems: InventoryItem[],
  supabaseUrl: string,
  supabaseServiceKey: string,
  client: BedrockRuntimeClient
): Promise<RelevantItem[]> {
  const query = message.trim();
  if (!query) {
    return [];
  }

  const embedding = await generateQueryEmbedding(query, client);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const embeddingStr = `[${embedding.join(',')}]`;

  const { data, error } = await supabase.rpc('search_items_by_embedding', {
    query_embedding: embeddingStr,
    match_threshold: 0.5,
    match_count: 5,
    search_user_id: userId,
  });

  if (error || !data) {
    console.error('Error fetching similar items:', error);
    return [];
  }

  return (data as Array<{ id: string; name?: string | null; similarity: number }>).map(item => {
    const inventoryItem = inventoryItems.find(entry => entry.id === item.id);
    return {
      id: item.id,
      name: item.name?.trim() || inventoryItem?.name || 'Unnamed item',
      category_name: inventoryItem?.category_name ?? null,
      location_path: inventoryItem?.location_path ?? null,
      reason: `${Math.round(item.similarity * 100)}% match`,
      similarity: item.similarity,
    };
  });
}

async function fetchRelevantItems(
  intent: UserIntent,
  message: string,
  userId: string,
  inventoryItems: InventoryItem[],
  supabaseUrl: string,
  supabaseServiceKey: string,
  client: BedrockRuntimeClient
): Promise<RelevantItem[]> {
  switch (intent) {
    case 'declutter':
      return fetchDeclutterCandidates(inventoryItems);
    case 'find':
      return await fetchSearchResults(
        message,
        userId,
        inventoryItems,
        supabaseUrl,
        supabaseServiceKey,
        client
      );
    case 'organize':
      return fetchOrganizeCandidates(inventoryItems);
    case 'compare':
      return await fetchSimilarItems(
        message,
        userId,
        inventoryItems,
        supabaseUrl,
        supabaseServiceKey,
        client
      );
    default:
      return [];
  }
}

function formatRelevantItems(intent: UserIntent, items: RelevantItem[]): string {
  if (items.length === 0) {
    return '';
  }

  const headers: Record<UserIntent, string> = {
    declutter: 'Items you might consider removing:',
    find: 'Found these items matching your search:',
    organize: 'Items that need organization:',
    compare: 'Similar items you already have:',
    general: '',
  };

  const header = headers[intent];
  const itemList = items
    .map(item => {
      const location = item.location_path ? ` (in ${item.location_path})` : '';
      return `- ${item.name}${location}: ${item.reason}`;
    })
    .join('\n');

  return header ? `\n${header}\n${itemList}` : '';
}

/**
 * Build conversation context from history
 */
function buildConversationContext(
  history: ConversationMessage[],
  inventorySummary: InventorySummary,
  inventorySampleItems: string[],
  relevantItemsBlock: string,
  relevantItems: RelevantItem[]
): string {
  const contextParts: string[] = [];
  contextParts.push(buildInventoryContext(inventorySummary, inventorySampleItems));

  if (history.length === 0) {
    contextParts.push('No previous conversation.');
    return contextParts.join('\n');
  }

  for (const msg of history.slice(-10)) { // Last 10 messages for context
    if (msg.type === 'image') {
      contextParts.push(`[User sent a photo]`);
    } else if (msg.type === 'analysis' && msg.analysisData) {
      const data = msg.analysisData;
      if (data.detected_item) {
        contextParts.push(`[Assistant analyzed: "${data.detected_item.name}" (${data.detected_item.category_suggestion || 'uncategorized'})]`);
        if (data.similar_items && data.similar_items.length > 0) {
          const matches = data.similar_items
            .map(item => `"${item.name || 'unnamed'}" (${Math.round(item.similarity * 100)}% match)`)
            .join(', ');
          contextParts.push(`[Found similar items in inventory: ${matches}]`);
        } else {
          contextParts.push(`[No similar items found in inventory]`);
        }
      }
    } else if (msg.type === 'text') {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      contextParts.push(`${role}: ${msg.content}`);
    }
  }

  if (relevantItemsBlock) {
    contextParts.push(relevantItemsBlock);
  }

  if (relevantItems.length > 0) {
    contextParts.push(`Relevant items (structured): ${JSON.stringify(relevantItems)}`);
  }

  return contextParts.join('\n');
}

function normalizeCategoryName(categoryName: string | null | undefined): string {
  if (!categoryName) {
    return 'Uncategorized';
  }
  const trimmed = categoryName.trim();
  return trimmed.length > 0 ? trimmed : 'Uncategorized';
}

function normalizeLocationPath(locationPath: string | null | undefined): string {
  if (!locationPath) {
    return 'Unknown location';
  }
  const trimmed = locationPath.trim();
  return trimmed.length > 0 ? trimmed : 'Unknown location';
}

function buildInventoryContext(
  summary: InventorySummary,
  sampleItems: string[]
): string {
  const categories = Object.entries(summary.items_by_category)
    .map(([category, count]) => `${category}: ${count}`)
    .join(', ');
  const recentItems = summary.recent_items.length > 0
    ? summary.recent_items
      .map(item => `${item.name} (${item.category}) on ${item.added}`)
      .join('; ')
    : 'None';
  const locations = summary.locations_used.length > 0
    ? summary.locations_used.join(', ')
    : 'None';
  const sampleList = sampleItems.length > 0
    ? sampleItems.join('\n')
    : 'No sample items available.';

  return `You have access to the user's home inventory:
- Total items: ${summary.total_items}
- By category: ${categories || 'None'}
- Recent additions: ${recentItems}
- Storage locations: ${locations}

Sample items from their inventory:
${sampleList}

Use this data to give personalized advice about their belongings.
When they ask about what they have, refer to this inventory data.`;
}

function buildInventorySampleItems(items: InventoryItem[]): string[] {
  return items.slice(0, 20).map(item => {
    const category = normalizeCategoryName(item.category_name);
    const location = normalizeLocationPath(item.location_path);
    return `- ${item.name} (${category}) in ${location}`;
  });
}

function buildInventorySummary(items: InventoryItem[]): InventorySummary {
  const itemsByCategory: Record<string, number> = {};
  const locationsUsed: string[] = [];
  const locationSet = new Set<string>();

  for (const item of items) {
    const category = normalizeCategoryName(item.category_name);
    itemsByCategory[category] = (itemsByCategory[category] || 0) + 1;

    const location = normalizeLocationPath(item.location_path);
    if (!locationSet.has(location)) {
      locationSet.add(location);
      locationsUsed.push(location);
    }
  }

  const recentItems = items.slice(0, 10).map(item => ({
    name: item.name,
    category: normalizeCategoryName(item.category_name),
    added: item.created_at,
  }));

  return {
    total_items: items.length,
    items_by_category: itemsByCategory,
    recent_items: recentItems,
    locations_used: locationsUsed,
  };
}

function buildInventoryDirectResponse(
  summary: InventorySummary,
  sampleItems: string[]
): string {
  if (summary.total_items === 0) {
    return 'Your inventory is empty.';
  }

  const categoryList = Object.entries(summary.items_by_category)
    .map(([category, count]) => `${category} (${count})`)
    .join(', ');
  const recentItems = summary.recent_items.length > 0
    ? summary.recent_items
      .map(item => `${item.name} (${item.category})`)
      .join(', ')
    : 'None';
  const locations = summary.locations_used.length > 0
    ? summary.locations_used.join(', ')
    : 'None';
  const sampleList = sampleItems.length > 0
    ? ` Sample items: ${sampleItems.join(' ')}`
    : '';

  return `You have ${summary.total_items} items. Categories: ${categoryList || 'None'}. Recent additions: ${recentItems}. Locations used: ${locations}.${sampleList}`;
}

async function fetchUserInventory(
  userId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<InventoryItem[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('items')
    .select(`
      id,
      name,
      quantity,
      created_at,
      tags,
      categories(name),
      locations(path)
    `)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching inventory items:', error);
    return [];
  }

  type RawItem = {
    id: string;
    name: string | null;
    quantity: number | null;
    created_at: string;
    tags: string[] | null;
    categories?: { name: string | null } | Array<{ name: string | null }> | null;
    locations?: { path: string | null } | Array<{ path: string | null }> | null;
  };

  return (data as RawItem[] | null || []).map(item => {
    const category =
      Array.isArray(item.categories)
        ? item.categories[0]?.name ?? null
        : item.categories?.name ?? null;
    const location =
      Array.isArray(item.locations)
        ? item.locations[0]?.path ?? null
        : item.locations?.path ?? null;

    return {
      id: item.id,
      name: item.name?.trim() || 'Unnamed item',
      category_name: category,
      location_path: location,
      quantity: item.quantity ?? 0,
      created_at: item.created_at,
      tags: Array.isArray(item.tags) ? item.tags : [],
    };
  });
}

/**
 * Generate a contextual response using Amazon Bedrock Nova 2 Lite via the
 * Converse API. The system prompt and user prompt are sent as separate fields
 * so Nova can apply its system-prompt optimisation path.
 */
async function generateFollowupResponse(
  userMessage: string,
  conversationContext: string,
  inventorySummary: InventorySummary,
  inventorySampleItems: string[],
  intent: UserIntent,
  relevantItemsBlock: string,
  client: BedrockRuntimeClient
): Promise<string> {
  const categories = Object.entries(inventorySummary.items_by_category)
    .map(([category, count]) => `${category}: ${count}`)
    .join(', ');
  const recentItems = inventorySummary.recent_items.length > 0
    ? inventorySummary.recent_items
      .map(item => `${item.name} (${item.category}) on ${item.added}`)
      .join('; ')
    : 'None';
  const locations = inventorySummary.locations_used.length > 0
    ? inventorySummary.locations_used.join(', ')
    : 'None';
  const sampleList = inventorySampleItems.length > 0
    ? inventorySampleItems.join('\n')
    : 'No sample items available.';

  const systemPrompt = `You are a friendly shopping assistant helping users decide whether to buy items.
You have access to the user's home inventory and can search for similar items they already own.

You have access to the user's home inventory:
- Total items: ${inventorySummary.total_items}
- By category: ${categories || 'None'}
- Recent additions: ${recentItems}
- Storage locations: ${locations}

Sample items from their inventory:
${sampleList}

Use this data to give personalized advice about their belongings.
When they ask about what they have, refer to this inventory data.

Intent guidance:
- Declutter: suggest oldest items, duplicates (quantity > 1), and items with no location.
- Find: answer with item names and locations if found.
- Organize: highlight items missing locations and crowded categories.
- Compare: point out similar items the user already owns.
- If no relevant items exist, respond with: "I couldn't find anything matching that."

Your role:
- Answer follow-up questions about the items being discussed
- Provide helpful shopping advice based on what the user already owns
- Be concise but helpful (2-4 sentences typically)
- If asked about something you don't know, suggest the user send a photo for analysis

Remember:
- You cannot browse the internet or check prices
- You can only see items the user has photographed and analyzed
- Stay focused on helping with shopping decisions`;

  const userPrompt = `Previous conversation:
${conversationContext}

Detected intent: ${intent}

Relevant items:
${relevantItemsBlock || 'None'}

User's new question: ${userMessage}

Provide a helpful, concise response.`;

  const command = new ConverseCommand({
    modelId: 'us.amazon.nova-2-lite-v1:0',
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: 'user',
        content: [{ text: userPrompt }],
      },
    ],
    inferenceConfig: { temperature: 0.7, maxTokens: 300 },
  });

  const response = await client.send(command);
  const content = response.output?.message?.content?.[0]?.text?.trim();

  if (!content) {
    throw new Error('No response content from Nova 2 Lite');
  }

  return content;
}

/**
 * Get or create daily text usage record for user
 */
async function getDailyTextUsage(
  userId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ text_count: number; date: string }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Try to get existing usage record
  const { data: existing } = await supabase
    .from('shopping_usage')
    .select('text_count')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .single();

  if (existing) {
    return { text_count: existing.text_count, date: today };
  }

  // Create new usage record if doesn't exist
  const { data: created, error } = await supabase
    .from('shopping_usage')
    .insert({ user_id: userId, usage_date: today, photo_count: 0, text_count: 0 })
    .select('text_count')
    .single();

  if (error) {
    // Might fail due to race condition, try to get again
    const { data: retry } = await supabase
      .from('shopping_usage')
      .select('text_count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    if (retry) {
      return { text_count: retry.text_count, date: today };
    }

    console.error('Error getting/creating usage:', error);
    return { text_count: 0, date: today };
  }

  return { text_count: created.text_count, date: today };
}

/**
 * Increment text usage count
 */
async function incrementTextUsage(
  userId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const today = new Date().toISOString().split('T')[0];

  await supabase.rpc('increment_shopping_text_usage', {
    p_user_id: userId,
    p_date: today,
  });
}

/**
 * Validate Supabase auth token
 */
async function validateAuth(
  authHeader: string | null,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Auth validation failed: Missing or invalid Authorization header');
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.error('Auth validation failed:', error?.message || 'No user returned');
    return null;
  }

  return { userId: user.id };
}

/**
 * Main handler for the Edge Function
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const awsRegion = Deno.env.get('AWS_REGION');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!awsAccessKeyId || !awsSecretAccessKey || !awsRegion) {
      const error: ApiError = {
        error: {
          message: 'AWS credentials not configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION required)',
          code: 'CONFIGURATION_ERROR',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      const error: ApiError = {
        error: {
          message: 'Supabase configuration missing',
          code: 'CONFIGURATION_ERROR',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a single BedrockRuntimeClient shared across all AI calls
    const bedrockClient = new BedrockRuntimeClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });

    // Validate auth token
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader, 'starts with Bearer:', authHeader?.startsWith('Bearer '));
    const auth = await validateAuth(authHeader, supabaseUrl, supabaseAnonKey);
    console.log('Auth result:', auth ? 'success' : 'failed');

    if (!auth) {
      const error: ApiError = {
        error: {
          message: 'Invalid or missing authentication token',
          code: 'UNAUTHORIZED',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const usage = await getDailyTextUsage(auth.userId, supabaseUrl, supabaseServiceKey);

    if (usage.text_count >= DAILY_TEXT_LIMIT) {
      const error: ApiError = {
        error: {
          message: "You've reached today's question limit. Try again tomorrow!",
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            text_count: usage.text_count,
            text_limit: DAILY_TEXT_LIMIT,
          },
        },
      };
      return new Response(JSON.stringify(error), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    let body: ShoppingFollowupRequest;
    try {
      body = await req.json();
    } catch {
      const error: ApiError = {
        error: {
          message: 'Invalid JSON in request body',
          code: 'INVALID_REQUEST',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate request
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      const error: ApiError = {
        error: {
          message: 'message is required and must be a non-empty string',
          code: 'INVALID_REQUEST',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment usage count before API call
    await incrementTextUsage(auth.userId, supabaseUrl, supabaseServiceKey);
    const newTextCount = usage.text_count + 1;

    // Fetch inventory and build summary
    const inventoryItems = await fetchUserInventory(auth.userId, supabaseUrl, supabaseServiceKey);
    const inventorySummary = buildInventorySummary(inventoryItems);
    const inventorySampleItems = buildInventorySampleItems(inventoryItems);
    const { intent, confidence } = await detectIntentByEmbedding(body.message, bedrockClient);
    console.log(`Detected intent: ${intent} (confidence: ${confidence.toFixed(2)})`);
    const relevantItems = await fetchRelevantItems(
      intent,
      body.message,
      auth.userId,
      inventoryItems,
      supabaseUrl,
      supabaseServiceKey,
      bedrockClient
    );
    const relevantItemsBlock = formatRelevantItems(intent, relevantItems);

    // Build conversation context
    const conversationContext = buildConversationContext(
      body.conversation_history || [],
      inventorySummary,
      inventorySampleItems,
      relevantItemsBlock,
      relevantItems
    );

    // Generate response
    const normalizedMessage = body.message.trim().toLowerCase();
    const isInventoryQuestion = normalizedMessage.includes('what do i have');
    let aiResponse: string;

    if (intent !== 'general' && relevantItems.length === 0) {
      aiResponse = "I couldn't find anything matching that.";
    } else if (isInventoryQuestion) {
      aiResponse = buildInventoryDirectResponse(inventorySummary, inventorySampleItems);
    } else {
      const generated = await generateFollowupResponse(
        body.message.trim(),
        conversationContext,
        inventorySummary,
        inventorySampleItems,
        intent,
        relevantItemsBlock,
        bedrockClient
      );
      aiResponse = relevantItemsBlock ? `${relevantItemsBlock}\n\n${generated}` : generated;
    }

    const response: ShoppingFollowupResponse = {
      response: aiResponse,
      responded_at: new Date().toISOString(),
      usage: {
        text_count: newTextCount,
        text_limit: DAILY_TEXT_LIMIT,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('shopping-followup error:', error);

    const apiError: ApiError = {
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
    };

    return new Response(JSON.stringify(apiError), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
