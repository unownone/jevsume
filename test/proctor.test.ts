import { describe, expect, it } from "vitest";
import { assembleTree, type ProctorBlock } from "../packages/jev/hierarchy.ts";
import { applyContributions, climbOverall, largestRemainderPercents, recoverPoints } from "../packages/jev/iterative-score.ts";
import { applyL1Weights, scoreHierarchyNode } from "../packages/jev/proctor.ts";
import type { HierarchyNode } from "../packages/jev/types.ts";

function node(partial: Partial<HierarchyNode> & Pick<HierarchyNode, "id" | "kind" | "title">): HierarchyNode {
  return {
    level: 1,
    parentId: null,
    text: partial.text ?? partial.title,
    start: 0,
    end: 10,
    line: 1,
    weight: null,
    score01: null,
    contribution: null,
    status: "pending",
    dimensions: [],
    children: [],
    ...partial,
  };
}

describe("largest remainder weights", () => {
  it("always sums to 100", () => {
    expect(largestRemainderPercents([1, 1, 1]).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(largestRemainderPercents([8, 48, 16, 8, 6]).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(largestRemainderPercents([0, 0, 0], 100).reduce((sum, value) => sum + value, 0)).toBe(100);
  });
});

describe("iterative rollup", () => {
  it("climbs from 0 as section scores arrive and keeps displayed points on the overall", () => {
    const roots = [
      node({ id: "skills", kind: "skills", title: "Skills", weight: 20, score01: 1 }),
      node({ id: "header", kind: "header", title: "Header", weight: 10, score01: null }),
      node({ id: "experience", kind: "experience", title: "Experience", weight: 70, score01: null }),
    ];
    expect(climbOverall(roots)).toBe(20);
    roots[1] = { ...roots[1]!, score01: 0.5 };
    expect(climbOverall(roots)).toBe(25);
    roots[2] = { ...roots[2]!, score01: 0.5 };
    const overall = climbOverall(roots);
    expect(overall).toBe(60);
    const displayed = applyContributions(roots, overall);
    expect(displayed.reduce((sum, item) => sum + (item.contribution ?? 0), 0)).toBe(overall);
  });

  it("computes recover points from the leftover on a dimension", () => {
    expect(
      recoverPoints({
        sectionWeight: 20,
        dimensionWeight01: 0.5,
        current01: 0.5,
      }),
    ).toBe(5);
  });
});

describe("hierarchy assembly", () => {
  it("nests jobs under experience", () => {
    const blocks: ProctorBlock[] = [
      { id: "s1", kindHint: "header", title: "Header", text: "Jane Doe", start: 0, end: 8, line: 1, parentHint: null },
      {
        id: "job1",
        kindHint: "job",
        title: "Acme",
        text: "Led payments",
        start: 20,
        end: 40,
        line: 4,
        parentHint: "experience",
      },
      {
        id: "job2",
        kindHint: "job",
        title: "Beta",
        text: "Built Kafka",
        start: 50,
        end: 80,
        line: 10,
        parentHint: "experience",
      },
      { id: "s4", kindHint: "skills", title: "Skills", text: "Go, Kafka", start: 90, end: 110, line: 20, parentHint: null },
    ];
    const tree = assembleTree(blocks, {});
    expect(tree.map((item) => item.kind)).toEqual(["header", "experience", "skills"]);
    expect(tree[1]?.children.map((item) => item.id)).toEqual(["job1", "job2"]);
  });
});

describe("section scoring", () => {
  it("attaches recover points to weak dimensions", () => {
    const scored = scoreHierarchyNode(
      node({ id: "skills", kind: "skills", title: "Skills", text: "Go, Go, Kafka", start: 90, end: 140 }),
      {
        n_skills_unique: { type: "score", score: 1, legend: {}, probabilities: {}, confidence: 0.8 },
        n_skills_proven: { type: "score", score: 2, legend: {}, probabilities: {}, confidence: 0.8 },
        n_skills_ats_parse: { type: "score", score: 3, legend: {}, probabilities: {}, confidence: 0.8 },
        n_skills_relevance: { type: "score", score: 3, legend: {}, probabilities: {}, confidence: 0.8 },
        n_skills_dump: { type: "score", score: 1, legend: {}, probabilities: {}, confidence: 0.8 },
      },
      16,
    );
    expect(scored.suggestions.some((item) => (item.recoverPoints ?? 0) > 0)).toBe(true);
    expect(scored.suggestions.every((item) => item.span?.sectionId === "skills")).toBe(true);
    expect(scored.node.score01).toBeGreaterThan(0);
    expect(scored.node.score01).toBeLessThan(1);
  });
});

describe("L1 weights", () => {
  it("writes integer weights that sum to 100", () => {
    const weighted = applyL1Weights(
      [
        node({ id: "header", kind: "header", title: "Header" }),
        node({
          id: "experience",
          kind: "experience",
          title: "Experience",
          children: [
            node({ id: "job1", kind: "job", title: "Acme", level: 2, parentId: "experience" }),
            node({ id: "job2", kind: "job", title: "Beta", level: 2, parentId: "experience" }),
          ],
        }),
        node({ id: "skills", kind: "skills", title: "Skills" }),
      ],
      {
        weight_header: { type: "score", score: 2, legend: {}, probabilities: {}, confidence: 0.7 },
        weight_experience: { type: "score", score: 4, legend: {}, probabilities: {}, confidence: 0.7 },
        weight_skills: { type: "score", score: 3, legend: {}, probabilities: {}, confidence: 0.7 },
      },
    );
    expect(weighted.reduce((sum, item) => sum + (item.weight ?? 0), 0)).toBe(100);
    const experience = weighted.find((item) => item.id === "experience");
    expect(experience?.weight ?? 0).toBeGreaterThan(weighted[0]?.weight ?? 0);
    expect((experience?.children ?? []).reduce((sum, child) => sum + (child.weight ?? 0), 0)).toBe(
      experience?.weight ?? 0,
    );
  });
});
