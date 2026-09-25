---
name: jevsume-resume
description: Proctor and improve a resume with Jev via the jevsume MCP. Use when reviewing, scoring, or rewriting a resume against a job, ATS parseability, or a baked-in role lens.
---

# Jevsume resume proctor

Jev **scores** a resume. It does not write essays. You call MCP tools, then rewrite specific lines from the findings.

## Connect (once)

- **Hosted:** MCP URL `https://<jevsume-host>/mcp` (no auth).
- **Local:** `npx -y github:unownone/jevsume -- --api-key $TYPESAFE_API_KEY`

Details: [references/mcp.md](references/mcp.md)

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
- Do not claim ATS or recruiter guarantees. Report Jev’s numbers and the lines to change.
