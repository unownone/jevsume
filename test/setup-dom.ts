import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

function createMatchMedia(matches = false) {
  return {
    matches,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

if (typeof window !== "undefined") {
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => createMatchMedia(false)),
    });
  } else {
    const original = window.matchMedia.bind(window);
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const result = original(query);
      return {
        ...result,
        addEventListener: result.addEventListener?.bind(result) ?? vi.fn(),
        removeEventListener: result.removeEventListener?.bind(result) ?? vi.fn(),
      };
    });
  }
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  class MockIntersectionObserver {
    constructor(_callback: IntersectionObserverCallback) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.IntersectionObserver = MockIntersectionObserver as typeof IntersectionObserver;
}
