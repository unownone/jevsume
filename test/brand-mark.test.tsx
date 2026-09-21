/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BrandMark } from "../src/components/prosume/BrandMark.tsx";

describe("BrandMark", () => {
  it("uses the Stitch-aligned Pro-sume logo asset", () => {
    const { container } = render(<BrandMark />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/prosume-mark.svg");
  });
});
