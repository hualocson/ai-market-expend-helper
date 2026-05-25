import { beforeEach, describe, expect, it, vi } from "vitest";

type RuntimeCachingRoute = {
  handler: unknown;
  matcher: (context: {
    request: Request;
    sameOrigin: boolean;
    url: URL;
  }) => boolean;
  method?: string;
};

type CapturedSerwistOptions = {
  runtimeCaching?: RuntimeCachingRoute[];
};

const mocks = vi.hoisted(
  (): {
    addEventListeners: ReturnType<typeof vi.fn>;
    capturedOptions: CapturedSerwistOptions | null;
    defaultRuntimeRoute: RuntimeCachingRoute;
  } => ({
    addEventListeners: vi.fn(),
    capturedOptions: null,
    defaultRuntimeRoute: {
      handler: { strategy: "default-cache" },
      matcher: () => true,
    },
  })
);

vi.mock("@serwist/next/worker", () => ({
  defaultCache: [mocks.defaultRuntimeRoute],
}));

vi.mock("serwist", () => ({
  NetworkOnly: class NetworkOnly {
    strategy = "network-only";
  },
  Serwist: class Serwist {
    constructor(options: { runtimeCaching?: RuntimeCachingRoute[] }) {
      mocks.capturedOptions = options;
    }

    addEventListeners = mocks.addEventListeners;
  },
}));

const loadServiceWorker = async (): Promise<RuntimeCachingRoute[]> => {
  vi.resetModules();
  mocks.capturedOptions = null;
  await import("./sw");
  const capturedOptions =
    mocks.capturedOptions as CapturedSerwistOptions | null;
  return capturedOptions?.runtimeCaching ?? [];
};

const requestContext = ({
  headers,
  mode = "same-origin",
  pathname,
  sameOrigin = true,
}: {
  headers?: HeadersInit;
  mode?: RequestMode;
  pathname: string;
  sameOrigin?: boolean;
}) => {
  const url = new URL(pathname, "https://spendly.test");
  const request = new Request(url, { headers });
  Object.defineProperty(request, "mode", { value: mode });

  return {
    request,
    sameOrigin,
    url,
  };
};

describe("service worker runtime caching", () => {
  beforeEach(() => {
    mocks.addEventListeners.mockClear();
  });

  it("serves dynamic app documents, RSC payloads, and API reads from the network", async () => {
    const runtimeCaching = await loadServiceWorker();

    const dynamicRoutes = runtimeCaching.slice(0, 3);

    expect(dynamicRoutes).toHaveLength(3);
    expect(
      dynamicRoutes.every(
        (route) =>
          typeof route.handler === "object" &&
          route.handler !== null &&
          "strategy" in route.handler &&
          route.handler.strategy === "network-only"
      )
    ).toBe(true);
    expect(
      dynamicRoutes.some((route) =>
        route.matcher(
          requestContext({ pathname: "/api/dashboard/monthly-summary" })
        )
      )
    ).toBe(true);
    expect(
      dynamicRoutes.some((route) =>
        route.matcher(
          requestContext({
            headers: { RSC: "1" },
            pathname: "/",
          })
        )
      )
    ).toBe(true);
    expect(
      dynamicRoutes.some((route) =>
        route.matcher(
          requestContext({
            headers: { Accept: "text/html" },
            mode: "navigate",
            pathname: "/",
          })
        )
      )
    ).toBe(true);
    expect(runtimeCaching).toContain(mocks.defaultRuntimeRoute);
  });
});
