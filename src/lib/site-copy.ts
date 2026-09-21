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
  heroPreviewEyebrow: "Target lens",
  heroPreviewLenses: [
    { id: "general", label: "General" },
    { id: "targeted", label: "Role-targeted" },
  ] as const,
  heroPreviewLensReadouts: {
    general: "General resume review",
    targeted: "Staff engineer · platform lens",
  } as const,
  heroPreviewDropTitle: "Drag & drop your resume (PDF)",
  heroPreviewDropHint: "or open the review studio to browse files",
  heroPreviewSample: "Try the demo PDF in the studio",
  telemetryIndex: "01",
  telemetrySlug: "LIVE_TELEMETRY",
  telemetryTitle: "Interactive forensic diagnostic",
  telemetryStatus: "Demo · typed JevScore dimensions",
  telemetryScoreLabel: "Sample JevScore",
  telemetryScoreHint: "Illustrative aggregate from a demo run—not your document.",
  telemetryPresets: [
    {
      id: "balanced",
      label: "Balanced",
      score: 82,
      dimensions: [
        { label: "Structure & parsing", value: 76, hint: "Sections the extractor could map cleanly." },
        { label: "Action verbs & tone", value: 85, hint: "Active voice and clarity on key bullets." },
        { label: "Quantified impact", value: 68, hint: "Metrics and outcomes called out explicitly.", warn: true },
      ],
    },
    {
      id: "metrics",
      label: "Metrics gap",
      score: 71,
      dimensions: [
        { label: "Structure & parsing", value: 74, hint: "Sections the extractor could map cleanly." },
        { label: "Action verbs & tone", value: 79, hint: "Active voice and clarity on key bullets." },
        { label: "Quantified impact", value: 52, hint: "Metrics and outcomes called out explicitly.", warn: true },
      ],
    },
  ] as const,
  telemetryFixTitle: "Priority diagnostic fix",
  telemetryFixImpact: "Example impact +14 pts",
  telemetryFixOriginalLabel: "Original formulation",
  telemetryFixOriginal:
    "Helped improve platform reliability and worked with cross-functional teams on various initiatives.",
  telemetryFixSuggestedLabel: "Suggested quantified rewrite",
  telemetryFixSuggested:
    "Reduced incident volume 22% by leading a cross-team reliability program across 85,000 active accounts.",
  telemetryFixCopy: "Copy suggestion",
  telemetryPreviewFile: "sample_resume.pdf",
  telemetryPreviewBadge: "Demo · parser-ready text",
  integrationIndex: "02",
  integrationSlug: "INTEGRATION_WORKFLOWS",
  integrationTitle: "Choose how you inspect and refine",
  integrationBody:
    "Use the in-browser review studio on this Worker, or connect the same Jev tools through MCP in the assistant you already use.",
  integrationWebTitle: "Instant web review",
  integrationWebPoints: [
    "Upload or paste on /review—the same API the Worker scores.",
    "JevScore, dimension bars, and suggestions composed in the UI.",
    "Copy suggestions yourself; Jev does not rewrite the PDF.",
  ] as const,
  integrationWebCta: "Launch in-browser review",
  integrationMcpTitle: "MCP for AI agents",
  integrationMcpPoints: [
    "Model Context Protocol tools: review_resume and job lenses.",
    "Hosted Streamable HTTP at /mcp or local stdio with your TypeSafe key.",
    "Setup snippets for Cursor, Claude, Codex, and generic hosts.",
  ] as const,
  integrationMcpCta: "View MCP integration setup",
  proofEyebrow: "What you can verify",
  proofHeadline: "Typed judgments, visible telemetry, and two connection modes—without marketing fluff.",
  proofCards: [
    {
      title: "Jev judges; UI composes",
      body: "Scores and findings come from System One calls. Readable copy and bars are assembled in the app—not a generic chat rewrite.",
    },
    {
      title: "Telemetry per run",
      body: "The studio reports server time, token counts, and estimated input cost when the Worker returns them. Timing and spend vary by resume length and provider.",
    },
    {
      title: "Hosted or local MCP",
      body: "Use the browser studio on this origin, call /mcp without an API key, or run local stdio with TYPESAFE_API_KEY on your machine.",
    },
  ] as const,
  trustItems: [
    "No automatic resume rewrite",
    "Typed System One judgments",
    "Browser studio or MCP",
  ] as const,
} as const;

/** Patterns that must not appear in public landing copy (unsupported or invented claims). */
export const LANDING_FORBIDDEN_PATTERNS = [
  /25,?000/i,
  /100%\s*private/i,
  /zero data retention/i,
  /standard ats compliant/i,
  /under a second/i,
  /\$0\.042/,
  /automatic(ally)?\s*rewrite/i,
  /1\.4k/i,
] as const;

export const reviewCopy = {
  heroTitle: "Drop a resume PDF",
  heroBody:
    "The page stays the page. Jev reads underneath, scores sections, and pins notes to regions you can open.",
  linkedInSoon:
    "LinkedIn PDF export will use the same studio when it ships. Not wired yet.",
} as const;

export const studioCopy = {
  diagnosticsTitle: "Actionable diagnostics",
  diagnosticsHint: "Open a row to inspect the passage on the page. Jev does not rewrite the PDF.",
  inspectCta: "Inspect in source",
  mcpCardTitle: "MCP for agents",
  mcpCardBody: "Same review_resume tools on this Worker or local stdio with your TypeSafe key.",
  mcpCta: "MCP setup",
} as const;

export const STUDIO_FORBIDDEN_PATTERNS = LANDING_FORBIDDEN_PATTERNS;

export const agentsCopy = {
  eyebrow: "Model Context Protocol · Jev review tools",
  title: "Bring Pro-sume into your AI assistant",
  intro:
    "Connect Claude, Claude Code, Codex, Codex Chat, Cursor, or any MCP host to the same Jev lenses and review_resume flow—hosted on this Worker or locally with your TypeSafe key.",
  protocolLabel: "Protocol",
  protocolValue: "Streamable HTTP",
  gatewayLabel: "Worker endpoint",
  gatewayValue: "Ready · /mcp",
  hostedTitle: "Hosted endpoint",
  hostedBadge: "No API key",
  hostedBody:
    "Streamable HTTP at /mcp on this origin. No auth yet. review_resume shares the platform IP rate limit with POST /api/reviews. This is the Worker route—not the setup page at /agents.",
  localTitle: "Local stdio",
  localBadge: "Your TypeSafe key",
  localBody:
    "Runs on your machine with TYPESAFE_API_KEY. Reviews call api.typesafe.ai and do not use the hosted Worker rate limit.",
  workbenchEyebrow: "Integration workbench",
  workbenchTitle: "Client configuration guide",
  workbenchHint: "Pick a host, then copy the block for your connection mode above.",
  toolsEyebrow: "Exposed tools",
  toolsTitle: "Available MCP capabilities",
  activationTitle: "Activation steps",
  activationSteps: [
    "Copy the config block into the path shown for your host.",
    "Restart or reload the MCP host so it picks up the server.",
    "In chat, ask the agent to call review_resume or list_job_lenses with resume text.",
  ] as const,
  heroReviewCta: "Review resume",
  heroConnectCta: "Jump to client configs",
  footerReviewCta: "Open review studio",
  footerMcpCta: "Copy hosted URL",
  privacyTitle: "Privacy & limits",
  privacyBody:
    "Hosted reviews use the same Worker path as the browser studio. Local MCP keeps TYPESAFE_API_KEY in your host environment—never commit keys. See docs/mcp-local.md for env setup.",
} as const;
