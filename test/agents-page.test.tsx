/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import AgentsPage from "../src/pages/AgentsPage.tsx";
import { hostedMcpUrl } from "@/lib/mcp-snippets.ts";
import { LOCAL_MCP_COMMAND, MCP_PATH } from "@/lib/site-links.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderAgents() {
  return render(
    <TooltipProvider>
      <MemoryRouter>
        <AgentsPage />
      </MemoryRouter>
    </TooltipProvider>,
  );
}

describe("agents page UAT", () => {
  it("documents hosted and local MCP modes in primary tabs", async () => {
    const user = userEvent.setup();
    renderAgents();
    expect(screen.getByRole("heading", { name: /Bring Pro-sume into your AI assistant/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Option 01 · Hosted endpoint/i })).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(MCP_PATH)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("tab", { name: /Option 02 · Local stdio/i }));
    const localPanel = screen.getByRole("tabpanel", { name: /Option 02 · Local stdio/i });
    expect(within(localPanel).getByRole("code").textContent).toMatch(/TYPESAFE_API_KEY/);
    expect(within(localPanel).getByRole("code").textContent).toMatch(new RegExp(LOCAL_MCP_COMMAND));
  });

  it("switches client tabs and hides inactive panel content", async () => {
    const user = userEvent.setup();
    renderAgents();
    const clientTabs = screen.getByRole("tablist", { name: /MCP client host/i });
    const cursorPanel = screen.getByRole("tabpanel", { name: "Cursor" });
    expect(within(cursorPanel).getAllByRole("code").some((n) => n.textContent?.includes("mcpServers"))).toBe(true);

    await user.click(within(clientTabs).getByRole("tab", { name: "Claude Desktop" }));
    const claudePanel = screen.getByRole("tabpanel", { name: "Claude Desktop" });
    expect(claudePanel).toBeVisible();
    expect(cursorPanel).toHaveAttribute("hidden");
  });

  it("supports keyboard navigation between client tabs", async () => {
    const user = userEvent.setup();
    renderAgents();
    const cursorTab = screen.getByRole("tab", { name: "Cursor" });
    cursorTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Claude Desktop" })).toHaveFocus();
  });

  it("exposes hero and workbench CTAs to /review", () => {
    renderAgents();
    const reviewLinks = screen.getAllByRole("link", { name: /Review resume/i });
    expect(reviewLinks.length).toBeGreaterThan(0);
    for (const link of reviewLinks) {
      expect(link).toHaveAttribute("href", "/review");
    }
  });

  it("shows hosted JSON for cursor client in hosted mode", () => {
    renderAgents();
    const panel = screen.getByRole("tabpanel", { name: "Cursor" });
    const json = within(panel).getAllByRole("code").find((n) => n.textContent?.includes("mcpServers"));
    expect(json?.textContent).toContain(hostedMcpUrl(window.location.origin));
  });

  it("shows local snippet when local connection tab is active", async () => {
    const user = userEvent.setup();
    renderAgents();
    await user.click(screen.getByRole("tab", { name: /Option 02 · Local stdio/i }));
    const panel = screen.getByRole("tabpanel", { name: "Cursor" });
    const json = within(panel).getAllByRole("code").find((n) => n.textContent?.includes("YOUR_TYPESAFE_API_KEY"));
    expect(json?.textContent).toContain("YOUR_TYPESAFE_API_KEY");
  });

  it("lists shipped MCP tool names", () => {
    renderAgents();
    expect(screen.getByText("list_job_lenses")).toBeInTheDocument();
    expect(screen.getByText("review_resume")).toBeInTheDocument();
    expect(screen.queryByText(/prosume_review_resume/i)).not.toBeInTheDocument();
  });

  it("includes reduced-motion classes on animated tab panels", () => {
    renderAgents();
    const panel = screen.getByRole("tabpanel", { name: "Cursor" });
    expect(panel.className).toMatch(/motion-reduce:animate-none/);
    expect(panel.className).toMatch(/motion-safe:animate-in/);
  });

  it("shows clipboard feedback when copying hosted JSON", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    renderAgents();
    const copyButtons = screen.getAllByRole("button", { name: /Copy JSON/i });
    await user.click(copyButtons[0]);
    expect(writeText).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /Copied to clipboard/i })).toBeInTheDocument();
  });
});
