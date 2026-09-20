export type JobTarget = {
  jobText?: string;
  jobUrl?: string;
  jobTitle?: string;
  company?: string;
};

export type JobTargetFields = {
  jobText: string;
  jobUrl: string;
  jobTitle: string;
  company: string;
};

export const EMPTY_JOB_TARGET: JobTargetFields = {
  jobText: "",
  jobUrl: "",
  jobTitle: "",
  company: "",
};

export function trimJobTarget(input: JobTarget | null | undefined): JobTarget {
  const jobText = input?.jobText?.trim() || undefined;
  const jobUrl = input?.jobUrl?.trim() || undefined;
  const jobTitle = input?.jobTitle?.trim() || undefined;
  const company = input?.company?.trim() || undefined;
  return { jobText, jobUrl, jobTitle, company };
}

export function hasJobTarget(input: JobTarget | null | undefined): boolean {
  const target = trimJobTarget(input);
  return Boolean(target.jobText || target.jobUrl || target.jobTitle || target.company);
}

export function composeJobDescription(input: JobTarget | null | undefined): string {
  const target = trimJobTarget(input);
  const lines: string[] = [];
  const headline = [target.jobTitle, target.company].filter(Boolean).join(" at ");
  if (headline) {
    lines.push(headline);
  }
  if (target.jobUrl) {
    lines.push(`Listing: ${target.jobUrl}`);
  }
  if (target.jobText) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(target.jobText);
  }
  return lines.join("\n").trim();
}

export function jobTargetLabel(input: JobTarget | null | undefined): string {
  const target = trimJobTarget(input);
  if (target.jobTitle && target.company) {
    return `${target.jobTitle} · ${target.company}`;
  }
  if (target.jobTitle) {
    return target.jobTitle;
  }
  if (target.company) {
    return target.company;
  }
  if (target.jobUrl) {
    try {
      return new URL(target.jobUrl).hostname.replace(/^www\./, "");
    } catch {
      return "Job listing";
    }
  }
  if (target.jobText) {
    const first = target.jobText.split(/\n/)[0]?.replace(/^#+\s*/, "").trim() ?? "";
    if (first.length > 0) {
      return first.length > 42 ? `${first.slice(0, 42).trim()}…` : first;
    }
    return "Job listing";
  }
  return "Target a job";
}

export function jobTargetAsksMentorship(input: JobTarget | null | undefined): boolean {
  return /mentor|mentees|coached|coaching|grow engineers|staff engineer|principal|senior engineer/i.test(
    composeJobDescription(input),
  );
}

export type JobSeniority = "intern" | "junior" | "mid" | "senior" | "staff";

export function jobTargetSeniority(input: JobTarget | null | undefined): JobSeniority | undefined {
  const text = composeJobDescription(input).toLowerCase();
  if (/\bintern(ship)?\b/.test(text)) {
    return "intern";
  }
  if (/\bjunior\b|\bentry[- ]level\b/.test(text)) {
    return "junior";
  }
  if (/\bstaff\b|\bprincipal\b|\bdistinguished\b/.test(text)) {
    return "staff";
  }
  if (/\bsenior\b|\bsr\.?\b/.test(text)) {
    return "senior";
  }
  if (/\bmid[- ]level\b/.test(text)) {
    return "mid";
  }
  return undefined;
}

export function resumeSeniority(text: string): JobSeniority | undefined {
  const lower = text.toLowerCase();
  if (/\bintern(ship)?\b/.test(lower) && !/\bstaff\b|\bsenior\b|\bprincipal\b/.test(lower)) {
    return "intern";
  }
  if (/\bjunior\b|\bentry[- ]level\b/.test(lower)) {
    return "junior";
  }
  if (/\bstaff\b|\bprincipal\b|\bdistinguished\b/.test(lower)) {
    return "staff";
  }
  if (/\bsenior\b|\bsr\.?\b/.test(lower)) {
    return "senior";
  }
  return undefined;
}

const SENIORITY_RANK: Record<JobSeniority, number> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  staff: 4,
};

export function seniorityMismatch(
  wanted: JobSeniority | undefined,
  found: JobSeniority | undefined,
): boolean {
  if (!wanted || !found) {
    return false;
  }
  return SENIORITY_RANK[found] + 1 < SENIORITY_RANK[wanted];
}
