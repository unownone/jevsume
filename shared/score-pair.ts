export type PairDimension = {
  id: string;
  label: string;
  score: number;
  max: number;
  weight01?: number;
};

export type PairNode = {
  kind?: string;
  status?: string;
  score01?: number | null;
  dimensions?: PairDimension[];
  children?: PairNode[];
};

const VALIDITY_RE =
  /ats|parse|contact|format consistency|tense and format|unique token|bullet count|\blength\b|school|separator|name parseable/i;
const EVIDENCE_RE =
  /metric|quantif|named system|named outcome|named award|proven|dump vs|keyword|specific/i;
const VALIDITY_KINDS = new Set(["header", "skills", "education", "other"]);
const EVIDENCE_KINDS = new Set(["job", "summary", "projects", "accolades", "experience"]);

function walk(nodes: PairNode[]): PairNode[] {
  const out: PairNode[] = [];
  const visit = (node: PairNode) => {
    out.push(node);
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  for (const node of nodes) {
    visit(node);
  }
  return out;
}

function weighted01(items: PairDimension[]): number | null {
  if (items.length === 0) {
    return null;
  }
  let weight = 0;
  let acc = 0;
  for (const item of items) {
    const max = item.max > 0 ? item.max : 4;
    const w = item.weight01 && item.weight01 > 0 ? item.weight01 : 1;
    weight += w;
    acc += (Math.min(max, Math.max(0, item.score)) / max) * w;
  }
  if (weight <= 0) {
    return null;
  }
  return acc / weight;
}

function kind01(nodes: PairNode[], kinds: Set<string>): number | null {
  const scored = nodes.filter(
    (node) => node.status === "scored" && typeof node.score01 === "number" && kinds.has(node.kind ?? ""),
  );
  if (scored.length === 0) {
    return null;
  }
  const sum = scored.reduce((acc, node) => acc + Math.min(1, Math.max(0, node.score01 ?? 0)), 0);
  return sum / scored.length;
}

function pct(value: number | null): number {
  if (value === null) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value * 100)));
}

/** Parser/ATS readability vs numbered or named claims. Honesty is not scored. */
export function validityEvidenceFromTree(roots: PairNode[]): { validity: number; evidence: number } {
  const nodes = walk(roots);
  const dims = nodes.flatMap((node) => (node.status === "scored" ? (node.dimensions ?? []) : []));
  const validityDims = dims.filter((item) => VALIDITY_RE.test(`${item.id} ${item.label}`));
  const evidenceDims = dims.filter((item) => EVIDENCE_RE.test(`${item.id} ${item.label}`));
  return {
    validity: pct(weighted01(validityDims) ?? kind01(nodes, VALIDITY_KINDS)),
    evidence: pct(weighted01(evidenceDims) ?? kind01(nodes, EVIDENCE_KINDS)),
  };
}
