import type { JobPersona } from "../../packages/jev/types.ts";

export type StoredResume = {
  id: string;
  text: string;
  filename?: string;
  source?: string;
  createdAt: string;
};

export type PersonaStore = {
  put(persona: JobPersona): Promise<JobPersona>;
  get(id: string): Promise<JobPersona | null>;
  list(): Promise<JobPersona[]>;
};

export type ResumeStore = {
  put(resume: StoredResume): Promise<StoredResume>;
};

export type VisitorRecordResult = {
  uniqueVisitors: number;
  created: boolean;
};

export type VisitorStore = {
  record(visitorId: string): Promise<VisitorRecordResult>;
  count(): Promise<number>;
};
