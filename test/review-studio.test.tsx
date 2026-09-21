/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { SiteAppRoutes } from "@/SiteApp.tsx";
import { STUDIO_NARROW_QUERY } from "@/studio/useStudioViewport.ts";
import { studioCopy } from "@/lib/site-copy.ts";

afterEach(() => cleanup());

function mockViewport(narrow: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query === STUDIO_NARROW_QUERY ? narrow : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function renderReview(scene: string, narrow = false) {
  mockViewport(narrow);
  vi.stubGlobal("location", { ...window.location, pathname: "/review", search: `?scene=${scene}` });
  const router = createMemoryRouter([{ path: "/*", element: <SiteAppRoutes /> }], {
    initialEntries: [`/review?scene=${scene}`],
  });
  return render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
}

describe("review studio shell", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("empty scene uses unified studio shell", async () => {
    renderReview("empty");
    await waitFor(() => expect(screen.getByRole("heading", { name: /Drop a resume PDF/i })).toBeInTheDocument());
    const studio = document.querySelector(".studio");
    expect(studio).toHaveAttribute("data-studio-scene", "empty");
    expect(studio).toHaveAttribute("data-studio-viewport");
    expect(screen.queryByRole("banner", { name: /jevsume/i })).not.toBeInTheDocument();
  });

  it("loaded scene shows paper workspace and dock", async () => {
    renderReview("loaded");
    await waitFor(() => expect(document.querySelector(".paper-stack")).toBeInTheDocument());
    expect(document.querySelector(".studio")).toHaveAttribute("data-studio-scene", "loaded");
    expect(screen.getByRole("toolbar", { name: /Page tools/i })).toBeInTheDocument();
  });

  it("reviewed scene uses reviewed shell with diagnostics rail on wide", async () => {
    renderReview("reviewed", false);
    await waitFor(() => expect(document.querySelector(".studio")).toHaveAttribute("data-studio-scene", "reviewed"));
    expect(document.querySelector(".studio")).toHaveAttribute("data-studio-viewport", "wide");
    expect(document.querySelector('[data-studio-panel="diagnostics"]')).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: /Page tools/i })).toBeInTheDocument();
  });

  it("narrow reviewed scene keeps the same shell and exposes diagnostics drawer control", async () => {
    renderReview("reviewed", true);
    await waitFor(() => expect(document.querySelector(".studio")).toHaveClass("is-narrow"));
    expect(document.querySelector(".diagnostics-rail-wrap")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Diagnostics$/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Diagnostics$/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: studioCopy.diagnosticsTitle })).toBeInTheDocument(),
    );
  });

  it("escape closes mobile diagnostics sheet", async () => {
    renderReview("reviewed", true);
    await waitFor(() => screen.getByRole("button", { name: /^Diagnostics$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Diagnostics$/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: studioCopy.diagnosticsTitle })).toBeInTheDocument(),
    );
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: studioCopy.diagnosticsTitle })).not.toBeInTheDocument(),
    );
  });

  it("dock zoom controls adjust readout without scaling the studio root", async () => {
    renderReview("loaded", false);
    await waitFor(() => screen.getByRole("toolbar", { name: /Page tools/i }));
    const studio = document.querySelector(".studio") as HTMLElement;
    const before = studio.style.getPropertyValue("--zoom") || "1";
    const toolbar = screen.getByRole("toolbar", { name: /Page tools/i });
    await userEvent.click(within(toolbar).getByRole("button", { name: "+" }));
    await waitFor(() => {
      const after = studio.style.getPropertyValue("--zoom");
      expect(Number(after)).toBeGreaterThan(Number(before));
    });
  });
});
