/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { SiteAppRoutes } from "@/SiteApp.tsx";
import { LegacyViewRedirect } from "@/components/prosume/LegacyViewRedirect.tsx";
import { resolveSiteRoute, sitePath } from "@/lib/routes.ts";
import { hostedMcpUrl } from "@/lib/mcp-snippets.ts";
import { AGENTS_PATH, MCP_PATH } from "@/lib/site-links.ts";
import { readFileSync } from "node:fs";
import path from "node:path";

afterEach(() => {
  cleanup();
});

function renderSiteAt(initialEntries: string[]) {
  const router = createMemoryRouter([{ path: "/*", element: <SiteAppRoutes /> }], { initialEntries });
  return render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
}

describe("UAT: route loading and navigation", () => {
  it("loads landing, review scene fixture, agents, and classic routes", async () => {
    const router = createMemoryRouter([{ path: "/*", element: <SiteAppRoutes /> }], { initialEntries: ["/"] });
    render(
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /See where your resume/i })).toBeInTheDocument();
    });

    await router.navigate("/review?scene=empty");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Drop a resume PDF/i })).toBeInTheDocument();
    });

    await router.navigate(AGENTS_PATH);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /MCP & agents/i })).toBeInTheDocument();
    });

    await router.navigate(sitePath("classic"));
    await waitFor(() => {
      expect(screen.getByText(/Review with clear Jev notes/i)).toBeInTheDocument();
    });
  });

  it("redirects legacy ?view=classic to /classic", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <>
              <LegacyViewRedirect />
              <div>home</div>
            </>
          ),
        },
        { path: sitePath("classic"), element: <div>classic</div> },
      ],
      { initialEntries: ["/?view=classic"] },
    );
    render(<RouterProvider router={router} />);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(sitePath("classic"));
    });
  });

  it("keeps /mcp as Worker endpoint only (no SPA route)", () => {
    expect(resolveSiteRoute(MCP_PATH)).toBe("landing");
    expect(MCP_PATH).toBe("/mcp");
    expect(AGENTS_PATH).toBe("/agents");
  });

  it("landing CTAs target /review and /agents", async () => {
    renderSiteAt(["/"]);
    await waitFor(() => expect(screen.getAllByRole("link", { name: /review/i }).length).toBeGreaterThan(0));
    const review = screen.getAllByRole("link", { name: /review/i }).find((a) => a.getAttribute("href") === "/review");
    expect(review).toBeTruthy();
    const agents = screen.getAllByRole("link", { name: /mcp/i }).find((a) => a.getAttribute("href") === "/agents");
    expect(agents).toBeTruthy();
  });
});

describe("UAT: agents page snippets and a11y affordances", () => {
  it("shows hosted snippet URL, copy controls, and mobile menu", async () => {
    const user = userEvent.setup();
    renderSiteAt([AGENTS_PATH]);
    await waitFor(() => screen.getByText(/Hosted MCP \(all URL-based clients\)/i));
    const snippet = screen.getAllByRole("code").find((node) => node.textContent?.includes(hostedMcpUrl(window.location.origin)));
    expect(snippet?.textContent).toContain(hostedMcpUrl(window.location.origin));
    expect(screen.getAllByRole("button", { name: "Copy" }).length).toBeGreaterThan(0);

    const menu = screen.getByRole("button", { name: /open menu/i });
    expect(menu.className).toMatch(/md:hidden/);
    await user.click(menu);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  it("agents hosted panel distinguishes Worker endpoint from setup page", async () => {
    renderSiteAt([AGENTS_PATH]);
    await waitFor(() => {
      expect(screen.getAllByText(new RegExp(MCP_PATH)).length).toBeGreaterThan(0);
      expect(screen.getByText(/not the setup page at \/agents/i)).toBeInTheDocument();
    });
  });
});

describe("UAT: review studio empty scene interactions", () => {
  it("shows demo load control on empty scene", async () => {
    renderSiteAt(["/review?scene=empty"]);
    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: /Drop a resume PDF/i })).toBeInTheDocument();
        expect(screen.getByText("Load demo PDF")).toBeInTheDocument();
      },
      { timeout: 8000 },
    );
  });
});

describe("UAT: reduced motion styling", () => {
  it("includes prefers-reduced-motion rules for studio animations", () => {
    const css = readFileSync(path.join(process.cwd(), "src/studio/semantic-bridge.css"), "utf8");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});

describe("UAT: keyboard focus and mobile shell", () => {
  it("mobile menu button is keyboard focusable on landing", async () => {
    renderSiteAt(["/"]);
    await waitFor(() => screen.getByRole("button", { name: /open menu/i }));
    const menu = screen.getByRole("button", { name: /open menu/i });
    menu.focus();
    expect(document.activeElement).toBe(menu);
  });
});
