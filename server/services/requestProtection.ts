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
    if (ip) return ip;
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * General API Request Rate Limiter (Conservative: 240 requests/minute per IP)
 * Prevents high-frequency request flood abuse while seamlessly serving SPA navigation and monitoring polls.
 */
export function generalApiRateLimiter(req: Request, res: Response, next: NextFunction) {
  // Skip rate limiting for static assets and local internal communications
  if (req.path.startsWith('/assets') || req.path.startsWith('/@') || req.path === '/api/health') {
    return next();
  }

  const clientIp = getClientIp(req);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 240;

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
 * Sensitive Auth & Account Endpoint Rate Limiter (30 attempts / 5 minutes)
 * Protects login, registration, and password reset endpoints against brute-force attacks.
 */
export function sensitiveAuthRateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIp = getClientIp(req);
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxAuthAttempts = 30;

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
