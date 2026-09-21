/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { STUDIO_NARROW_QUERY, useStudioViewport } from "@/studio/useStudioViewport.ts";

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  return vi.fn().mockImplementation((query: string) => {
    expect(query).toBe(STUDIO_NARROW_QUERY);
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      dispatchEvent: vi.fn(),
      trigger() {
        for (const fn of listeners) {
          fn();
        }
      },
    };
  });
}

describe("useStudioViewport", () => {
  it("tracks narrow vs wide at the 1024 breakpoint", () => {
    const media = mockMatchMedia(true);
    vi.stubGlobal("matchMedia", media);
    const { result, unmount } = renderHook(() => useStudioViewport());
    expect(result.current.isNarrow).toBe(true);
    expect(result.current.isWide).toBe(false);
    unmount();
    vi.unstubAllGlobals();
  });
});
