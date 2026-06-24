export class MikroLensError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, options: { code: string; statusCode: number }) {
    super(message);
    this.name = new.target.name;
    this.code = options.code;
    this.statusCode = options.statusCode;
  }
}

export class ValidationError extends MikroLensError {
  constructor(message: string, code = "validation_error") {
    super(message, {
      code,
      statusCode: 400,
    });
  }
}

export class PayloadTooLargeError extends MikroLensError {
  constructor(message: string, code = "payload_too_large") {
    super(message, {
      code,
      statusCode: 413,
    });
  }
}

export class RateLimitError extends MikroLensError {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number, code = "rate_limit_exceeded") {
    super(message, {
      code,
      statusCode: 429,
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class NotFoundError extends MikroLensError {
  constructor(message: string, code = "not_found") {
    super(message, {
      code,
      statusCode: 404,
    });
  }
}

export class AuthenticationError extends MikroLensError {
  constructor(message: string, code = "authentication_error") {
    super(message, {
      code,
      statusCode: 401,
    });
  }
}

export class AuthorizationError extends MikroLensError {
  constructor(message: string, code = "authorization_error") {
    super(message, {
      code,
      statusCode: 403,
    });
  }
}
