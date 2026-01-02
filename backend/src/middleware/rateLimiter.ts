// backend/src/middleware/rateLimiter.ts
// Rate limiting middleware for API endpoints

import type { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(options: RateLimitOptions) {
  const store: RateLimitStore = {};
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
  } = options;

  // Cleanup expired entries every minute
  setInterval(() => {
    const now = Date.now();
    Object.keys(store).forEach((key) => {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    });
  }, 60000);

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = getIdentifier(req);
    const now = Date.now();

    // Initialize or reset if window expired
    if (!store[identifier] || store[identifier].resetTime < now) {
      store[identifier] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    const current = store[identifier];

    // Check if limit exceeded
    if (current.count >= maxRequests) {
      const retryAfter = Math.ceil((current.resetTime - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(current.resetTime));

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfter,
        },
      });
    }

    // Increment counter
    current.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(maxRequests - current.count));
    res.setHeader('X-RateLimit-Reset', String(current.resetTime));

    // If skipSuccessfulRequests is true, decrement on successful response
    if (skipSuccessfulRequests) {
      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          current.count--;
        }
        return originalJson(data);
      };
    }

    next();
  };
}

/**
 * Get client identifier for rate limiting
 * Uses IP address by default, can be extended to use API keys
 */
function getIdentifier(req: Request): string {
  // Try to get real IP from proxy headers
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp;
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Pre-configured rate limiters for different endpoints
 */

// Search endpoint: 10 requests per minute
export const searchRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 10,
  message: 'Too many search requests, please try again in a minute',
});

// Audio URL endpoint: 20 requests per minute
export const audioRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 20,
  message: 'Too many audio requests, please try again in a minute',
});

// Song detail endpoint: 30 requests per minute
export const detailRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 30,
  message: 'Too many detail requests, please try again in a minute',
});

// Batch endpoint: 5 requests per minute
export const batchRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 5,
  message: 'Too many batch requests, please try again in a minute',
});
