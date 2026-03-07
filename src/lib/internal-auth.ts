const parseBearerToken = (authorizationHeader: string | null) => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

type InternalAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export const verifyInternalToken = (request: Request): InternalAuthResult => {
  const expectedToken = process.env.INTERNAL_API_TOKEN;
  if (!expectedToken) {
    return {
      ok: false,
      status: 500,
      error: "INTERNAL_API_TOKEN is not configured",
    };
  }

  const providedToken =
    request.headers.get("x-internal-token") ??
    parseBearerToken(request.headers.get("authorization"));

  if (!providedToken) {
    return { ok: false, status: 401, error: "Missing internal token" };
  }

  if (providedToken !== expectedToken) {
    return { ok: false, status: 401, error: "Invalid internal token" };
  }

  return { ok: true };
};
