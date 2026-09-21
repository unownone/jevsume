/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { useAnimatedScore } from "../src/lib/prosume-motion.ts";

function ScoreProbe() {
  const [target, setTarget] = useState(82);
  const shown = useAnimatedScore(target);
  return (
    <div>
      <output>{shown}</output>
      <button type="button" onClick={() => setTarget(65)}>
        lower
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useAnimatedScore", () => {
  it("jumps immediately when prefers-reduced-motion is reduce", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("reduce"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(<ScoreProbe />);
    await act(async () => {
      screen.getByRole("button", { name: "lower" }).click();
    });
    expect(screen.getByText("65")).toBeInTheDocument();
  });
});
