/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DiagnosticsRail } from "@/studio/DiagnosticsRail.tsx";
import { DEMO_FINDINGS } from "@/studio/demo.ts";
import { studioCopy } from "@/lib/site-copy.ts";
describe("DiagnosticsRail", () => {
  it("fires onSelect", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<MemoryRouter><DiagnosticsRail findings={DEMO_FINDINGS} activeId={null} reading={false} onSelect={onSelect} onHover={vi.fn()} /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /Summary sells a vibe/i }));
    expect(onSelect).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: studioCopy.mcpCta })).toBeInTheDocument();
  });
});
