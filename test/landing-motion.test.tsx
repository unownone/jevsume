/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import path from "node:path";
import LandingPage from "../src/pages/LandingPage.tsx";
import { useInViewOnce } from "../src/components/landing/useInViewOnce.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("landing scroll reveal", () => {
  it("keeps below-fold sections pending before intersection", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(document.querySelector('[data-landing-section="telemetry"]')).toHaveAttribute("data-landing-reveal", "pending");
    expect(document.querySelector('[data-landing-section="pipeline"]')).toHaveAttribute("data-landing-reveal", "pending");
    expect(document.querySelector('[data-landing-section="hero"]')).toHaveAttribute("data-landing-reveal", "shown");
  });

  it("useInViewOnce stays false in tests without live intersection", () => {
    function Probe() {
      const { visible } = useInViewOnce<HTMLDivElement>();
      return <div data-visible={visible ? "yes" : "no"} />;
    }
    render(<Probe />);
    expect(document.querySelector("[data-visible]")).toHaveAttribute("data-visible", "no");
  });
});

describe("landing interactive motion", () => {
  it("updates hero lens readout and control state on toggle", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    const targeted = screen.getByRole("tab", { name: "Role-targeted" });
    fireEvent.click(targeted);
    expect(targeted).toHaveAttribute("data-landing-control-state", "active");
    expect(screen.getByText("Staff engineer · platform lens")).toBeInTheDocument();
  });

  it("switches telemetry preset and dimension selection", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Metrics gap" }));
    expect(document.querySelectorAll("[data-landing-motion-bar]").length).toBeGreaterThan(0);

    const dimensionCards = document.querySelectorAll("[data-landing-dimension-state]");
    fireEvent.click(dimensionCards[0]!);
    expect(dimensionCards[0]).toHaveAttribute("data-landing-dimension-state", "selected");
  });
});

describe("landing reduced motion", () => {
  it("uses pending/shown reveal markers and reduced-motion fallback in CSS", () => {
    const css = readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");
    expect(css).toContain('[data-landing-reveal="pending"]');
    expect(css).toContain('[data-landing-reveal="shown"]');
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("bypasses pending reveal when prefers-reduced-motion is enabled", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(document.querySelector('[data-landing-section="telemetry"]')).toHaveAttribute("data-landing-reveal", "shown");
  });
});
