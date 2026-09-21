import { trackClick } from "../lib/events.ts";
import {
  AGENTS_PATH,
  GITHUB_PROFILE_URL,
  GITHUB_REPO_URL,
  MCP_PATH,
  SPONSOR_URL,
} from "../lib/site-links.ts";

export function SiteFooter() {
  return (
    <footer className="site-footer border-t border-border/60 bg-background/80 px-4 py-6 md:px-6">
      <p className="site-footer-credit text-sm text-muted-foreground">
        Made by{" "}
        <a
          href={GITHUB_PROFILE_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackClick("/github-profile")}
        >
          UnownOne
        </a>
        {" · "}
        Pro-sume™ {new Date().getFullYear()}
      </p>
      <nav className="site-footer-links flex flex-wrap gap-3 text-sm" aria-label="Project">
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackClick("/github")}
        >
          <GitHubMark />
          GitHub
        </a>
        <a href={AGENTS_PATH} onClick={() => trackClick("/agents")}>
          MCP setup
        </a>
        <a
          href={MCP_PATH}
          title="Hosted MCP HTTP endpoint"
          onClick={() => trackClick("/mcp-endpoint")}
        >
          Hosted {MCP_PATH}
        </a>
        <a
          href={SPONSOR_URL}
          target="_blank"
          rel="noreferrer"
          title="Sponsor on GitHub"
          onClick={() => trackClick("/sponsor")}
        >
          <CoffeeMark />
          Sponsor
        </a>
      </nav>
    </footer>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8"
      />
    </svg>
  );
}

function CoffeeMark() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M3 3.5h7.25v5.25A3.25 3.25 0 017 12H6.25A3.25 3.25 0 013 8.75V3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10.25 5h1.2a1.85 1.85 0 010 3.7h-1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M4.2 14h6.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
