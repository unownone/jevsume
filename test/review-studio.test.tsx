/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { SiteAppRoutes } from "@/SiteApp.tsx";
afterEach(() => cleanup());
function renderReview(scene: string) {
  vi.stubGlobal("location", { ...window.location, pathname: "/review", search: `?scene=${scene}` });
  const router = createMemoryRouter([{ path: "/*", element: <SiteAppRoutes /> }], { initialEntries: [`/review?scene=${scene}`] });
  return render(<TooltipProvider><RouterProvider router={router} /></TooltipProvider>);
}
describe("review studio", () => {
  it("empty scene", async () => {
    renderReview("empty");
    await waitFor(() => expect(screen.getByRole("heading", { name: /Drop a resume PDF/i })).toBeInTheDocument());
    expect(document.querySelector(".studio")?.getAttribute("data-studio-scene")).toBe("empty");
  });
});
