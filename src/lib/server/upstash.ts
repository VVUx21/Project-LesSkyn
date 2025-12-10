import { client as redis } from './redis';

// Realtime channel helper for streaming AI responses using ioredis
export const realtime = {
  channel: (channelId: string) => ({
    async emit(event: string, data: any) {
      const message = JSON.stringify({ event, data, timestamp: Date.now() });
      await redis.lpush(`channel:${channelId}`, message);
      // Set TTL to auto-cleanup after 5 minutes
      await redis.expire(`channel:${channelId}`, 300);
    },
    async getMessages(count: number = 100) {
      const messages = await redis.lrange(`channel:${channelId}`, 0, count - 1);
      return messages.map((msg: any) => {
        if (typeof msg === 'string') {
          try { return JSON.parse(msg); } catch { return msg; }
        }
        return msg;
      });
    },
    async clear() {
      await redis.del(`channel:${channelId}`);
    }
  })
};

// Cache helper functions
export async function getCachedRoutine(skinType: string, skinConcern: string) {
  const cacheKey = `routine:${skinType.trim()}:${skinConcern.trim()}`;
  const cached = await redis.get(cacheKey);
  if (!cached) return null;
  if (typeof cached === 'string') {
    try { return JSON.parse(cached); } catch { return null; }
  }
  return cached;
}

export async function setCachedRoutine(skinType: string, skinConcern: string, routine: any) {
  const cacheKey = `routine:${skinType.trim()}:${skinConcern.trim()}`;
  await redis.set(cacheKey, JSON.stringify(routine), 'EX', 3600); // 1 hour TTL
}

// Session tracking for real-time streaming
export async function createStreamSession(sessionId: string, metadata: any) {
  await redis.set(`session:${sessionId}`, JSON.stringify({
    ...metadata,
    status: 'active',
    createdAt: Date.now()
  }), 'EX', 600); // 10 minute TTL
}

export async function updateStreamSession(sessionId: string, update: any) {
  const existing = await redis.get(`session:${sessionId}`);
  const session = existing ? (typeof existing === 'string' ? JSON.parse(existing) : existing) : {};
  await redis.set(`session:${sessionId}`, JSON.stringify({
    ...session,
    ...update,
    updatedAt: Date.now()
  }), 'EX', 600);
}

export async function getStreamSession(sessionId: string) {
  const session = await redis.get(`session:${sessionId}`);
  if (!session) return null;
  return typeof session === 'string' ? JSON.parse(session) : session;
}

// Re-export the ioredis client for consistency
export { redis };
