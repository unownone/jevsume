export type AnnotationSpan = {
  id: string;
  start: number;
  end: number;
};

export type AnnotatedSegment = {
  text: string;
  findingIds: string[];
  start: number;
  end: number;
};

export function buildAnnotatedSegments(
  text: string,
  spans: AnnotationSpan[],
): AnnotatedSegment[] {
  const bounds = new Set<number>([0, text.length]);
  for (const span of spans) {
    const start = Math.max(0, Math.min(text.length, span.start));
    const end = Math.max(start, Math.min(text.length, span.end));
    bounds.add(start);
    bounds.add(end);
  }
  const points = [...bounds].sort((a, b) => a - b);
  const segments: AnnotatedSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i] ?? 0;
    const end = points[i + 1] ?? start;
    if (start === end) {
      continue;
    }
    const findingIds = spans
      .filter((span) => span.start < end && span.end > start)
      .map((span) => span.id);
    segments.push({
      text: text.slice(start, end),
      findingIds,
      start,
      end,
    });
  }
  return segments;
}

export function severityForFindings(
  findingIds: string[],
  severities: Record<string, string>,
): string {
  const rank: Record<string, number> = {
    risk: 4,
    missing: 3,
    partial: 2,
    works: 1,
  };
  let best = "works";
  let bestRank = 0;
  for (const id of findingIds) {
    const severity = severities[id] ?? "partial";
    const value = rank[severity] ?? 0;
    if (value > bestRank) {
      best = severity;
      bestRank = value;
    }
  }
  return best;
}
