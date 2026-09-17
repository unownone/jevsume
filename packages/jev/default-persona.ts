export const DEFAULT_PERSONA_ID = "default";

export const DEFAULT_PERSONA = {
  id: DEFAULT_PERSONA_ID,
  title: "General professional",
  isDefault: true as const,
  tags: ["wording", "structure", "evidence"],
  summary: "A calm, role-agnostic look at how clearly the resume reads.",
  explanation:
    "A job persona is the lens Jev uses — the role this resume is trying to speak to. The default persona is not a specific posting. It asks whether the writing is specific, scannable, and backed by proof, the way a careful reader would, without matching it to one job description.",
  jobDescription:
    "A strong professional resume: specific wording, scannable structure, quantified impact, and skills a recruiter can extract.",
  requirements: [] as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

export function personaBlurb(input: {
  title: string;
  tags: string[];
  jobDescription: string;
  isDefault?: boolean;
}): { summary: string; explanation: string } {
  if (input.isDefault) {
    return {
      summary: DEFAULT_PERSONA.summary,
      explanation: DEFAULT_PERSONA.explanation,
    };
  }
  const tagLine = input.tags.slice(0, 4).join(", ");
  const excerpt = input.jobDescription.replace(/\s+/g, " ").trim().slice(0, 280);
  return {
    summary: tagLine ? `Written for ${input.title} · ${tagLine}` : `Written for ${input.title}`,
    explanation: `Jev will read the resume as if screening for ${input.title}. ${excerpt}`,
  };
}
