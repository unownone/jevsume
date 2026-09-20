import type { Severity } from "./types.ts";

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case "works":
      return "works";
    case "partial":
      return "partial";
    case "missing":
      return "missing";
    case "risk":
      return "risk";
    default: {
      const _never: never = severity;
      return _never;
    }
  }
}
