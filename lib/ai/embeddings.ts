import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

function formatEmbeddingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown embedding error');
  if (
    message.toLowerCase().includes('incorrect api key') ||
    message.toLowerCase().includes('invalid_api_key') ||
    message.toLowerCase().includes('api key')
  ) {
    return 'Your AI Provider API key is invalid or missing. Please check your AI provider keys in settings.';
  }
  return message;
}

export function chunkText(text: string, maxTokens: number = 500): string[] {
  const maxChars = maxTokens * 4;
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const p of paragraphs) {
    if (currentChunk.length + p.length > maxChars) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = p;
    } else {
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + p;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export async function generateEmbedding(text: string, apiKey?: string, provider: string = 'openai'): Promise<number[]> {
  const sanitizeDimensions = (embedding: number[]) => {
    if (embedding.length === 1536) return embedding;
    if (embedding.length < 1536) {
      const padded = new Array(1536).fill(0);
      for (let i = 0; i < embedding.length; i++) padded[i] = embedding[i];
      return padded;
    }
    return embedding.slice(0, 1536);
  };

  if (provider === 'gemini') {
    const runtimeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!runtimeApiKey) {
      throw new Error('Gemini API Key is required for generating embeddings.');
    }
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(runtimeApiKey);
    // Use gemini-embedding-2 because the user's API key is provisioned for Gemini 2.0 and newer models, which return 404 for older embedding models.
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const result = await model.embedContent(text);
    return sanitizeDimensions(result.embedding.values);
  }

  if (provider === 'claude' || provider === 'xai' || provider === 'deepseek') {
    throw new Error(`[Embeddings Error] The provider "${provider}" does not have a native vector embedding model. To use the Knowledge Base with ${provider}, you must also provide either a Gemini or OpenAI API Key in your Knowledge Base settings. The system will use Gemini/OpenAI to "read" the documents, and ${provider} to chat with you.`);
  }

  const runtimeApiKey = apiKey || process.env.OPENAI_API_KEY;
  if (!runtimeApiKey) {
    throw new Error('OpenAI API Key is required for generating embeddings.');
  }

  const openai = new OpenAI({
    apiKey: runtimeApiKey,
    timeout: 20000,
    maxRetries: 1,
  });

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  });

  return sanitizeDimensions(response.data[0].embedding);
}

export async function processAndStoreDocument(
  organizationId: string,
  knowledgeBaseId: string,
  content: string,
  apiKey?: string,
  provider: string = 'openai'
) {
  const chunks = chunkText(content);
  if (chunks.length === 0) return;

  console.log(`[Embeddings] Vectorizing document into ${chunks.length} chunks...`);

  type EmbeddedChunk = { id: string; content: string; embeddingString: string };

  const batchSize = 10;
  const embeddedChunks: EmbeddedChunk[] = [];
  const errors: unknown[] = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (chunk): Promise<EmbeddedChunk | null> => {
        try {
          const embedding = await generateEmbedding(chunk, apiKey, provider);
          return {
            id: randomUUID(),
            content: chunk,
            embeddingString: `[${embedding.join(',')}]`,
          };
        } catch (error) {
          errors.push(error);
          console.error(`[Embeddings] Error generating/storing chunk: ${formatEmbeddingError(error)}`);
          return null;
        }
      })
    );
    embeddedChunks.push(...results.filter((result): result is EmbeddedChunk => result !== null));
  }

  if (embeddedChunks.length === 0 && chunks.length > 0) {
    const message = formatEmbeddingError(errors[0]);
    throw new Error(`Failed to generate/store embeddings for ${chunks.length} chunks. ${message}`);
  }

  if (errors.length > 0) {
    const message = formatEmbeddingError(errors[0]);
    throw new Error(`Failed to generate embeddings for ${errors.length} of ${chunks.length} chunks. ${message}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "KnowledgeChunk"
      WHERE "organizationId" = ${organizationId}
        AND "knowledgeBaseId" = ${knowledgeBaseId}
    `;

    for (const chunk of embeddedChunks) {
      await tx.$executeRaw`
        INSERT INTO "KnowledgeChunk" (
          "id", "knowledgeBaseId", "organizationId", "content", "embedding", "createdAt"
        ) VALUES (
          ${chunk.id},
          ${knowledgeBaseId},
          ${organizationId},
          ${chunk.content},
          ${chunk.embeddingString}::vector,
          NOW()
        )
      `;
    }
  });
}

export async function searchSimilarChunks(
  organizationId: string,
  query: string,
  limit: number = 5,
  apiKey?: string,
  provider: string = 'openai',
  aiAgentId?: string
): Promise<string[]> {
  try {
    const queryEmbedding = await generateEmbedding(query, apiKey, provider);
    const queryEmbeddingString = `[${queryEmbedding.join(',')}]`;

    let results;
    if (aiAgentId) {
      results = await prisma.$queryRaw<Array<{ content: string; similarity: number }>>`
        SELECT kc.content, 1 - (kc.embedding <=> ${queryEmbeddingString}::vector) as similarity
        FROM "KnowledgeChunk" kc
        INNER JOIN "KnowledgeBase" kb ON kc."knowledgeBaseId" = kb.id
        INNER JOIN "AgentFile" af ON kb.id = af."knowledgeBaseId"
        WHERE kc."organizationId" = ${organizationId} AND af."aiAgentId" = ${aiAgentId}
        ORDER BY kc.embedding <=> ${queryEmbeddingString}::vector
        LIMIT ${limit}
      `;
    } else {
      results = await prisma.$queryRaw<Array<{ content: string; similarity: number }>>`
        SELECT kc.content, 1 - (kc.embedding <=> ${queryEmbeddingString}::vector) as similarity
        FROM "KnowledgeChunk" kc
        INNER JOIN "KnowledgeBase" kb ON kc."knowledgeBaseId" = kb.id
        LEFT JOIN "AgentFile" af ON kb.id = af."knowledgeBaseId"
        WHERE kc."organizationId" = ${organizationId} AND af.id IS NULL
        ORDER BY kc.embedding <=> ${queryEmbeddingString}::vector
        LIMIT ${limit}
      `;
    }

    return results.map(r => r.content);
  } catch (error) {
    console.error(`[Embeddings] Search error: ${formatEmbeddingError(error)}`);
    return [];
  }
}
