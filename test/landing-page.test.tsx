/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import path from "node:path";
import { metadataForRoute } from "../src/lib/site-metadata.ts";
import { landingCopy, LANDING_FORBIDDEN_PATTERNS } from "../src/lib/site-copy.ts";
import LandingPage from "../src/pages/LandingPage.tsx";

const LANDING_SECTIONS = [
  "hero",
  "hero-preview",
  "telemetry",
  "pipeline",
  "integration",
  "truth",
  "proof",
  "trust-bar",
  "closing",
] as const;

afterEach(() => {
  cleanup();
});

describe("landing page UAT", () => {
  it("renders primary CTAs to review and agents routes", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    const reviewLinks = screen.getAllByRole("link", { name: /review/i });
    expect(reviewLinks.some((link) => link.getAttribute("href") === "/review")).toBe(true);
    const agentsLinks = screen.getAllByRole("link", { name: /mcp/i });
    expect(agentsLinks.some((link) => link.getAttribute("href") === "/agents")).toBe(true);
  });

  it("renders Stitch-aligned sections and numbered workflow headers", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    for (const section of LANDING_SECTIONS) {
      expect(document.querySelector(`[data-landing-section="${section}"]`)).toBeTruthy();
    }
    expect(screen.getByText(/01 \/\/ LIVE_TELEMETRY/i)).toBeInTheDocument();
    expect(screen.getByText(/02 \/\/ INTEGRATION_WORKFLOWS/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: landingCopy.pipelineTitle })).toBeInTheDocument();
    expect(screen.getByText(landingCopy.integrationWebTitle)).toBeInTheDocument();
    expect(screen.getByText(landingCopy.proofCards[0].title)).toBeInTheDocument();
  });

  it("applies reduced-motion fallbacks for landing scroll reveal", () => {
    const css = readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(".landing-reveal--visible");
  });
});

describe("page metadata", () => {
  it("sets distinct titles per route", () => {
    expect(metadataForRoute("landing").title).toMatch(/Pro-sume/);
    expect(metadataForRoute("agents").title).toMatch(/MCP/);
    expect(metadataForRoute("review").title).toMatch(/Review studio/);
  });

  it("does not promise fixed review speed or total cost on the landing page", () => {
    expect(landingCopy.proofBody).not.toMatch(/under a second/i);
    expect(landingCopy.proofBody).not.toMatch(/\$0\.042/);
  });

  it("avoids invented marketing claims across landing copy", () => {
    const blob = JSON.stringify(landingCopy);
    for (const pattern of LANDING_FORBIDDEN_PATTERNS) {
      expect(blob).not.toMatch(pattern);
    }
  });
});
