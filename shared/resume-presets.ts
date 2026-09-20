import { EMPTY_JOB_TARGET, type JobTargetFields } from "./job-target.ts";

export const PRESET_PERSONA_PREFIX = "preset:";
export const DEFAULT_PRESET_ID = "swe-staff";
export const PRESET_CREATED_AT = "2026-09-20T00:00:00.000Z";

export const JOB_TRACKS = [
  "engineering",
  "infrastructure",
  "data",
  "product",
  "design",
  "sales",
  "marketing",
  "gtm",
  "people",
  "operations",
] as const;

export const JOB_LEVELS = [
  "intern",
  "junior",
  "mid",
  "senior",
  "staff",
  "lead",
  "manager",
  "director",
] as const;

export type JobTrack = (typeof JOB_TRACKS)[number];
export type JobLevel = (typeof JOB_LEVELS)[number];

export type ResumePreset = {
  id: string;
  track: JobTrack;
  level: JobLevel;
  title: string;
  company: string;
  tags: string[];
  blurb: string;
  jobText: string;
  resumeName: string;
  resumeText: string;
};

const TRACK_LABELS: Record<JobTrack, string> = {
  engineering: "Engineering",
  infrastructure: "Infrastructure",
  data: "Data & ML",
  product: "Product",
  design: "Design",
  sales: "Sales",
  marketing: "Marketing",
  gtm: "Outreach & CS",
  people: "People",
  operations: "Operations",
};

const LEVEL_LABELS: Record<JobLevel, string> = {
  intern: "Intern",
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
  staff: "Staff",
  lead: "Lead",
  manager: "Manager",
  director: "Director",
};

type Draft = {
  id: string;
  track: JobTrack;
  level: JobLevel;
  title: string;
  tags: string[];
  blurb: string;
  pitch: string;
  requirements: [string, string, string, ...string[]];
  resumeName: string;
  summary: string;
  experience: [string, string, ...string[]];
  skills: string;
  education: string;
};

function listing(title: string, pitch: string, requirements: string[]): string {
  return `${title}
${pitch}

Requirements
${requirements.map((line) => `- ${line}`).join("\n")}`;
}

function resumePage(input: {
  name: string;
  title: string;
  summary: string;
  experience: string[];
  skills: string;
  education: string;
}): string {
  return `${input.name}
${input.title}

Summary
${input.summary}

Experience
${input.experience.map((line) => `- ${line}`).join("\n")}

Skills
${input.skills}

Education
${input.education}
`;
}

function fromDraft(draft: Draft): ResumePreset {
  return {
    id: draft.id,
    track: draft.track,
    level: draft.level,
    title: draft.title,
    company: "Acme",
    tags: draft.tags,
    blurb: draft.blurb,
    jobText: listing(draft.title, draft.pitch, draft.requirements),
    resumeName: draft.resumeName,
    resumeText: resumePage({
      name: draft.resumeName,
      title: draft.title,
      summary: draft.summary,
      experience: draft.experience,
      skills: draft.skills,
      education: draft.education,
    }),
  };
}

const DRAFTS: Draft[] = [
  {
    id: "swe-intern",
    track: "engineering",
    level: "intern",
    title: "Software Engineering Intern",
    tags: ["internship", "python", "git"],
    blurb: "Coursework, shipped projects, and a first production pull request.",
    pitch: "Acme is hiring a summer intern who can land a small change in a real service.",
    requirements: [
      "Currently pursuing a CS or related degree",
      "Comfortable with Python or TypeScript in class projects",
      "Has used git on a shared repository",
      "Can describe a project they built from scratch",
    ],
    resumeName: "Alex Kim",
    summary: "CS junior who likes backend homework and campus hackathons.",
    experience: [
      "Built a campus lost-and-found API used by 40 students",
      "TA for intro programming, held weekly labs for 20 people",
    ],
    skills: "Python, Git, SQL, HTML",
    education: "B.S. Computer Science, State University (expected 2028)",
  },
  {
    id: "swe-junior",
    track: "engineering",
    level: "junior",
    title: "Junior Software Engineer",
    tags: ["javascript", "testing", "entry-level"],
    blurb: "First full-time IC who can ship tickets with tests, not just tutorials.",
    pitch: "Acme wants an entry-level engineer who already shipped something with a team.",
    requirements: [
      "0-2 years building web services or internships that shipped",
      "JavaScript or TypeScript in a real codebase",
      "Writes tests, not only happy-path demos",
      "Can work from a ticket and ask when blocked",
    ],
    resumeName: "Priya Shah",
    summary: "New grad who shipped intern work on a React dashboard.",
    experience: [
      "Intern: added billing filters to a React admin used by 8 operators",
      "Capstone: TypeScript CLI that batched CSV imports for a nonprofit",
    ],
    skills: "TypeScript, React, Jest, PostgreSQL",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "swe-mid",
    track: "engineering",
    level: "mid",
    title: "Software Engineer",
    tags: ["typescript", "apis", "ownership"],
    blurb: "Owns a service end to end: design, ship, watch it in production.",
    pitch: "Acme is hiring a software engineer who already owns a production API.",
    requirements: [
      "3+ years shipping backend or full-stack features",
      "Production TypeScript or Go services",
      "Owns on-call for something they built",
      "Works with product without a spec for every pixel",
    ],
    resumeName: "Sam Ortega",
    summary: "Software engineer who keeps a billing API boring and up.",
    experience: [
      "Shipped invoicing endpoints in TypeScript serving 12k monthly invoices",
      "Cut checkout errors 22% after adding idempotency keys",
      "On-call for billing; closed 9 sev-2s in two quarters",
    ],
    skills: "TypeScript, PostgreSQL, Redis, AWS",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "swe-senior",
    track: "engineering",
    level: "senior",
    title: "Senior Software Engineer",
    tags: ["golang", "design", "mentorship"],
    blurb: "Designs the hard path, reviews seniors' work, and still ships.",
    pitch: "Acme needs a senior who can design a service and still write the first cut.",
    requirements: [
      "5+ years building production services",
      "Leads design for a multi-service change",
      "Reviews and unblocks other engineers",
      "Go or equivalent systems language in production",
    ],
    resumeName: "Riley Chen",
    summary: "Senior engineer for payments APIs who still writes the first design.",
    experience: [
      "Designed a ledger rewrite in Go that cut reconcile time from 6h to 40m",
      "Reviewed 80+ PRs a quarter and unblocked two mid-level engineers",
      "Rolled out retries that dropped payment timeouts 31%",
    ],
    skills: "Go, PostgreSQL, Kafka, Terraform",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "swe-staff",
    track: "engineering",
    level: "staff",
    title: "Staff Backend Engineer",
    tags: ["golang", "kafka", "staff"],
    blurb: "Event-driven services in Go, Kafka in production, and someone who sets direction for seniors.",
    pitch: "Acme is hiring someone who already owns event-driven services.",
    requirements: [
      "5+ years building event-driven services in Go",
      "Production Kafka or equivalent streaming experience",
      "Mentors senior engineers and sets technical direction",
      "Comfortable with Terraform and AWS",
    ],
    resumeName: "Jane Doe",
    summary: "Distributed systems engineer who ships event-driven platforms.",
    experience: [
      "Built a Go + Kafka pipeline handling 2M events/day and cut p99 latency 40%",
      "Led 6 engineers on a TypeScript control plane used by 30 product teams",
      "Reduced AWS spend 18% by rewriting a hot path in Rust",
    ],
    skills: "Go, Kafka, TypeScript, PostgreSQL, Terraform",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "swe-principal",
    track: "engineering",
    level: "staff",
    title: "Principal Engineer",
    tags: ["architecture", "multi-team", "principal"],
    blurb: "Sets the architecture several teams will live with for years.",
    pitch: "Acme wants a principal who can pick a platform bet and defend it in writing.",
    requirements: [
      "Principal or distinguished-level systems work across teams",
      "Published design that other teams adopted",
      "Guides staff engineers without becoming the bottleneck",
      "Experience retiring a platform, not only launching one",
    ],
    resumeName: "Morgan Hale",
    summary: "Principal engineer who retired two platforms and kept the third.",
    experience: [
      "Wrote the event-bus RFC adopted by 4 product groups",
      "Sunset a homegrown queue; migration finished 3 months early",
      "Coached two staff engineers through their first multi-team design",
    ],
    skills: "Go, Kafka, AWS, Technical writing",
    education: "M.S. Computer Science, State University",
  },
  {
    id: "eng-lead",
    track: "engineering",
    level: "lead",
    title: "Engineering Lead",
    tags: ["tech-lead", "delivery", "mentorship"],
    blurb: "Holds the roadmap for a squad and still reads the diffs.",
    pitch: "Acme is hiring a lead who can run a squad without disappearing into meetings.",
    requirements: [
      "Leads a squad of 4-8 engineers",
      "Breaks a quarter of work into sequenced delivery",
      "Still reviews critical path code",
      "Coaches seniors on scope, not only syntax",
    ],
    resumeName: "Chris Adeyemi",
    summary: "Tech lead who sequences delivery and still reviews the risky diffs.",
    experience: [
      "Led 7 engineers on checkout; hit the holiday freeze with 1 sev leftover",
      "Split a 14-week rewrite into 4 shippable slices",
      "Pair-reviewed the auth change that removed a class of session bugs",
    ],
    skills: "TypeScript, Go, Roadmapping, Code review",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "eng-manager",
    track: "engineering",
    level: "manager",
    title: "Engineering Manager",
    tags: ["people-manager", "hiring", "performance"],
    blurb: "Hires, coaches, and makes a team faster without writing all the code.",
    pitch: "Acme needs a manager who already ran performance cycles and hiring loops.",
    requirements: [
      "Managed engineers through at least one review cycle",
      "Hired ICs and closed a loop with a written rubric",
      "Owns delivery health without being the only designer",
      "Can talk about a coaching story that changed someone's trajectory",
    ],
    resumeName: "Jordan Blake",
    summary: "Engineering manager who hired a team and kept it shipping.",
    experience: [
      "Managed 8 engineers; two promoted to senior in 12 months",
      "Ran 11 hiring loops and closed 4 offers against a written rubric",
      "Cut lead time 25% by killing a status meeting and adding a weekly risk note",
    ],
    skills: "Coaching, Hiring, Delivery, TypeScript",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "eng-director",
    track: "engineering",
    level: "director",
    title: "Director of Engineering",
    tags: ["org-design", "budget", "directors"],
    blurb: "Several managers, one org chart, and a budget that has to mean something.",
    pitch: "Acme is hiring a director who has already run managers, not only ICs.",
    requirements: [
      "Directed multiple engineering managers",
      "Owned headcount and a budget conversation with finance",
      "Set a 12-month technical bet and killed a competing one",
      "Reports outcomes to a VP without hiding risk",
    ],
    resumeName: "Avery Lin",
    summary: "Director who ran three managers and a platform bet that stuck.",
    experience: [
      "Directed 3 managers / 28 engineers on core product",
      "Moved 15% of spend from a dying queue into observability",
      "Killed a rewrite after 6 weeks and wrote the postmortem for the VP",
    ],
    skills: "Org design, Budgeting, Platform strategy",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "frontend-senior",
    track: "engineering",
    level: "senior",
    title: "Senior Frontend Engineer",
    tags: ["react", "accessibility", "frontend"],
    blurb: "React at scale, accessibility, and UI that an ATS never sees — but users do.",
    pitch: "Acme wants a senior frontend who can own a design system surface.",
    requirements: [
      "5+ years of production React or equivalent",
      "Ships accessible UI, not screenshots of it",
      "Performance work you can measure in the field",
      "Partners with design without waiting for perfect mocks",
    ],
    resumeName: "Nina Patel",
    summary: "Senior frontend engineer for design-system surfaces and field performance.",
    experience: [
      "Cut LCP 38% on the marketing app by splitting the hero bundle",
      "Brought the checkout form to WCAG AA and dropped support tickets 19%",
      "Owned the React component library used by 6 product teams",
    ],
    skills: "React, TypeScript, CSS, Accessibility",
    education: "B.A. Interactive Media, State University",
  },
  {
    id: "fullstack-mid",
    track: "engineering",
    level: "mid",
    title: "Full Stack Engineer",
    tags: ["react", "node", "sql"],
    blurb: "Can land a feature from the button to the row in the database.",
    pitch: "Acme is hiring a full-stack engineer who does not bounce tickets over the wall.",
    requirements: [
      "Ships features across UI and API",
      "React plus a Node or Python service in production",
      "Can write the migration, not only the mock",
      "Comfortable with SQL beyond ORMs",
    ],
    resumeName: "Tess Walker",
    summary: "Full-stack engineer who lands the button and the migration.",
    experience: [
      "Shipped team invites: React UI, Node API, and the Postgres policy",
      "Moved file uploads off the web process; p95 dropped 1.8s to 240ms",
      "Wrote the SQL to backfill 1.2M rows without locking the table",
    ],
    skills: "React, Node, PostgreSQL, TypeScript",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "mobile-senior",
    track: "engineering",
    level: "senior",
    title: "Senior Mobile Engineer",
    tags: ["ios", "android", "mobile"],
    blurb: "Native or cross-platform apps that survive store review and flaky networks.",
    pitch: "Acme needs a senior mobile engineer who has shipped more than a demo build.",
    requirements: [
      "Shipped an app to the App Store or Play Store",
      "iOS, Android, or React Native in production",
      "Offline and poor-network paths, not only happy wifi",
      "Works with backend on contracts instead of screenshot APIs",
    ],
    resumeName: "Kai Nakamura",
    summary: "Senior mobile engineer who ships store releases on flaky networks.",
    experience: [
      "Shipped iOS 4.2 with offline drafts; crash-free sessions 99.7%",
      "Cut cold start 1.4s by deferring analytics until after first paint",
      "Partnered on a versioned API so the app survived a backend rename",
    ],
    skills: "Swift, Kotlin, React Native, Mobile performance",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "qa-mid",
    track: "engineering",
    level: "mid",
    title: "QA Engineer",
    tags: ["testing", "playwright", "quality"],
    blurb: "Risk-based testing and automation that catches the bug before customers do.",
    pitch: "Acme is hiring QA who can write the Playwright spec and the bug that matters.",
    requirements: [
      "Owns test strategy for a product surface",
      "Playwright, Cypress, or equivalent in CI",
      "Can file a bug with repro, impact, and expected",
      "Partners with eng on what not to automate",
    ],
    resumeName: "Harper Cole",
    summary: "QA engineer who automates the boring path and hunts the risky one.",
    experience: [
      "Built Playwright coverage for checkout; caught 11 regressions pre-release",
      "Wrote a risk matrix that dropped exploratory time on low-value flows 40%",
      "Filed the session-bug repro that led to a same-week patch",
    ],
    skills: "Playwright, Cypress, Test strategy, SQL",
    education: "B.S. Information Systems, State University",
  },
  {
    id: "security-senior",
    track: "engineering",
    level: "senior",
    title: "Senior Security Engineer",
    tags: ["appsec", "threat-model", "security"],
    blurb: "Threat models, reviews, and fixes that land in the product, not a PDF.",
    pitch: "Acme wants a senior security engineer who has closed vulns with eng, not only reported them.",
    requirements: [
      "Application security reviews on real services",
      "Threat models a team actually used",
      "Can patch or pair on the fix, not only file the ticket",
      "Incident work: detection, containment, writeup",
    ],
    resumeName: "Quinn Gallagher",
    summary: "Security engineer who threat-models and then lands the patch.",
    experience: [
      "Threat-modeled checkout; closed 3 authz gaps before launch",
      "Paired on a session-fix that cut account-takeover tickets to zero for a quarter",
      "Wrote the incident note after a leaked key; rotation finished in 4 hours",
    ],
    skills: "AppSec, Threat modeling, Go, AWS IAM",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "devops-senior",
    track: "infrastructure",
    level: "senior",
    title: "Senior DevOps Engineer",
    tags: ["ci-cd", "terraform", "devops"],
    blurb: "Pipelines, infra as code, and deploys that do not need a hero.",
    pitch: "Acme is hiring DevOps who already made deploys boring.",
    requirements: [
      "Production Terraform or equivalent IaC",
      "CI/CD that other teams use without asking",
      "Kubernetes or comparable runtime in anger",
      "Can tell a story about a deploy that failed safely",
    ],
    resumeName: "Dana Ruiz",
    summary: "DevOps engineer who made Friday deploys unremarkable.",
    experience: [
      "Moved 14 services onto GitHub Actions; median deploy 18m to 4m",
      "Terraform for the AWS account; drift alerts caught 2 open S3 buckets",
      "Blue/green on the API so a bad build rolled back in 3 minutes",
    ],
    skills: "Terraform, Kubernetes, GitHub Actions, AWS",
    education: "B.S. Computer Engineering, State University",
  },
  {
    id: "sre-senior",
    track: "infrastructure",
    level: "senior",
    title: "Senior Site Reliability Engineer",
    tags: ["sre", "slos", "on-call"],
    blurb: "SLOs, error budgets, and on-call that pages people for the right reasons.",
    pitch: "Acme needs an SRE who has lived with SLOs, not only dashboards.",
    requirements: [
      "Defined SLOs a product team actually used",
      "On-call rotations you improved, not only survived",
      "Observability: traces, metrics, and a useful alert",
      "Capacity and failure work with numbers attached",
    ],
    resumeName: "Ellis Ward",
    summary: "SRE who writes SLOs that change what the team ships.",
    experience: [
      "Set checkout SLOs; error budget pauses stopped a risky holiday launch",
      "Cut pages 44% by deleting alerts that never mapped to user harm",
      "Load-tested the API to 8x and found the connection-pool cliff",
    ],
    skills: "SLOs, Prometheus, Kubernetes, Incident response",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "data-eng-senior",
    track: "data",
    level: "senior",
    title: "Senior Data Engineer",
    tags: ["pipelines", "warehouse", "sql"],
    blurb: "Reliable pipelines, a warehouse people trust, and SQL that matches the grain.",
    pitch: "Acme is hiring a senior data engineer who has already been paged for a late table.",
    requirements: [
      "Production pipelines into a warehouse",
      "SQL at the grain the dashboard actually needs",
      "Orchestration (Airflow, Dagster, or similar)",
      "Data quality checks that fire before exec reads the number",
    ],
    resumeName: "Mei Zhao",
    summary: "Data engineer who keeps the warehouse a day ahead of the dashboard.",
    experience: [
      "Rebuilt the orders pipeline in Airflow; freshness SLO 2h, hit 98%",
      "Added tests that caught a doubled-revenue grain bug before QBR",
      "Modeled a star schema used by 9 Looker explores",
    ],
    skills: "SQL, Airflow, dbt, Snowflake, Python",
    education: "B.S. Statistics, State University",
  },
  {
    id: "data-sci-mid",
    track: "data",
    level: "mid",
    title: "Data Scientist",
    tags: ["experimentation", "python", "sql"],
    blurb: "Experiments, baselines, and a recommendation that a PM can ship.",
    pitch: "Acme wants a data scientist who can design the test and live with the result.",
    requirements: [
      "Designed or analyzed a product experiment",
      "Python and SQL in a shared warehouse",
      "Can explain a model without hiding the baseline",
      "Partners with PM on a decision, not a slide",
    ],
    resumeName: "Jonah Pierce",
    summary: "Data scientist who ships the experiment, not only the notebook.",
    experience: [
      "Designed the onboarding A/B; +6% activation, 95% CI held",
      "Baseline churn model in Python beat the heuristic by 9 points AUC",
      "Wrote the SQL the PM still uses for weekly funnel review",
    ],
    skills: "Python, SQL, Experimentation, scikit-learn",
    education: "M.S. Statistics, State University",
  },
  {
    id: "ml-senior",
    track: "data",
    level: "senior",
    title: "Senior Machine Learning Engineer",
    tags: ["ml", "serving", "python"],
    blurb: "Models that leave the notebook and stay alive behind a latency budget.",
    pitch: "Acme is hiring an ML engineer who has served a model, not only trained one.",
    requirements: [
      "Production model serving with a latency budget",
      "Training pipelines that retrained without heroics",
      "Evaluation against a baseline a product person understood",
      "Python plus the infra that holds the endpoint up",
    ],
    resumeName: "Amira Sol",
    summary: "ML engineer who serves models inside a latency budget.",
    experience: [
      "Served a ranking model at p95 45ms for 2M daily requests",
      "Retrain job in Airflow; stale-model alert fired twice and we caught it",
      "Beat the rules baseline 11% NDCG; product shipped the new ranker",
    ],
    skills: "Python, PyTorch, Feature store, Kubernetes",
    education: "M.S. Computer Science, State University",
  },
  {
    id: "pm-mid",
    track: "product",
    level: "mid",
    title: "Product Manager",
    tags: ["roadmap", "discovery", "pm"],
    blurb: "Discovery, a sequenced roadmap, and decisions written down.",
    pitch: "Acme is hiring a PM who can kill a feature and explain why.",
    requirements: [
      "Owned a product surface through ship",
      "Writes problem statements, not solution shopping lists",
      "Works with eng and design without translating every sentence",
      "Uses a metric that moved after launch",
    ],
    resumeName: "Leah Brooks",
    summary: "Product manager who sequences discovery and kills work that will not move the metric.",
    experience: [
      "Owned onboarding; activation +9% after cutting two steps",
      "Killed a dashboard rewrite when discovery showed the job was export, not charts",
      "Ran weekly with eng/design; shipped 4 bets in a quarter",
    ],
    skills: "Discovery, Roadmapping, SQL, Writing",
    education: "B.A. Economics, State University",
  },
  {
    id: "pm-senior",
    track: "product",
    level: "senior",
    title: "Senior Product Manager",
    tags: ["strategy", "stakeholders", "pm"],
    blurb: "Multi-team bets, messy stakeholders, and a narrative execs can repeat.",
    pitch: "Acme needs a senior PM who has already aligned a messy stakeholder set.",
    requirements: [
      "Led a bet that crossed more than one team",
      "Stakeholder management with a written narrative",
      "Forecast or sizing a VP could argue with",
      "Coaches other PMs on discovery, not only status",
    ],
    resumeName: "Mateo Cruz",
    summary: "Senior PM for multi-team bets and stakeholders who need a narrative.",
    experience: [
      "Led billing packaging across 3 teams; +$2.1M ARR in two quarters",
      "Wrote the one-pager the VP still quotes in board prep",
      "Coached two PMs through their first discovery sprint",
    ],
    skills: "Strategy, Stakeholder management, SQL, Storytelling",
    education: "MBA, State University",
  },
  {
    id: "pm-lead",
    track: "product",
    level: "lead",
    title: "Product Lead",
    tags: ["product-lead", "portfolio", "pm"],
    blurb: "A portfolio of PMs, one product story, and the cuts that make it true.",
    pitch: "Acme is hiring a product lead who has already managed PMs, not only a backlog.",
    requirements: [
      "Leads other product managers",
      "Owns a portfolio and the cuts between bets",
      "Sets the product narrative for a director or VP",
      "Has fired a project and redistributed the people",
    ],
    resumeName: "Skye Raman",
    summary: "Product lead who cuts the portfolio so PMs can finish something.",
    experience: [
      "Led 4 PMs on core product; killed 2 of 7 bets mid-quarter",
      "Set the annual narrative used in the company kickoff",
      "Moved two PMs onto onboarding when activation stalled",
    ],
    skills: "Portfolio, Coaching, Narrative, Metrics",
    education: "B.S. Computer Science, State University",
  },
  {
    id: "design-mid",
    track: "design",
    level: "mid",
    title: "Product Designer",
    tags: ["figma", "research", "product-design"],
    blurb: "Research, a Figma file people can build from, and UI that shipped.",
    pitch: "Acme wants a product designer who has sat with users and then shipped.",
    requirements: [
      "End-to-end product design, not only visual polish",
      "Figma files an engineer could implement",
      "User research you ran or synthesized",
      "A shipped surface you can walk through",
    ],
    resumeName: "Noah Ibarra",
    summary: "Product designer who talks to users and then hands eng a file they can build.",
    experience: [
      "Redesigned settings; 8 user interviews, then a Figma spec eng shipped in 3 weeks",
      "Cut empty-state confusion; related support tickets -27%",
      "Systemized 18 components so marketing and app shared one kit",
    ],
    skills: "Figma, Research, Prototyping, Design systems",
    education: "B.F.A. Graphic Design, State University",
  },
  {
    id: "design-lead",
    track: "design",
    level: "lead",
    title: "Design Lead",
    tags: ["design-lead", "systems", "critique"],
    blurb: "Sets the craft bar, runs critique, and still touches the risky file.",
    pitch: "Acme is hiring a design lead who can run a critique and a hiring loop.",
    requirements: [
      "Leads other designers",
      "Owns a design system or craft bar",
      "Critique that changes the work, not the mood",
      "Partners with a product lead on what not to make",
    ],
    resumeName: "Gia Bennett",
    summary: "Design lead who runs critique and still opens the risky file.",
    experience: [
      "Led 5 designers; shipped a system v2 adopted by 3 products",
      "Ran twice-weekly critique; two features died before they wasted eng",
      "Hired 2 ICs against a craft rubric I wrote with the PM lead",
    ],
    skills: "Critique, Design systems, Hiring, Figma",
    education: "M.F.A. Interaction Design, State University",
  },
  {
    id: "sales-ae",
    track: "sales",
    level: "mid",
    title: "Account Executive",
    tags: ["quota", "saas", "ae"],
    blurb: "Pipeline, a clean forecast, and closed revenue you can point at.",
    pitch: "Acme is hiring an AE who already carried a quota and beat it.",
    requirements: [
      "Carried a SaaS quota for at least a year",
      "Forecast a manager could trust",
      "Multi-threaded deals, not only a champion",
      "Can tell a loss story, not only a win",
    ],
    resumeName: "Camille Ortiz",
    summary: "Account executive who forecasts cleanly and still beats the number.",
    experience: [
      "Carried $900k quota; closed $1.12M (124%) in FY25",
      "Multi-threaded a 6-month deal across finance and IT; $180k ACV",
      "Lost a renewal, wrote the note, and won the logo back two quarters later",
    ],
    skills: "Salesforce, MEDDIC, Forecasting, Negotiation",
    education: "B.A. Business, State University",
  },
  {
    id: "sales-manager",
    track: "sales",
    level: "manager",
    title: "Sales Manager",
    tags: ["sales-manager", "coaching", "forecast"],
    blurb: "A team number, coaching on the calls, and a forecast that does not slip Friday.",
    pitch: "Acme needs a sales manager who has already made a team number, not only a personal one.",
    requirements: [
      "Managed AEs or SDRs against a team quota",
      "Coaching on live calls, not only dashboards",
      "Forecast hygiene a CRO would not be embarrassed by",
      "Hiring and firing with a written bar",
    ],
    resumeName: "Drew Fontaine",
    summary: "Sales manager who coaches the call and still hits the team number.",
    experience: [
      "Managed 6 AEs; team finished 109% of $4.8M",
      "Weekly call coaching; two ramping AEs hit ramp in 4 months not 6",
      "Fired a sandbagged forecast habit; Friday slip dropped from 18% to 4%",
    ],
    skills: "Coaching, Forecasting, Salesforce, Hiring",
    education: "B.A. Communications, State University",
  },
  {
    id: "marketing-mid",
    track: "marketing",
    level: "mid",
    title: "Marketing Manager",
    tags: ["campaigns", "seo", "lifecycle"],
    blurb: "Campaigns with a number, not a vibe: pipeline, SEO, or lifecycle.",
    pitch: "Acme is hiring a marketing manager who can show what the campaign did.",
    requirements: [
      "Owned a channel or campaign with a pipeline or revenue number",
      "SEO, lifecycle, or paid — one of them deeply",
      "Works with sales on what a lead actually is",
      "Can kill a campaign that did not earn the spend",
    ],
    resumeName: "Hannah Cho",
    summary: "Marketing manager who kills campaigns that do not earn the spend.",
    experience: [
      "Owned lifecycle email; +22% trial-to-paid after a 4-mail rewrite",
      "SEO pages for 12 jobs-to-be-done; organic demo requests +31%",
      "Paused a paid set after CAC doubled; saved $40k that quarter",
    ],
    skills: "Lifecycle, SEO, HubSpot, Analytics",
    education: "B.A. Marketing, State University",
  },
  {
    id: "outreach-sdr",
    track: "gtm",
    level: "junior",
    title: "SDR / Outreach",
    tags: ["outbound", "sdr", "pipeline"],
    blurb: "Outbound that books meetings, not activity for the scoreboard.",
    pitch: "Acme wants outreach who can book a meeting a manager will take.",
    requirements: [
      "Outbound email, phone, or LinkedIn that booked meetings",
      "Personalization beyond {{firstName}}",
      "Hit activity and meeting quotas without hiding in CRM",
      "Hands AEs notes they can actually use",
    ],
    resumeName: "Jules Park",
    summary: "SDR who books meetings AEs do not bounce.",
    experience: [
      "Booked 19 qualified meetings in a quarter against a quota of 15",
      "Rewrote sequences; reply rate 2.1% to 6.4% on the ops persona",
      "Passed notes with the buying trigger so AEs stopped re-asking",
    ],
    skills: "Outreach, Salesforce, LinkedIn, Copy",
    education: "B.A. English, State University",
  },
  {
    id: "cs-mid",
    track: "gtm",
    level: "mid",
    title: "Customer Success Manager",
    tags: ["retention", "onboarding", "csm"],
    blurb: "Onboarding, health, and a renewal you did not leave to chance.",
    pitch: "Acme is hiring a CSM who has already saved a renewal in writing.",
    requirements: [
      "Owned a book of accounts through renewal",
      "Onboarding that gets to first value on a date",
      "Health scores you acted on, not only reported",
      "A save story and an expansion story",
    ],
    resumeName: "Robin Estevez",
    summary: "CSM who dates first value and does not leave renewals to chance.",
    experience: [
      "Book of 38 accounts, $2.4M ARR; gross retention 97%",
      "Onboarding playbook: time-to-value 22 days to 11",
      "Saved a churn-risk with a 90-day plan; they expanded 4 months later",
    ],
    skills: "Onboarding, Retention, Gainsight, QBR",
    education: "B.A. Psychology, State University",
  },
  {
    id: "recruiter-mid",
    track: "people",
    level: "mid",
    title: "Technical Recruiter",
    tags: ["recruiting", "intake", "closing"],
    blurb: "Intake, a calibrated bar, and closes that hiring managers do not regret.",
    pitch: "Acme wants a recruiter who can run an intake and close without lowering the bar.",
    requirements: [
      "Filled technical roles against a written bar",
      "Intake with hiring managers that changes the scorecard",
      "Sourcing that is not only InMail spam",
      "A close story through a competing offer",
    ],
    resumeName: "Casey Nguyen",
    summary: "Technical recruiter who calibrates the bar and still closes.",
    experience: [
      "Filled 11 eng roles in a year; 90-day regret zero",
      "Rewrote the staff-eng scorecard after two bad onsites",
      "Closed a senior against a competing offer in 5 days",
    ],
    skills: "Sourcing, Intake, Greenhouse, Closing",
    education: "B.A. Human Resources, State University",
  },
  {
    id: "ops-mid",
    track: "operations",
    level: "mid",
    title: "Operations Manager",
    tags: ["process", "vendor", "ops"],
    blurb: "The process behind the product: vendors, SLAs, and a number that moved.",
    pitch: "Acme is hiring ops who has already taken a messy process and made it boring.",
    requirements: [
      "Owned an operational process with a SLA",
      "Vendor or finance coordination you can show",
      "A before/after number, not a new tool for its own sake",
      "Works across support, sales, and product without a title fight",
    ],
    resumeName: "Pat Okonkwo",
    summary: "Operations manager who turns a messy handoff into a SLA.",
    experience: [
      "Owned deal-desk turnaround; 3.2 days to 0.9 with a written SLA",
      "Renegotiated two vendors; -$120k without dropping uptime",
      "Stood up the weekly exceptions review support and sales both use",
    ],
    skills: "Process, Vendors, Spreadsheets, SLAs",
    education: "B.S. Operations Management, State University",
  },
  {
    id: "support-lead",
    track: "operations",
    level: "lead",
    title: "Support Lead",
    tags: ["support", "qa", "lead"],
    blurb: "Queue health, quality, and a team that does not drown at 4pm.",
    pitch: "Acme needs a support lead who has already run a queue, not only answered tickets.",
    requirements: [
      "Led a support pod or shift",
      "CSAT or quality you measured and coached",
      "Macros and routing that cut handle time",
      "Escalations to product with a pattern, not a pile",
    ],
    resumeName: "Reese Daley",
    summary: "Support lead who coaches quality and keeps the 4pm queue alive.",
    experience: [
      "Led 9 agents; CSAT 91% to 95% in two quarters",
      "Rewrote macros; first-response 2.4h to 41m",
      "Monthly product packet of top 5 patterns; two of them shipped",
    ],
    skills: "Zendesk, QA, Coaching, Reporting",
    education: "B.A. Liberal Arts, State University",
  },
  {
    id: "finance-mid",
    track: "operations",
    level: "mid",
    title: "Finance Manager",
    tags: ["fpna", "forecast", "close"],
    blurb: "Close, forecast, and a model someone besides you can open.",
    pitch: "Acme is hiring finance who has already owned a close and a forecast.",
    requirements: [
      "Owned a monthly close or a forecast cycle",
      "Models other people can audit",
      "Partnered with a business owner on a spend decision",
      "Can explain variance without a 40-line tab",
    ],
    resumeName: "Ian Moreau",
    summary: "Finance manager who closes the month and explains the variance in one page.",
    experience: [
      "Owned monthly close; day-8 to day-4 without extra headcount",
      "Built the hiring model sales and eng both used in planning",
      "Flagged a 12% opex overrun in week 2; spend froze before quarter-end",
    ],
    skills: "FP&A, Excel, Forecasting, Close",
    education: "B.S. Finance, State University",
  },
];

export const RESUME_PRESETS: ResumePreset[] = DRAFTS.map(fromDraft);

function requiredPreset(id: string): ResumePreset {
  const found = RESUME_PRESETS.find((preset) => preset.id === id);
  if (!found) {
    throw new Error(`Default resume preset ${id} is missing`);
  }
  return found;
}

export const DEFAULT_PRESET = requiredPreset(DEFAULT_PRESET_ID);

export function trackLabel(track: JobTrack): string {
  return TRACK_LABELS[track];
}

export function levelLabel(level: JobLevel): string {
  return LEVEL_LABELS[level];
}

export function presetById(id: string): ResumePreset | undefined {
  return RESUME_PRESETS.find((preset) => preset.id === id);
}

export function groupedResumePresets(): { track: JobTrack; label: string; items: ResumePreset[] }[] {
  return JOB_TRACKS.map((track) => ({
    track,
    label: TRACK_LABELS[track],
    items: RESUME_PRESETS.filter((preset) => preset.track === track),
  }));
}

export function jobFieldsFromPreset(preset: ResumePreset): JobTargetFields {
  return {
    ...EMPTY_JOB_TARGET,
    jobTitle: preset.title,
    company: preset.company,
    jobText: preset.jobText,
  };
}

export function presetPersonaId(id: string): string {
  return id.startsWith(PRESET_PERSONA_PREFIX) ? id : `${PRESET_PERSONA_PREFIX}${id}`;
}

export function parsePresetPersonaId(personaId: string): string | null {
  if (!personaId.startsWith(PRESET_PERSONA_PREFIX)) {
    return null;
  }
  const id = personaId.slice(PRESET_PERSONA_PREFIX.length);
  return presetById(id) ? id : null;
}

export function matchPreset(input: {
  jobTitle?: string;
  jobText?: string;
}): ResumePreset | undefined {
  const title = input.jobTitle?.trim();
  const text = input.jobText?.trim();
  if (!title && !text) {
    return undefined;
  }
  return RESUME_PRESETS.find((preset) => {
    if (title && preset.title === title) {
      return !text || preset.jobText.trim() === text;
    }
    return Boolean(text && preset.jobText.trim() === text);
  });
}
