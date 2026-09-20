import { SECTION_KIND_CRITERIA } from "./questions.ts";
import type {
  Answer,
  ChoiceAnswer,
  HierarchyKind,
  HierarchyNode,
  Questions,
  ResumeSection,
} from "./types.ts";
import { assertNever } from "./types.ts";

export type ProctorBlock = {
  id: string;
  kindHint: HierarchyKind;
  title: string;
  text: string;
  start: number;
  end: number;
  line: number;
  parentHint: "experience" | null;
};

function asChoice(answer: Answer | undefined): ChoiceAnswer | null {
  if (answer && answer.type === "choice") {
    return answer;
  }
  return null;
}

export function coerceHierarchyKind(choice: string, fallback: HierarchyKind): HierarchyKind {
  switch (choice) {
    case "header":
    case "summary":
    case "experience":
    case "job":
    case "education":
    case "skills":
    case "accolades":
    case "projects":
    case "other":
      return choice;
    default:
      return fallback;
  }
}

export function buildHierarchyQuestions(blocks: ProctorBlock[]): Questions {
  const questions: Questions = {};
  for (const block of blocks) {
    questions[`blk_${block.id}_kind`] = {
      type: "choice",
      instructions: `Which resume section kind best fits block ${block.id} titled “${block.title}” in \`blocks\`? Read \`blocks\` text, not the id.`,
      criteria: SECTION_KIND_CRITERIA,
    };
  }
  return questions;
}

function emptyNode(block: ProctorBlock, kind: HierarchyKind, level: 1 | 2, parentId: string | null): HierarchyNode {
  return {
    id: block.id,
    kind,
    title: block.title,
    level,
    parentId,
    text: block.text,
    start: block.start,
    end: block.end,
    line: block.line,
    weight: null,
    score01: null,
    contribution: null,
    status: "pending",
    dimensions: [],
    children: [],
  };
}

export function assembleTree(blocks: ProctorBlock[], answers: Record<string, Answer>): HierarchyNode[] {
  const classified = blocks.map((block) => {
    const kind = coerceHierarchyKind(
      asChoice(answers[`blk_${block.id}_kind`])?.choice ?? block.kindHint,
      block.kindHint,
    );
    return { block, kind };
  });

  const roots: HierarchyNode[] = [];
  let experience: HierarchyNode | null = null;

  const ensureExperience = (seed: ProctorBlock): HierarchyNode => {
    if (experience) {
      experience.end = Math.max(experience.end, seed.end);
      if (seed.text) {
        experience.text = [experience.text, seed.text].filter(Boolean).join("\n");
      }
      return experience;
    }
    experience = {
      id: "experience",
      kind: "experience",
      title: "Experience",
      level: 1,
      parentId: null,
      text: seed.text,
      start: seed.start,
      end: seed.end,
      line: seed.line,
      weight: null,
      score01: null,
      contribution: null,
      status: "pending",
      dimensions: [],
      children: [],
    };
    roots.push(experience);
    return experience;
  };

  for (const { block, kind } of classified) {
    if (kind === "job" || block.parentHint === "experience" || kind === "experience") {
      if (kind === "experience" && classified.filter((item) => item.kind === "job" || item.block.parentHint === "experience").length === 0) {
        roots.push(emptyNode(block, "experience", 1, null));
        continue;
      }
      const parent = ensureExperience(block);
      if (kind === "experience") {
        continue;
      }
      const job = emptyNode(block, "job", 2, parent.id);
      job.title = block.title || "Role";
      parent.children.push(job);
      continue;
    }
    roots.push(emptyNode(block, kind, 1, null));
  }

  return roots;
}

export function sectionsFromTree(roots: HierarchyNode[]): ResumeSection[] {
  const sections: ResumeSection[] = [];
  for (const root of roots) {
    sections.push({
      id: root.id,
      heading: root.title,
      kind: root.kind === "job" ? "experience" : root.kind,
      text: root.text,
      fragments: [
        {
          id: `${root.id}-body`,
          text: root.text,
          kind: "paragraph",
          start: root.start,
          end: root.end,
          line: root.line,
        },
      ],
      start: root.start,
      end: root.end,
      line: root.line,
    });
    for (const child of root.children) {
      sections.push({
        id: child.id,
        heading: child.title,
        kind: "job",
        text: child.text,
        fragments: [
          {
            id: `${child.id}-body`,
            text: child.text,
            kind: "paragraph",
            start: child.start,
            end: child.end,
            line: child.line,
          },
        ],
        start: child.start,
        end: child.end,
        line: child.line,
      });
    }
  }
  return sections;
}

export function walkNodes(roots: HierarchyNode[]): HierarchyNode[] {
  const out: HierarchyNode[] = [];
  const visit = (node: HierarchyNode) => {
    out.push(node);
    for (const child of node.children) {
      visit(child);
    }
  };
  for (const root of roots) {
    visit(root);
  }
  return out;
}

export function replaceNode(roots: HierarchyNode[], next: HierarchyNode): HierarchyNode[] {
  return roots.map((root) => {
    if (root.id === next.id) {
      return next;
    }
    if (root.children.some((child) => child.id === next.id)) {
      return {
        ...root,
        children: root.children.map((child) => (child.id === next.id ? next : child)),
      };
    }
    return root;
  });
}

export function scoringTargets(roots: HierarchyNode[]): HierarchyNode[] {
  const out: HierarchyNode[] = [];
  for (const root of roots) {
    if (root.kind === "experience" && root.children.length > 0) {
      out.push(...root.children);
      continue;
    }
    out.push(root);
  }
  return out;
}

export function kindLabel(kind: HierarchyKind): string {
  switch (kind) {
    case "header":
      return "Header";
    case "summary":
      return "Summary";
    case "experience":
      return "Experience";
    case "job":
      return "Role";
    case "education":
      return "Education";
    case "skills":
      return "Skills";
    case "accolades":
      return "Accolades";
    case "projects":
      return "Projects";
    case "other":
      return "Other";
    default: {
      const _never: never = kind;
      return assertNever(_never, `Unhandled kind ${String(_never)}`);
    }
  }
}
