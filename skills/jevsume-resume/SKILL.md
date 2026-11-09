---
name: jevsume-resume
description: Score and improve a resume for ATS parseability and job match with Jev via the jevsume MCP. Use when reviewing, scoring, or rewriting a resume against a pasted job description or a baked-in role lens.
---

# Jevsume resume proctor

Jev **scores** a resume. It does not write essays. You call MCP tools, then rewrite specific lines from the findings.

## Connect (once)

If the `review_resume` tool is not available, ask the user to add the jevsume MCP server, then stop until it is connected.

- **Hosted (no key):** MCP URL `https://resume.ikr.one/mcp`
- **Local (own TypeSafe key):** `npx -y github:unownone/jevsume` with `TYPESAFE_API_KEY` in the server env

Per-agent configs (Cursor, Claude Code, Claude Desktop, Codex): [references/mcp.md](references/mcp.md)

## Data handling

Tell the user before the first review: resume text (and any pasted job text) is sent to the jevsume server — `resume.ikr.one` when hosted, or `api.typesafe.ai` when run locally with their key. Hosted reviews are stored for scoring history. If the user does not want that, stop. Strip phone numbers and street addresses first if they ask.

## Tools (keep context small)

| Tool | Use |
| --- | --- |
| `list_job_lenses` | Catalog of baked-in roles. Ids only. Optional `track` / `query`. |
| `suggest_job_lens` | One id from resume text. |
| `get_job_lens` | Full JD. **Skip** unless you must quote the listing. |
| `review_resume` | `resumeText` + optional `jobLensId` and/or `jobText`. |

Never pass PDFs. Extract text first. Never echo the full resume or JD back into the chat.

## Loop

1. If the user pasted a job, `review_resume` with `jobText` (and title/company if known).
2. Else `suggest_job_lens` or `list_job_lenses`, then `review_resume` with `jobLensId` (`default`, `swe-staff`, or `preset:swe-staff`).
3. Read compact JSON: `conformityScore`, `jobMatchScore` (null without a listing), `comparison` (expected, good to have, validated lines, missing, available, skill gap), plus `findings`, `suggestions`, and `gaps`.
4. Rewrite **only** the weak bullets. Keep numbers. Do not invent Jev scores.
5. `review_resume` again. Stop when the user is done or remaining gaps are intentional.

## Rules

- One lens per review. `jobText` wins over `jobLensId`.
- Prefer ids over fetching listings.
- If a tool returns `code: "rate_limited"`, wait `retryAfterSeconds`.
- Do not invent experience, employers, dates, or metrics the user did not give you. Ask instead.
- Do not claim ATS or recruiter guarantees. Report Jev’s numbers and the lines to change.
