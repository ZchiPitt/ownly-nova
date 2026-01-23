# Shopping Agent - Inventory Context Fix

> Created: 2026-01-31
> Status: Planning

---

## Problem Statement

The shopping assistant (`shopping-followup` Edge Function) doesn't query the user's inventory database before answering questions. When a user asks questions like:
- "I need some space, what are the things that I can drop?"
- "Do I have too many kitchen items?"
- "What should I organize first?"

The AI has no data to work with and gives generic responses.

---

## User Stories

```json
{
  "stories": [
    {
      "id": "US-SHOP-001",
      "title": "Basic Inventory Context for Shopping Assistant",
      "description": "As a user chatting with the shopping assistant, I want it to know what items I own so it can give relevant advice based on my actual inventory.",
      "acceptanceCriteria": [
        "Create fetchUserInventory() function that queries items table with user_id filter",
        "Query includes: id, name, category (joined), location path (joined), quantity, created_at, tags",
        "Filter out deleted items (deleted_at IS NULL)",
        "Limit to 100 most recent items to prevent token explosion",
        "Create buildInventorySummary() that returns: total_items, items_by_category count, recent 10 items, unique locations",
        "Update buildConversationContext() to include inventory summary",
        "Include 20 sample items formatted as: '- Item Name (Category) in Location'",
        "Update system prompt to explain inventory data is available",
        "User asks 'what do I have' → AI responds with inventory summary",
        "User with empty inventory → AI says 'Your inventory is empty'",
        "User with 500+ items → Function completes under 3 seconds",
        "npm run build passes",
        "Deploy to Supabase and test manually"
      ],
      "priority": 1,
      "passes": false,
      "notes": "MVP - enables basic inventory-aware responses"
    },
    {
      "id": "US-SHOP-002",
      "title": "Smart Inventory Search by Intent",
      "description": "As a user asking specific questions about my inventory, I want the AI to find relevant items using semantic search and intent detection so I get precise answers.",
      "acceptanceCriteria": [
        "Create detectIntent() function that classifies user message into: declutter, organize, find, compare, general",
        "Intent detection uses keyword matching: declutter=['drop','donate','sell','get rid of','throw away'], find=['where is','do I have','find my'], organize=['organize','sort','arrange']",
        "Create fetchRelevantItems() that queries differently based on intent",
        "Declutter intent: return oldest 10 items (by created_at), items with quantity>1, items with no location",
        "Find intent: extract search terms, use search_items_by_embedding RPC for semantic search",
        "Organize intent: return items with no location, categories with most items",
        "Compare intent: generate embedding for user description, search similar items",
        "Add relevantItems array to conversation context",
        "Format relevant items with reasoning: 'Items you might consider removing: [list with reasons]'",
        "Update system prompt with intent-specific guidance",
        "User asks 'what can I drop' → AI suggests oldest/duplicate items with reasons",
        "User asks 'where is my passport' → AI searches and returns location if found",
        "User asks 'do I have a blue shirt' → AI uses semantic search and responds",
        "No matching items → AI says 'I couldn't find anything matching that'",
        "npm run build passes",
        "Deploy to Supabase and test manually"
      ],
      "priority": 2,
      "passes": false,
      "notes": "Requires US-SHOP-001. Makes assistant actually smart."
    }
  ]
}
```

---

## Technical Details

### US-SHOP-001: Basic Inventory Context

**Files to Modify:**
```
supabase/functions/shopping-followup/index.ts
```

**New Functions:**
```typescript
// Fetch user's inventory items
async function fetchUserInventory(
  userId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<InventoryItem[]>

// Build summary statistics
function buildInventorySummary(items: InventoryItem[]): InventorySummary

// Updated context builder
function buildConversationContext(
  history: ConversationMessage[],
  inventory: InventorySummary,
  sampleItems: InventoryItem[]
): string
```

**Types:**
```typescript
interface InventoryItem {
  id: string;
  name: string;
  category_name: string | null;
  location_path: string | null;
  quantity: number;
  created_at: string;
  tags: string[];
}

interface InventorySummary {
  total_items: number;
  items_by_category: Record<string, number>;
  recent_items: Array<{name: string, category: string, added: string}>;
  locations_used: string[];
}
```

**System Prompt Addition:**
```
You have access to the user's home inventory:
- Total items: {total}
- Categories: {breakdown}
- Recent additions: {list}
- Storage locations: {locations}
- Sample items: {list}

Use this data to give personalized advice about their belongings.
```

---

### US-SHOP-002: Smart Inventory Search

**Files to Modify:**
```
supabase/functions/shopping-followup/index.ts
```

**New Functions:**
```typescript
// Detect user intent from message
function detectIntent(message: string): UserIntent

// Fetch items relevant to the intent
async function fetchRelevantItems(
  intent: UserIntent,
  message: string,
  userId: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
  openaiApiKey: string
): Promise<RelevantItem[]>
```

**Types:**
```typescript
type UserIntent = 'declutter' | 'organize' | 'find' | 'compare' | 'general';

interface RelevantItem {
  id: string;
  name: string;
  category_name: string | null;
  location_path: string | null;
  reason: string;  // Why this item is relevant
  similarity?: number;  // For search results
}
```

**Intent Keywords:**
```typescript
const INTENT_KEYWORDS = {
  declutter: ['drop', 'donate', 'sell', 'get rid of', 'throw away', 'declutter', 'remove', 'toss'],
  find: ['where is', 'where are', 'do I have', 'find my', 'looking for', 'search for'],
  organize: ['organize', 'sort', 'arrange', 'tidy', 'clean up', 'put away'],
  compare: ['similar', 'like this', 'compared to', 'already have something']
};
```

---

## Token Budget

| Component | Tokens |
|-----------|--------|
| Inventory summary | ~100 |
| 20 sample items | ~400 |
| System prompt addition | ~200 |
| **US-SHOP-001 Total** | **~700** |
| Relevant items (10) | ~200 |
| Intent context | ~100 |
| **US-SHOP-002 Total** | **~300** |
| **Grand Total** | **~1000** ✅ |

---

## Test Scenarios

### US-SHOP-001

| Input | Expected Output |
|-------|-----------------|
| "What do I have?" | Summary: "You have 47 items across 8 categories..." |
| "How many kitchen items?" | "You have 12 items in Kitchen category" |
| (empty inventory) | "Your inventory is empty. Start by adding some items!" |

### US-SHOP-002

| Input | Expected Output |
|-------|-----------------|
| "What can I drop?" | "Based on your inventory, here are items to consider: [oldest items], [duplicates]" |
| "Where is my passport?" | "I found 'Passport' in Documents > Filing Cabinet" |
| "Do I have a blue shirt?" | Semantic search → "Yes, you have 'Navy Blue T-Shirt' in Bedroom > Closet" |
| "Help me organize" | "You have 8 items without a location. Start with these..." |

---

## Implementation Order

1. ✅ Create this spec document
2. ⬜ US-SHOP-001: Basic inventory context
3. ⬜ Deploy and manual test
4. ⬜ US-SHOP-002: Smart search
5. ⬜ Deploy and manual test

---

## Edge Cases

- **Empty inventory** → Special message, no search
- **Very large inventory (1000+)** → Summary only, limit queries
- **No matching items** → Friendly "not found" message
- **Ambiguous intent** → Default to general, include summary
- **Multiple intents** → Pick primary based on keyword order
