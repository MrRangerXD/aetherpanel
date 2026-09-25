import { Request, Response, NextFunction } from 'express';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const ipBuckets = new Map<string, RateLimitBucket>();
const authBuckets = new Map<string, RateLimitBucket>();

// Cleanup stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of ipBuckets.entries()) {
    if (bucket.resetAt <= now) {
      ipBuckets.delete(ip);
    }
  }
  for (const [ip, bucket] of authBuckets.entries()) {
    if (bucket.resetAt <= now) {
      authBuckets.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Extracts normalized client IP respecting proxy trust
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = raw.split(',')[0].trim();
    if (ip && ip !== '::1' && ip !== '127.0.0.1') return ip;
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    const ip = (Array.isArray(realIp) ? realIp[0] : realIp).trim();
    if (ip && ip !== '::1' && ip !== '127.0.0.1') return ip;
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Resets authentication rate limits
 */
export function clearAuthRateLimits(ip?: string) {
  if (ip) {
    authBuckets.delete(ip);
  } else {
    authBuckets.clear();
  }
}

/**
 * General API Request Rate Limiter (300 requests/minute per IP)
 * Prevents high-frequency request flood abuse while seamlessly serving SPA navigation and monitoring polls.
 */
export function generalApiRateLimiter(req: Request, res: Response, next: NextFunction) {
  // Skip rate limiting for static assets, health checks, and benign monitoring
  if (
    req.path.startsWith('/assets') ||
    req.path.startsWith('/@') ||
    req.path === '/api/health' ||
    req.method === 'OPTIONS'
  ) {
    return next();
  }

  const clientIp = getClientIp(req);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 300;

  let bucket = ipBuckets.get(clientIp);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 1, resetAt: now + windowMs };
    ipBuckets.set(clientIp, bucket);
  } else {
    bucket.count += 1;
  }

  if (bucket.count > maxRequests) {
    res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down and try again shortly.'
      }
    });
  }

  next();
}

/**
 * Sensitive Auth Endpoint Rate Limiter (100 attempts / 5 minutes)
 * Protects ONLY sensitive mutating endpoints (login, registration, password resets) against brute-force attacks.
 * Does NOT rate-limit safe reads like /me, /config, or /anti-abuse-status.
 */
export function sensitiveAuthRateLimiter(req: Request, res: Response, next: NextFunction) {
  // Safe endpoints and methods must NEVER be rate limited
  if (
    req.method === 'GET' ||
    req.method === 'OPTIONS' ||
    req.path.endsWith('/me') ||
    req.path.endsWith('/config') ||
    req.path.endsWith('/anti-abuse-status') ||
    req.path.endsWith('/logout') ||
    req.path.endsWith('/clear-rate-limits')
  ) {
    return next();
  }

  const clientIp = getClientIp(req);
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxAuthAttempts = 100;

  let bucket = authBuckets.get(clientIp);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 1, resetAt: now + windowMs };
    authBuckets.set(clientIp, bucket);
  } else {
    bucket.count += 1;
  }

  if (bucket.count > maxAuthAttempts) {
    res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
    return res.status(429).json({
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts from this IP address. Please wait a few minutes before trying again.'
      }
    });
  }

  next();
}

/**
 * Malformed JSON & Payload Error Interceptor
 */
export function safePayloadErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON_PAYLOAD',
        message: 'The request body contained malformed JSON.'
      }
    });
  }

  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The uploaded file or request payload exceeds the permitted limit (10MB).'
      }
    });
  }

  next(err);
}
