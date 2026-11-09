# Agensi listing: jevsume-resume

Upload artifact: `pnpm skill:pack` writes `dist/jevsume-resume.zip` (`jevsume-resume/SKILL.md` + `references/mcp.md`). Upload it at [agensi.io/sell](https://www.agensi.io/sell).

## Before submitting

- [ ] Hosted resumes are not publicly readable (`GET /api/resumes` and `GET /api/resumes/:id` currently return stored resume text to anyone).
- [ ] `https://resume.ikr.one/mcp` answers `tools/list`.
- [ ] `pnpm test` passes (includes the self-contained skill check).
- [ ] Payout method connected in Creator Studio (paid listings only).

## Listing fields

**Name:** Jevsume ATS Resume Proctor

**Tagline:** Score a resume for ATS parseability and job match, then rewrite only the weak bullets.

**Category:** Career / Writing

**Tags:** resume, ats, job-search, career, cv, job-description, rewriting

**Supported agents:** Claude Code, Claude Desktop, Cursor, Codex, and any MCP client that supports Streamable HTTP or stdio servers.

**Price:** Free. The skill is open source in this repo and drives the free hosted endpoint, and Agensi rejects repackaged free skills sold for a price. Charge later only for something not in the public repo.

**Description:**

Your agent reviews a resume the way an ATS parser reads it, using Jev typed scoring instead of LLM opinion. It returns two numbers, a conformity score for wording, structure, metrics, and parseability, and a job match score when you paste a job description. It also lists the specific lines to fix.

The agent then rewrites only the bullets Jev flagged, keeps your real numbers, and re-scores until the gaps are closed or intentional. It never invents scores, employers, or metrics.

- Paste a job description for a per-job match, or pick one of 34 baked-in role lenses across engineering, infrastructure, data, product, design, sales, marketing, and operations.
- Compact JSON results keep agent context small.
- Works hosted with no API key, or locally with your own TypeSafe key.

**Requirements:** The jevsume MCP server (setup for each agent is inside the skill).

**Data and network disclosure:** Resume text and any pasted job text are sent to `resume.ikr.one` (hosted) or `api.typesafe.ai` (local mode). Hosted reviews are stored server-side for scoring history. The skill makes no other network calls and runs no scripts.

**Links:** Website https://resume.ikr.one · Source https://github.com/unownone/jevsume
