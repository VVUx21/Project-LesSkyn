import { MiddlewareHandler } from 'hono';
import { client as redis } from '@/lib/server/redis';

interface RateLimitConfig {
  windowInSeconds: number;
  maxRequests: number;
}

export const rateLimiter = (config: RateLimitConfig): MiddlewareHandler => {
  return async (c, next) => {
    const ip = c.req.header('x-real-ip') || 'anonymous';
    const key = `rate-limit:${ip}`;

    const { windowInSeconds, maxRequests } = config;

    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowInSeconds);
    
    const result = await pipeline.exec();
    
    const requestCount = result?.[0]?.[1] as number;

    if (requestCount > maxRequests) {
      console.warn(`❌ Rate limit exceeded for IP: ${ip}`);
      return c.json(
        { 
          success: false,
          error: 'Rate limit exceeded. Please try again later.'
        },
        429
      );
    }
    console.log(`✅ Rate limit check passed for IP: ${ip} (${requestCount}/${maxRequests})`);
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', (maxRequests - requestCount).toString());
    c.header('X-RateLimit-Reset', (Math.floor(Date.now() / 1000) + windowInSeconds).toString());

    await next();
  };
};