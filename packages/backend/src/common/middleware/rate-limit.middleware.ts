import { Injectable, NestMiddleware, TooManyRequestsException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RequestTracker {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private requests: Map<string, RequestTracker> = new Map();
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes
  private readonly maxRequests = 100; // per window

  use(req: Request, res: Response, next: NextFunction) {
    // Only rate limit auth endpoints
    if (!req.path.includes('/auth/')) {
      return next();
    }

    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const tracker = this.requests.get(key);

    if (!tracker || now > tracker.resetTime) {
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return next();
    }

    if (tracker.count >= this.maxRequests) {
      throw new TooManyRequestsException('Too many requests, please try again later');
    }

    tracker.count++;
    next();
  }
}
