import { afterEach, describe, expect, it, vi } from "vitest";

import { compressImage } from "./compress-image";

describe("compressImage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("resizes the longest edge to <= maxEdge and returns a jpeg data url", async () => {
    const drawImage = vi.fn();
    const toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,ZZZZ");
    const getContext = vi.fn().mockReturnValue({ drawImage });
    const canvas = {
      width: 0,
      height: 0,
      getContext,
      toDataURL,
    } as unknown as HTMLCanvasElement;

    vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
      tag === "canvas"
        ? canvas
        : ({} as HTMLElement)) as typeof document.createElement);

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    // Stub Image so onload fires immediately with a wide source (2000x1000).
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 2000;
      height = 1000;
      set src(_v: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal("Image", FakeImage as unknown as typeof Image);

    const file = new File(["x"], "r.jpg", { type: "image/jpeg" });
    const result = await compressImage(file, { maxEdge: 1280, quality: 0.7 });

    expect(result).toBe("data:image/jpeg;base64,ZZZZ");
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(640);
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.7);
  });
});
