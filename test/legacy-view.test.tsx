/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { render, waitFor } from "@testing-library/react";
import { LegacyViewRedirect } from "../src/components/prosume/LegacyViewRedirect.tsx";
import { sitePath } from "../src/lib/routes.ts";

describe("legacy ?view=classic", () => {
  it("redirects to /classic while preserving other query params", async () => {
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
      { initialEntries: ["/?view=classic&foo=1"] },
    );
    render(<RouterProvider router={router} />);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(sitePath("classic"));
      expect(router.state.location.search).toBe("?foo=1");
    });
  });
});
