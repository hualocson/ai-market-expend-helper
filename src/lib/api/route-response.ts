import "server-only";

import { NextResponse } from "next/server";

import type { ApiMeta, ApiResponse } from "./api-response";
import { apiErrorBody, apiSuccessBody } from "./api-response";

export const apiSuccess = <T>(data: T, init?: ResponseInit, meta?: ApiMeta) =>
  NextResponse.json<ApiResponse<T>>(apiSuccessBody(data, meta), init);

export const apiError = (
  code: string,
  message: string,
  status: number,
  details?: unknown
) =>
  NextResponse.json<ApiResponse<never>>(apiErrorBody(code, message, details), {
    status,
  });
