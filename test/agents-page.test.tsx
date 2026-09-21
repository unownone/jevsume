/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AgentsPage from "../src/pages/AgentsPage.tsx";

describe("agents page UAT", () => {
  it("documents hosted and local MCP modes", () => {
    render(
      <MemoryRouter>
        <AgentsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Hosted \(no API key\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Local npx/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TYPESAFE_API_KEY/i).length).toBeGreaterThan(0);
  });
});
