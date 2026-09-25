/** Shipped MCP tool surface (Worker + local stdio). */
export const AGENTS_MCP_TOOLS = [
  {
    name: "list_job_lenses",
    description: "List baked-in job lenses (id, title, track, level, tags, blurb). No job text.",
    args: "track?, query?",
  },
  {
    name: "get_job_lens",
    description: "Fetch one baked-in job listing by id. Call only when you must quote the JD.",
    args: "id",
  },
  {
    name: "suggest_job_lens",
    description: "Pick the closest baked-in lens for a resume. Returns one compact item.",
    args: "resumeText",
  },
  {
    name: "review_resume",
    description:
      "Score a resume with Jev. Returns conformity and job-match scores, plus expected, good-to-have, missing, available, and skill-gap sections.",
    args: "resumeText, jobLensId?, jobText?, jobTitle?, company?, jobUrl?",
  },
] as const;
