export type ApiMeta = {
  page?: number;
  limit?: number;
  total?: number;
  hasNextPage?: boolean;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: ApiMeta;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;

export class ApiResponseError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status?: number;

  constructor(
    code: string,
    message: string,
    details?: unknown,
    status?: number
  ) {
    super(message);
    this.name = "ApiResponseError";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
    if (status !== undefined) {
      this.status = status;
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const apiSuccessBody = <T>(data: T, meta?: ApiMeta): ApiSuccess<T> => {
  if (meta === undefined) {
    return { success: true, data };
  }

  return { success: true, data, meta };
};

export const apiErrorBody = (
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse => {
  if (details === undefined) {
    return { success: false, error: { code, message } };
  }

  return { success: false, error: { code, message, details } };
};

export const isApiResponse = <T = unknown>(
  value: unknown
): value is ApiResponse<T> => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.success === true) {
    return "data" in value;
  }

  if (value.success !== false || !isRecord(value.error)) {
    return false;
  }

  return (
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
};

export const unwrapApiResponse = <T>(payload: unknown, status?: number): T => {
  if (!isApiResponse<T>(payload)) {
    throw new ApiResponseError(
      "INVALID_API_RESPONSE",
      "Invalid API response",
      undefined,
      status
    );
  }

  if (payload.success) {
    return payload.data;
  }

  throw new ApiResponseError(
    payload.error.code,
    payload.error.message,
    payload.error.details,
    status
  );
};
