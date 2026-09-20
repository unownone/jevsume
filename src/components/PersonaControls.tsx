import { useEffect, useId, useRef } from "react";
import type { FormEvent } from "react";
import type { JobPersonaItem } from "../lib/api.ts";

function personaLabel(persona: JobPersonaItem): string {
  return persona.isDefault ? `${persona.title} (default)` : persona.title;
}

function groupedPersonas(personas: JobPersonaItem[]): {
  defaults: JobPersonaItem[];
  tracks: { label: string; items: JobPersonaItem[] }[];
  custom: JobPersonaItem[];
} {
  const defaults = personas.filter((persona) => persona.isDefault);
  const presets = personas.filter((persona) => persona.isPreset);
  const custom = personas.filter((persona) => !persona.isDefault && !persona.isPreset);
  const tracks: { label: string; items: JobPersonaItem[] }[] = [];
  const index = new Map<string, JobPersonaItem[]>();
  for (const persona of presets) {
    const label = persona.track ?? "Roles";
    let items = index.get(label);
    if (!items) {
      items = [];
      index.set(label, items);
      tracks.push({ label, items });
    }
    items.push(persona);
  }
  return { defaults, tracks, custom };
}

type PersonaControlsProps = {
  personas: JobPersonaItem[];
  personaId: string;
  onPersonaId: (id: string) => void;
  adding: boolean;
  onToggleAdd: () => void;
  title: string;
  tags: string;
  jobDescription: string;
  onTitle: (value: string) => void;
  onTags: (value: string) => void;
  onJobDescription: (value: string) => void;
  onCreate: (event: FormEvent) => void;
  busy: boolean;
  personaBlocked: boolean;
  personaWait: number;
};

export function PersonaControls({
  personas,
  personaId,
  onPersonaId,
  adding,
  onToggleAdd,
  title,
  tags,
  jobDescription,
  onTitle,
  onTags,
  onJobDescription,
  onCreate,
  busy,
  personaBlocked,
  personaWait,
}: PersonaControlsProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const selected = personas.find((item) => item.id === personaId) ?? personas[0];
  const groups = groupedPersonas(personas);

  useEffect(() => {
    const node = dialog.current;
    if (!node) {
      return;
    }
    const onBackdrop = (event: MouseEvent) => {
      if (event.target === node) {
        node.close();
      }
    };
    node.addEventListener("click", onBackdrop);
    return () => node.removeEventListener("click", onBackdrop);
  }, []);

  return (
    <div className="persona-bar">
      <div className="persona-field">
        <label htmlFor="job-persona">Job Persona</label>
        <div className="persona-row">
          <select
            id="job-persona"
            value={personaId}
            onChange={(event) => onPersonaId(event.target.value)}
            aria-label="Job Persona"
          >
            {groups.defaults.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {personaLabel(persona)}
              </option>
            ))}
            {groups.tracks.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {personaLabel(persona)}
                  </option>
                ))}
              </optgroup>
            ))}
            {groups.custom.length > 0 ? (
              <optgroup label="Your jobs">
                {groups.custom.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {personaLabel(persona)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          <button
            type="button"
            className="icon-btn"
            aria-label="About this job persona"
            onClick={() => dialog.current?.showModal()}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 9v4.5M10 6.75h.01"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <button type="button" className="ghost" onClick={onToggleAdd}>
        {adding ? "Close" : "Add a job"}
      </button>

      {adding ? (
        <form className="persona-form" onSubmit={onCreate}>
          <input
            type="text"
            value={title}
            onChange={(event) => onTitle(event.target.value)}
            placeholder="Job title"
            aria-label="Job title"
          />
          <input
            type="text"
            value={tags}
            onChange={(event) => onTags(event.target.value)}
            placeholder="Tags, comma separated"
            aria-label="Job tags"
          />
          <textarea
            value={jobDescription}
            onChange={(event) => onJobDescription(event.target.value)}
            aria-label="Job description"
            placeholder="Paste the job description"
          />
          <button className="ghost" type="submit" disabled={busy || personaBlocked}>
            {personaBlocked ? `Persona limit · ${personaWait}s` : "Save persona"}
          </button>
        </form>
      ) : null}

      <dialog ref={dialog} className="persona-dialog" aria-labelledby={titleId}>
        <div className="dialog-card">
          <h2 id={titleId}>What is a job persona?</h2>
          <p>
            A job persona is the lens Jev uses — the role this resume is trying to speak to. It is
            not a second product mode. You pick one persona, Jev reads the resume through that
            lens, and the notes stay on the page.
          </p>
          {selected ? (
            <>
              <h3>{selected.isDefault ? `${selected.title} (default)` : selected.title}</h3>
              <p>{selected.explanation}</p>
              {selected.tags.length > 0 ? (
                <p className="muted">Tags: {selected.tags.join(", ")}</p>
              ) : null}
            </>
          ) : null}
          <form method="dialog">
            <button className="ghost" type="submit">
              Close
            </button>
          </form>
        </div>
      </dialog>
    </div>
  );
}
