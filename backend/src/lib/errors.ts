/**
 * Error carrying an HTTP status + structured details, so routes can surface
 * domain conflicts (double allocation, booking overlap) with useful payloads.
 */
export class HttpError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(409, message, details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

/** Standard error responder used by all Track B routes. */
import type { Response } from 'express';

export function sendError(res: Response, err: unknown, fallback: string) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  const message = err instanceof Error ? err.message : fallback;
  res.status(400).json({ error: message });
}
