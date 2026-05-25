import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { createExpenseSyncScheduler } from "./scheduler";

const createDeferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, reject, resolve };
};

const queryClient = {} as QueryClient;

describe("expense sync scheduler", () => {
  it("runs a requested sync immediately when idle", async () => {
    const syncNow = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    const scheduler = createExpenseSyncScheduler({ onError, syncNow });

    await scheduler.request(queryClient);

    expect(syncNow).toHaveBeenCalledTimes(1);
    expect(syncNow).toHaveBeenCalledWith(queryClient);
    expect(onError).not.toHaveBeenCalled();
  });

  it("serializes overlapping requests and collapses them into one follow-up run", async () => {
    const firstRun = createDeferred();
    const secondRun = createDeferred();
    const firstQueryClient = { id: "first" } as unknown as QueryClient;
    const secondQueryClient = { id: "second" } as unknown as QueryClient;
    const thirdQueryClient = { id: "third" } as unknown as QueryClient;
    const syncNow = vi
      .fn()
      .mockReturnValueOnce(firstRun.promise)
      .mockReturnValueOnce(secondRun.promise);
    const scheduler = createExpenseSyncScheduler({
      onError: vi.fn(),
      syncNow,
    });

    const firstRequest = scheduler.request(firstQueryClient);
    const secondRequest = scheduler.request(secondQueryClient);
    const thirdRequest = scheduler.request(thirdQueryClient);

    expect(syncNow).toHaveBeenCalledTimes(1);
    expect(syncNow).toHaveBeenNthCalledWith(1, firstQueryClient);
    expect(secondRequest).toBe(firstRequest);
    expect(thirdRequest).toBe(firstRequest);

    firstRun.resolve();
    await vi.waitFor(() => expect(syncNow).toHaveBeenCalledTimes(2));
    expect(syncNow).toHaveBeenNthCalledWith(2, thirdQueryClient);

    secondRun.resolve();
    await Promise.all([firstRequest, secondRequest, thirdRequest]);

    expect(syncNow).toHaveBeenCalledTimes(2);
  });

  it("keeps draining a queued follow-up even when the current sync fails", async () => {
    const secondRun = createDeferred();
    const syncError = new Error("Offline");
    const syncNow = vi
      .fn()
      .mockRejectedValueOnce(syncError)
      .mockReturnValueOnce(secondRun.promise);
    const onError = vi.fn();
    const scheduler = createExpenseSyncScheduler({ onError, syncNow });

    const firstRequest = scheduler.request(queryClient);
    const secondRequest = scheduler.request(queryClient);

    await vi.waitFor(() => expect(syncNow).toHaveBeenCalledTimes(2));
    secondRun.resolve();
    await Promise.all([firstRequest, secondRequest]);

    expect(onError).toHaveBeenCalledWith(syncError);
    expect(syncNow).toHaveBeenCalledTimes(2);
  });

  it("starts a new run after the previous queue drains", async () => {
    const syncNow = vi.fn().mockResolvedValue(undefined);
    const scheduler = createExpenseSyncScheduler({
      onError: vi.fn(),
      syncNow,
    });

    await scheduler.request(queryClient);
    await scheduler.request(queryClient);

    expect(syncNow).toHaveBeenCalledTimes(2);
  });
});
