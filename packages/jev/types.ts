export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
};

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string | null>;
};

export type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;
export type Questions = Record<string, Question>;

export type SystemOneRequest = {
  state: JsonValue;
  questions: Questions;
  model?: string;
};

export type NoulAnswer = { type: "noul"; noul: number };
export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};
export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type SystemOneResult = {
  model: string;
  answers: Record<string, Answer>;
  usage?: { input_tokens: number; output_tokens: number };
};

export type ProviderId = "jev" | "mock";

export type JudgmentProvider = {
  readonly id: ProviderId;
  evaluate(input: SystemOneRequest): Promise<SystemOneResult>;
};

export type QualityLevel = 0 | 1 | 2 | 3 | 4;

export type RequirementCategory =
  | "must_have"
  | "nice_to_have"
  | "responsibility"
  | "culture"
  | "not_a_requirement";

export type RequirementVerdict = "works" | "partial" | "missing" | "contradicts";

export type FindingSeverity = "works" | "partial" | "missing" | "risk";

export type SectionKind =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "other";

export type ResumeFragment = {
  id: string;
  text: string;
  kind: "heading" | "bullet" | "paragraph";
};

export type ResumeSection = {
  id: string;
  heading: string;
  kind: SectionKind;
  text: string;
  fragments: ResumeFragment[];
  quality?: number;
};

export type GroupedResume = {
  text: string;
  sections: ResumeSection[];
};

export type PersonaRequirement = {
  id: string;
  text: string;
  category: Exclude<RequirementCategory, "not_a_requirement">;
  noul: number;
};

export type JobPersona = {
  id: string;
  title: string;
  tags: string[];
  jobDescription: string;
  requirements: PersonaRequirement[];
  createdAt: string;
};

export type ScoreBreakdown = {
  key: string;
  score01: number;
  weight: number;
};

export type JevScore = {
  value: number;
  breakdown: ScoreBreakdown[];
  confidence: number | null;
};

export type DimensionScore = {
  id: string;
  label: string;
  score: number;
  max: number;
  confidence?: number;
};

export type ReviewFinding = {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
};

export type ReviewSuggestion = {
  id: string;
  text: string;
};

export type RequirementReview = {
  id: string;
  text: string;
  category: string;
  noul: number;
  verdict: RequirementVerdict;
};

export type ReviewResponse = {
  mode: "general" | "job";
  jevScore: JevScore;
  dimensions: DimensionScore[];
  sections: ResumeSection[];
  findings: ReviewFinding[];
  requirements?: RequirementReview[];
  suggestions: ReviewSuggestion[];
  provider: ProviderId;
  model?: string;
};

export function assertNever(value: never, message: string): never {
  throw new Error(message);
}
