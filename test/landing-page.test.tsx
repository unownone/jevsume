/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { metadataForRoute } from "../src/lib/site-metadata.ts";
import LandingPage from "../src/pages/LandingPage.tsx";

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
});

describe("page metadata", () => {
  it("sets distinct titles per route", () => {
    expect(metadataForRoute("landing").title).toMatch(/Pro-sume/);
    expect(metadataForRoute("agents").title).toMatch(/MCP/);
    expect(metadataForRoute("review").title).toMatch(/Review studio/);
  });
});
