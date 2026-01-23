# US-SHOP-003: Embedding-based Intent Detection

**Priority:** P1 | **Effort:** 2 hrs

---

## Problem

Current `detectIntent()` uses simple keyword matching:
- "what can I drop" ✅ matches "drop" → declutter
- "help me clear out some stuff" ❌ no keyword match → general
- "I have way too many things" ❌ no keyword match → general

Users express intents in many ways that keywords can't capture.

---

## Solution

Use **embedding similarity** to detect intent:
1. Pre-define example phrases for each intent
2. Generate embedding for user message
3. Compare to intent examples using cosine similarity
4. Select intent with highest similarity score

---

## User Story

```json
{
  "id": "US-SHOP-003",
  "title": "Embedding-based Intent Detection",
  "description": "As a user asking questions in natural language, I want the assistant to understand my intent even when I don't use exact keywords, so I get relevant responses.",
  "acceptanceCriteria": [
    "Create INTENT_EXAMPLES constant with 4-5 example phrases per intent",
    "Create generateMessageEmbedding() function using OpenAI text-embedding-3-small",
    "Create computeCosineSimilarity() function for vector comparison",
    "Create detectIntentByEmbedding() that compares message to all intent examples",
    "Pre-compute intent example embeddings on first request (cache in memory)",
    "Return intent with highest average similarity score",
    "Set minimum similarity threshold (0.7) - below returns 'general'",
    "Fall back to keyword matching if embedding API fails",
    "User says 'help me clear out stuff' → detects 'declutter' intent",
    "User says 'can you locate my keys' → detects 'find' intent",
    "User says 'random question about weather' → returns 'general' (below threshold)",
    "Embedding API call adds <500ms latency",
    "npm run build passes",
    "Deploy and test manually"
  ],
  "priority": 1,
  "passes": false,
  "notes": "Improves intent detection accuracy significantly"
}
```

---

## Technical Details

### Intent Examples

```typescript
const INTENT_EXAMPLES: Record<UserIntent, string[]> = {
  declutter: [
    "what can I get rid of",
    "what should I throw away",
    "help me clear out some stuff",
    "what can I donate or sell",
    "I have too much stuff what should go",
    "help me declutter my home",
    "what items should I remove"
  ],
  find: [
    "where is my passport",
    "do I have a blue shirt",
    "can you find my charger",
    "looking for my headphones",
    "where did I put my keys",
    "do I own any winter jackets",
    "help me locate my documents"
  ],
  organize: [
    "help me organize my closet",
    "I need to tidy up my stuff",
    "what needs to be put away",
    "how should I arrange my items",
    "help me sort my belongings",
    "I need more space how to organize"
  ],
  compare: [
    "do I have something similar to this",
    "is this like what I already own",
    "would this be a duplicate",
    "do I need another one of these"
  ],
  general: [
    "tell me about my inventory",
    "what do I have",
    "give me a summary",
    "how many items do I own"
  ]
};
```

### New Functions

```typescript
// Cache for pre-computed intent embeddings
let intentEmbeddingsCache: Map<UserIntent, number[][]> | null = null;

// Generate embedding for text
async function generateMessageEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 512,  // Smaller for faster comparison
    }),
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}

// Cosine similarity between two vectors
function computeCosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Pre-compute embeddings for all intent examples
async function getIntentEmbeddings(
  apiKey: string
): Promise<Map<UserIntent, number[][]>> {
  if (intentEmbeddingsCache) {
    return intentEmbeddingsCache;
  }
  
  const cache = new Map<UserIntent, number[][]>();
  
  for (const [intent, examples] of Object.entries(INTENT_EXAMPLES)) {
    const embeddings: number[][] = [];
    for (const example of examples) {
      const embedding = await generateMessageEmbedding(example, apiKey);
      embeddings.push(embedding);
    }
    cache.set(intent as UserIntent, embeddings);
  }
  
  intentEmbeddingsCache = cache;
  return cache;
}

// Detect intent using embedding similarity
async function detectIntentByEmbedding(
  message: string,
  apiKey: string
): Promise<{ intent: UserIntent; confidence: number }> {
  try {
    // Get message embedding
    const messageEmbedding = await generateMessageEmbedding(message, apiKey);
    
    // Get pre-computed intent embeddings
    const intentEmbeddings = await getIntentEmbeddings(apiKey);
    
    let bestIntent: UserIntent = 'general';
    let bestScore = 0;
    
    // Compare to each intent's examples
    for (const [intent, examples] of intentEmbeddings.entries()) {
      // Average similarity across all examples for this intent
      const similarities = examples.map(ex => 
        computeCosineSimilarity(messageEmbedding, ex)
      );
      const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
      
      if (avgSimilarity > bestScore) {
        bestScore = avgSimilarity;
        bestIntent = intent;
      }
    }
    
    // Threshold check
    const SIMILARITY_THRESHOLD = 0.7;
    if (bestScore < SIMILARITY_THRESHOLD) {
      return { intent: 'general', confidence: bestScore };
    }
    
    return { intent: bestIntent, confidence: bestScore };
    
  } catch (error) {
    console.error('Embedding intent detection failed, falling back to keywords:', error);
    // Fallback to keyword matching
    return { intent: detectIntent(message), confidence: 0.5 };
  }
}
```

### Updated Flow

```typescript
// In main handler, replace:
const intent = detectIntent(body.message);

// With:
const { intent, confidence } = await detectIntentByEmbedding(
  body.message,
  openaiApiKey
);
console.log(`Detected intent: ${intent} (confidence: ${confidence.toFixed(2)})`);
```

---

## Cost Analysis

| Component | Cost |
|-----------|------|
| Message embedding | ~$0.00002 (512 dims) |
| Intent examples (one-time) | ~$0.0006 (30 examples) |
| **Per request** | **~$0.00002** |

Negligible cost increase.

---

## Performance

- Embedding generation: ~100-200ms
- Similarity computation: <1ms (in-memory)
- **Total added latency: ~150ms**

Acceptable for chat interface.

---

## Test Cases

| User Message | Expected Intent | Confidence |
|--------------|-----------------|------------|
| "what can I drop" | declutter | >0.8 |
| "help me clear out stuff" | declutter | >0.75 |
| "where is my passport" | find | >0.85 |
| "can you locate my charger" | find | >0.75 |
| "help me tidy up" | organize | >0.75 |
| "what's the weather today" | general | <0.7 |
| "tell me a joke" | general | <0.7 |

---

## Files to Modify

```
supabase/functions/shopping-followup/index.ts
  - Add INTENT_EXAMPLES constant
  - Add generateMessageEmbedding()
  - Add computeCosineSimilarity()
  - Add getIntentEmbeddings() with caching
  - Add detectIntentByEmbedding()
  - Update main handler to use new detection
  - Keep detectIntent() as fallback
```

---

## Rollback Plan

If embedding detection causes issues:
1. Set `USE_EMBEDDING_INTENT = false` flag
2. Falls back to keyword matching automatically

---

## Future Improvements

1. **Fine-tune threshold** based on real usage data
2. **Add more examples** for edge cases
3. **Batch embedding** - embed all examples in one API call
4. **Persistent cache** - store embeddings in database instead of memory
