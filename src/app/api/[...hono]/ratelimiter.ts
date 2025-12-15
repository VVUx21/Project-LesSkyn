import type { Context, MiddlewareHandler } from 'hono';
import { client as redis } from '@/lib/server/redis';

interface RateLimitConfig {
  windowInSeconds: number;
  maxRequests: number;
  keyPrefix?: string;
  /** Return a stable identifier (eg userId). If omitted, falls back to client IP. */
  getIdentifier?: (c: Parameters<MiddlewareHandler>[0] extends infer T ? T : never) => string | Promise<string>;
}

const getClientIp = (c: Context): string => {
  const headers = c.req.raw.headers;
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf;
  return 'unknown';
};

export const rateLimiter = (config: RateLimitConfig): MiddlewareHandler => {
  return async (c, next) => {
    const { windowInSeconds, maxRequests, keyPrefix = 'rate-limit', getIdentifier } = config;

    let identifier: string | undefined;
    if (getIdentifier) {
      try {
        identifier = await getIdentifier(c);
      } catch {
        identifier = undefined;
      }
    }
    const ip = getClientIp(c);
    const stableId = (identifier && identifier.trim()) ? identifier.trim() : `ip:${ip}`;
    const key = `${keyPrefix}:${stableId}`;

    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowInSeconds);
    
    const result = await pipeline.exec();
    
    const requestCount = result?.[0]?.[1] as number;

    if (requestCount > maxRequests) {
      console.warn(`❌ Rate limit exceeded for ${stableId}`);
      return c.json(
        { 
          success: false,
          error: `You have exceeded the maximum of ${maxRequests} requests in ${windowInSeconds} seconds. Please wait before trying again.`
        },
        429
      );
    }
    console.log(`✅ Rate limit check passed for ${stableId} (${requestCount}/${maxRequests})`);
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', (maxRequests - requestCount).toString());
    c.header('X-RateLimit-Reset', (Math.floor(Date.now() / 1000) + windowInSeconds).toString());

    await next();
  };
};