export const BRAND_NAME = "Pro-sume";
export const BRAND_TAGLINE = "Pro resume feedback";
export const TYPESAFE_URL = "https://typesafe.ai";
export const TYPESAFE_SYSTEM_ONE = "TypeSafe System One";

export const landingCopy = {
  eyebrow: "Resume review · typed scores · no auto-rewrite",
  heroTitle: "See where your resume fails the parser—and the hiring lens.",
  heroBody:
    "Pro-sume extracts text the way an ATS would, runs Jev (System One) questions, and composes a JevScore with findings you can act on. Jev judges; the UI writes the readable copy.",
  primaryCta: "Review your resume",
  secondaryCta: "Connect via MCP",
  pipelineTitle: "How a review runs",
  pipelineSteps: [
    {
      title: "Parse",
      body: "PDF or paste becomes structured text—the same input the Worker scores.",
    },
    {
      title: "Lens",
      body: "Pick a general persona or target a job description with tags.",
    },
    {
      title: "Judge",
      body: "Jev returns typed verdicts and probabilities; nothing is rewritten for you.",
    },
    {
      title: "Compose",
      body: "The app builds JevScore, dimension bars, and suggestions from those judgments.",
    },
  ],
  typesafeTitle: "Powered by TypeSafe System One",
  typesafeBody:
    "Jev is the typed judgment engine behind fast reviews. Scores and findings come from System One calls—not a generic chat completion.",
  proofTitle: "Honest about limits",
  proofBody:
    "Telemetry in the UI reports what each run actually used—server time, token counts, and estimated input cost from the Worker. Timing and spend depend on resume length, persona depth, and whether you use the mock provider or live Jev.",
  accuracyTitle: "Accurate about what ships",
  accuracyBody:
    "Notes attach to extracted text in the classic view and to PDF regions in the studio as overlays—drawing is manual, not automatic PDF editing.",
  closingTitle: "Ready when you are",
  closingPrimary: "Open the review studio",
  closingSecondary: "Set up MCP",
} as const;

export const reviewCopy = {
  heroTitle: "Drop a resume PDF",
  heroBody:
    "The page stays the page. Jev reads underneath, scores sections, and pins notes to regions you can open.",
  linkedInSoon:
    "LinkedIn PDF export will use the same studio when it ships. Not wired yet.",
} as const;

export const agentsCopy = {
  title: "MCP & agents",
  intro:
    "Run the same Jev review tools from Claude, Claude Code, Codex, Codex Chat, Cursor, or any MCP client—hosted on the Worker or locally with your key.",
  hostedTitle: "Hosted (no API key)",
  hostedBody:
    "Streamable HTTP at /mcp on this site. No auth yet. review_resume shares the platform IP rate limit with POST /api/reviews.",
  localTitle: "Local npx (your TypeSafe key)",
  localBody:
    "Runs on your machine with TYPESAFE_API_KEY. Reviews call api.typesafe.ai and do not use the hosted Worker rate limit.",
  privacyTitle: "Privacy & limits",
  privacyBody:
    "Hosted reviews stay on the Worker path you already use in the browser. Local MCP keeps keys in your host env—never commit them.",
} as const;
