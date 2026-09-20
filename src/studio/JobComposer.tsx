import type { FormEvent } from "react";
import {
  EMPTY_JOB_TARGET,
  hasJobTarget,
  type JobTargetFields,
} from "../../shared/job-target.ts";
import {
  jobFieldsFromPreset,
  matchPreset,
  presetById,
} from "../../shared/resume-presets.ts";
import { PresetSelect } from "./PresetSelect.tsx";

type JobComposerProps = {
  value: JobTargetFields;
  onChange: (next: JobTargetFields) => void;
  onClose?: () => void;
  variant: "popover" | "plate";
};

export function JobComposer({ value, onChange, onClose, variant }: JobComposerProps) {
  const targeted = hasJobTarget(value);

  function setField<K extends keyof JobTargetFields>(key: K, next: JobTargetFields[K]) {
    onChange({ ...value, [key]: next });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    onClose?.();
  }

  return (
    <form className={`job-composer is-${variant}${targeted ? " is-on" : ""}`} onSubmit={onSubmit}>
      <div className="job-composer-head">
        <h2>{targeted ? "This review is against a job" : "Rate against a job"}</h2>
        <p>
          {targeted
            ? "Jev will score skills fit, missing keywords, role relevance, and seniority for this listing."
            : "Pick a default role, or paste the posting. Title, company, and URL are optional. Skip this and Jev still reviews the page."}
        </p>
      </div>
      <PresetSelect
        id={variant === "plate" ? "job-preset-plate" : "job-preset-pop"}
        value={matchPreset(value)?.id ?? ""}
        allowEmpty
        emptyLabel="Paste your own listing"
        label="Default role"
        onChange={(id) => {
          const preset = presetById(id);
          onChange(preset ? jobFieldsFromPreset(preset) : { ...EMPTY_JOB_TARGET });
        }}
      />
      <label className="job-field">
        <span>Job listing</span>
        <textarea
          value={value.jobText}
          onChange={(event) => setField("jobText", event.target.value)}
          placeholder="Paste the full job posting"
          aria-label="Job listing text"
          rows={variant === "plate" ? 5 : 7}
        />
      </label>
      <div className="job-grid">
        <label className="job-field">
          <span>Title</span>
          <input
            type="text"
            value={value.jobTitle}
            onChange={(event) => setField("jobTitle", event.target.value)}
            placeholder="Staff Backend Engineer"
            aria-label="Job title"
            autoComplete="off"
          />
        </label>
        <label className="job-field">
          <span>Company</span>
          <input
            type="text"
            value={value.company}
            onChange={(event) => setField("company", event.target.value)}
            placeholder="Acme"
            aria-label="Company"
            autoComplete="organization"
          />
        </label>
      </div>
      <label className="job-field">
        <span>Listing URL</span>
        <input
          type="url"
          value={value.jobUrl}
          onChange={(event) => setField("jobUrl", event.target.value)}
          placeholder="https://…"
          aria-label="Job listing URL"
          inputMode="url"
        />
      </label>
      {targeted || onClose ? (
        <div className="job-actions">
          {targeted ? (
            <button className="ghost tight" type="button" onClick={() => onChange({ ...EMPTY_JOB_TARGET })}>
              Clear
            </button>
          ) : null}
          {onClose ? (
            <button className="primary tight" type="submit">
              {targeted ? "Use this job" : "Skip for now"}
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
