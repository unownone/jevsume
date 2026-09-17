import type { ResumeSection, TextSpan } from "./types.ts";

export function sectionBodySpan(section: ResumeSection): TextSpan | null {
  const body =
    section.fragments.find((fragment) => fragment.kind !== "heading") ?? section.fragments[0];
  if (!body) {
    return null;
  }
  return {
    start: body.start,
    end: body.end,
    sectionId: section.id,
    fragmentId: body.id,
    line: body.line,
  };
}

export function firstSectionSpan(sections: ResumeSection[]): TextSpan | null {
  for (const section of sections) {
    const span = sectionBodySpan(section);
    if (span) {
      return span;
    }
  }
  return null;
}

export function fallbackSpan(sections: ResumeSection[]): TextSpan {
  return (
    firstSectionSpan(sections) ?? {
      start: 0,
      end: 1,
      sectionId: "s0",
      fragmentId: "s0-f1",
      line: 1,
    }
  );
}

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9+]{3,}/g) ?? [];
}

export function spanMatchingText(sections: ResumeSection[], needle: string): TextSpan | null {
  const needles = new Set(tokens(needle));
  let best: { score: number; span: TextSpan } | null = null;
  for (const section of sections) {
    for (const fragment of section.fragments) {
      if (fragment.kind === "heading") {
        continue;
      }
      const words = tokens(fragment.text);
      const overlap = words.filter((word) => needles.has(word)).length;
      const digits = (fragment.text.match(/\d/g) ?? []).length;
      const score = overlap * 3 + digits * 0.1;
      if (!best || score > best.score) {
        best = {
          score,
          span: {
            start: fragment.start,
            end: fragment.end,
            sectionId: section.id,
            fragmentId: fragment.id,
            line: fragment.line,
          },
        };
      }
    }
  }
  if (best && best.score > 0) {
    return best.span;
  }
  const experience = sections.find((section) => section.kind === "experience");
  return (experience ? sectionBodySpan(experience) : null) ?? firstSectionSpan(sections);
}

export function spanForDimension(dimension: string, sections: ResumeSection[]): TextSpan | null {
  switch (dimension) {
    case "metrics": {
      let best: TextSpan | null = null;
      let bestDigits = -1;
      for (const section of sections) {
        for (const fragment of section.fragments) {
          const digits = (fragment.text.match(/\d/g) ?? []).length;
          if (digits > bestDigits) {
            bestDigits = digits;
            best = {
              start: fragment.start,
              end: fragment.end,
              sectionId: section.id,
              fragmentId: fragment.id,
              line: fragment.line,
            };
          }
        }
      }
      return best ?? firstSectionSpan(sections);
    }
    case "wording": {
      const summary = sections.find((section) => section.kind === "summary");
      return (summary ? sectionBodySpan(summary) : null) ?? firstSectionSpan(sections);
    }
    case "structure": {
      for (const section of sections) {
        const heading = section.fragments.find((fragment) => fragment.kind === "heading");
        if (heading) {
          return {
            start: heading.start,
            end: heading.end,
            sectionId: section.id,
            fragmentId: heading.id,
            line: heading.line,
          };
        }
      }
      return firstSectionSpan(sections);
    }
    case "conciseness": {
      let longest: TextSpan | null = null;
      let max = -1;
      for (const section of sections) {
        for (const fragment of section.fragments) {
          if (fragment.text.length > max) {
            max = fragment.text.length;
            longest = {
              start: fragment.start,
              end: fragment.end,
              sectionId: section.id,
              fragmentId: fragment.id,
              line: fragment.line,
            };
          }
        }
      }
      return longest;
    }
    case "ats_parse":
    case "skills": {
      const skills = sections.find((section) => section.kind === "skills");
      return (skills ? sectionBodySpan(skills) : null) ?? firstSectionSpan(sections);
    }
    default:
      return firstSectionSpan(sections);
  }
}

export function passageForSpan(sections: ResumeSection[], span: TextSpan): string {
  for (const section of sections) {
    const fragment = section.fragments.find((item) => item.id === span.fragmentId);
    if (fragment) {
      return fragment.text;
    }
  }
  return "";
}
