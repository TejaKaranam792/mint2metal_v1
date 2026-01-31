import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// General rate limiter
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Speed limiter
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: () => 500, // add 500ms of delay per request above delayAfter
});

// Security headers middleware
export const createSecurityHeaders = (req: any, res: any, next: any) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' ws: wss:",
    "media-src 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'"
  ].join('; '));

  // HSTS (HTTP Strict Transport Security)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

// Default export for general middleware
const rateLimitMiddleware = (req: any, res: any, next: any) => {
  // Skip rate limiting for admin routes
  if (req.path.startsWith('/admin')) {
    // Apply security headers only
    createSecurityHeaders(req, res, next);
    return;
  }

  // Apply general rate limiting
  generalRateLimit(req, res, (err: any) => {
    if (err) return next(err);
    // Apply speed limiting
    speedLimiter(req, res, (err: any) => {
      if (err) return next(err);
      // Apply security headers
      createSecurityHeaders(req, res, next);
    });
  });
};

export default rateLimitMiddleware;
