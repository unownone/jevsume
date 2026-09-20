import { describe, expect, it } from "vitest";
import {
  composeJobDescription,
  hasJobTarget,
  jobTargetAsksMentorship,
  jobTargetLabel,
  jobTargetSeniority,
  resumeSeniority,
  seniorityMismatch,
} from "../shared/job-target.ts";

describe("job target helpers", () => {
  it("treats empty fields as untargeted", () => {
    expect(hasJobTarget({ jobText: "  ", jobTitle: "" })).toBe(false);
    expect(jobTargetLabel({})).toBe("Target a job");
  });

  it("composes a listing from paste, title, company, and url", () => {
    const composed = composeJobDescription({
      jobTitle: "Staff Backend Engineer",
      company: "Acme",
      jobUrl: "https://jobs.example.com/staff",
      jobText: "- Kafka in production",
    });
    expect(composed).toContain("Staff Backend Engineer at Acme");
    expect(composed).toContain("Listing: https://jobs.example.com/staff");
    expect(composed).toContain("Kafka in production");
    expect(jobTargetLabel({ jobTitle: "Staff Backend Engineer", company: "Acme" })).toBe(
      "Staff Backend Engineer · Acme",
    );
  });

  it("detects mentorship and seniority from listing copy", () => {
    const target = {
      jobTitle: "Staff Engineer",
      jobText: "Mentors senior engineers. Production Kafka.",
    };
    expect(jobTargetAsksMentorship(target)).toBe(true);
    expect(jobTargetSeniority(target)).toBe("staff");
    expect(seniorityMismatch("staff", resumeSeniority("Software Engineer Intern"))).toBe(true);
    expect(seniorityMismatch("staff", resumeSeniority("Staff Software Engineer"))).toBe(false);
  });
});
