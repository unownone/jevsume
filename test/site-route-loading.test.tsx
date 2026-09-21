/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SiteRouteLoadingShell } from "@/components/prosume/SiteRouteLoadingShell.tsx";

afterEach(() => {
  cleanup();
});

describe("SiteRouteLoadingShell", () => {
  it("exposes accessible status text without oversized skeleton placeholders", () => {
    render(
      <MemoryRouter initialEntries={["/review"]}>
        <SiteRouteLoadingShell />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading review studio");
    expect(screen.getByTestId("site-route-loading")).toHaveAttribute("aria-busy", "true");
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull();

    const tallBlocks = Array.from(document.querySelectorAll("[class*='h-64'],[class*='h-48'],[class*='max-w-3xl']"));
    expect(tallBlocks).toHaveLength(0);
  });

  it("includes reduced-motion-safe classes and CSS fallbacks", () => {
    render(
      <MemoryRouter initialEntries={["/review"]}>
        <SiteRouteLoadingShell />
      </MemoryRouter>,
    );

    expect(document.querySelector(".motion-reduce\\:animate-none")).toBeTruthy();
    expect(document.querySelector(".route-loading-bar")).toBeTruthy();

    const css = readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");
    expect(css).toContain(".route-loading-bar");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("maps route-specific status copy", () => {
    render(
      <MemoryRouter initialEntries={["/agents"]}>
        <SiteRouteLoadingShell />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading MCP setup");
  });
});
