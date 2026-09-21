/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Button } from "../src/components/ui/button.tsx";

describe("button component", () => {
  it("exposes default and outline variants for actions", () => {
    render(
      <MemoryRouter>
        <>
          <Button>Primary</Button>
          <Button variant="outline">Secondary</Button>
        </>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Secondary" })).toBeInTheDocument();
  });
});
