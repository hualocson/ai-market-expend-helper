import { defaultCache } from "@serwist/next/worker";
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist";
import { NetworkOnly, Serwist } from "serwist";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const dynamicAppRuntimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url: { pathname } }) =>
      sameOrigin && pathname.startsWith("/api/"),
    method: "GET",
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request, sameOrigin, url: { pathname } }) =>
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      request.headers.get("RSC") === "1",
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request, sameOrigin, url: { pathname } }) =>
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      (request.mode === "navigate" ||
        request.destination === "document" ||
        request.headers.get("Accept")?.includes("text/html")),
    handler: new NetworkOnly(),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...dynamicAppRuntimeCaching, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
