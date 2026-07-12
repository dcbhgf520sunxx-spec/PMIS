export type ApiFieldErrors = Record<string, string[]>;

type ApiErrorPayload = {
  message?: string;
  fieldErrors?: ApiFieldErrors;
};

export class ApiError extends Error {
  fieldErrors?: ApiFieldErrors;

  constructor(message: string, fieldErrors?: ApiFieldErrors) {
    super(message);
    this.name = 'ApiError';
    this.fieldErrors = fieldErrors;
  }
}

export function createApiError(payload?: ApiErrorPayload, fallback = '请求失败') {
  return new ApiError(payload?.message || fallback, payload?.fieldErrors);
}
