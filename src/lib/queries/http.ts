import { unwrapApiResponse } from "@/lib/api/api-response";

export const fetchJson = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => null);

  return unwrapApiResponse<T>(payload, response.status);
};
