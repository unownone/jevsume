import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} } as typeof ResizeObserver;
}
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })) });
}
