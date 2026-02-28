// ─── OpenAI Embedding + Text Chunking ──────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

/**
 * Generate embedding vector using OpenAI text-embedding-3-small (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.replace(/\n/g, ' ').trim(),
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI embedding API error: ${response.status} ${err}`)
  }

  const json = await response.json()
  return json.data[0].embedding as number[]
}

/**
 * Split text into overlapping chunks by sentence boundaries
 * @param text - Input text
 * @param maxTokens - Approximate max tokens per chunk (default 500)
 * @param overlapTokens - Overlap tokens between chunks (default 100)
 */
export function chunkText(
  text: string,
  maxTokens: number = 500,
  overlapTokens: number = 100,
): string[] {
  const sentences = text
    .split(/(?<=[.!?。\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (sentences.length === 0) return []

  const chunks: string[] = []
  let currentChunk: string[] = []
  let currentLength = 0

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence)

    if (currentLength + sentenceTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '))

      // Calculate overlap: keep last sentences up to overlapTokens
      let overlapLength = 0
      const overlapSentences: string[] = []
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const tokens = estimateTokens(currentChunk[i])
        if (overlapLength + tokens > overlapTokens) break
        overlapLength += tokens
        overlapSentences.unshift(currentChunk[i])
      }

      currentChunk = [...overlapSentences, sentence]
      currentLength = overlapLength + sentenceTokens
    } else {
      currentChunk.push(sentence)
      currentLength += sentenceTokens
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '))
  }

  return chunks
}

/** Rough token estimate: ~4 chars per token for mixed CJK/English */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
