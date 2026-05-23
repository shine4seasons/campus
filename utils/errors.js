class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

class DomainError extends AppError {
  constructor(message = 'Domain error', status = 400, code = 'DOMAIN_ERROR') {
    super(message, status);
    this.name = 'DomainError';
    this.code = code;
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
}

class AuthError extends AppError {
  constructor(message = 'Unauthorized', status = 401, code = 'AUTH_ERROR') {
    super(message, status);
    this.name = 'AuthError';
    this.code = code;
  }
}

function mapError(err) {
  if (!err) return { status: 500, message: 'Internal server error', code: 'INTERNAL_ERROR' };
  let status = Number(err.status) || 500;
  let code = err.code || null;
  let details = err.details || null;

  if (err.name === 'ValidationError') {
    status = 400;
    code = code || 'VALIDATION_ERROR';
    if (!details && err.errors && typeof err.errors === 'object') {
      details = Object.values(err.errors).map((item) => ({
        path: item.path,
        message: item.message
      }));
    }
  } else if (err.name === 'CastError') {
    status = 400;
    code = code || 'INVALID_ID';
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE_KEY';
  }

  const message = status >= 500 ? 'Internal server error' : (err.message || 'Request failed');
  code = code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  return { status, message, code, details };
}

const badRequest = (message = 'Bad request') => new AppError(message, 400);
const unauthorized = (message = 'Unauthorized') => new AppError(message, 401);
const forbidden = (message = 'Forbidden') => new AppError(message, 403);
const notFound = (message = 'Not found') => new AppError(message, 404);
const conflict = (message = 'Conflict') => new AppError(message, 409);
const serviceUnavailable = (message = 'Service unavailable') => new AppError(message, 503);

module.exports = {
  AppError,
  DomainError,
  ValidationError,
  AuthError,
  mapError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serviceUnavailable
};
