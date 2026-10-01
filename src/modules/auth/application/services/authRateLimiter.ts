export interface AuthRateLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}

export const AUTH_RATE_LIMITER = Symbol('AUTH_RATE_LIMITER');
