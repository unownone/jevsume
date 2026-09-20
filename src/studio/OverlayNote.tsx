import { useEffect, useRef } from "react";
import type { ChatMessage, OverlayFinding } from "./types.ts";
import { severityLabel } from "./severity.ts";

type OverlayNoteProps = {
  finding: OverlayFinding;
  messages: ChatMessage[];
  draft: string;
  compact: boolean;
  total: number;
  onDraft: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  onIgnore: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function OverlayNote({
  finding,
  messages,
  draft,
  compact,
  total,
  onDraft,
  onSend,
  onClose,
  onIgnore,
  onPrev,
  onNext,
}: OverlayNoteProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [finding.id]);

  return (
    <aside
      className={`overlay-note ${finding.severity}${compact ? " is-sheet" : ""}`}
      aria-labelledby={`note-${finding.id}`}
    >
      <header>
        <span className={`pill ${finding.severity}`}>{severityLabel(finding.severity)}</span>
        <h2 id={`note-${finding.id}`} ref={heading} tabIndex={-1}>
          {finding.title}
        </h2>
        <button type="button" className="icon-quiet" aria-label="Close note" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className="note-pager">
        <button type="button" className="ghost tight" onClick={onPrev} disabled={finding.index <= 1}>
          Prev
        </button>
        <span>
          {finding.index} / {total}
        </span>
        <button type="button" className="ghost tight" onClick={onNext} disabled={finding.index >= total}>
          Next
        </button>
      </div>
      {finding.quote ? <p className="note-quote">{finding.quote}</p> : null}
      <div className="note-thread" role="log">
        {messages.map((message) => (
          <p key={message.id} className={`bubble ${message.from}`}>
            <span>{message.from === "jev" ? "Jev" : "You"}</span>
            {message.text}
          </p>
        ))}
        {finding.rewrite ? (
          <p className="bubble rewrite">
            <span>Rewrite</span>
            {finding.rewrite}
          </p>
        ) : null}
      </div>
      <form
        className="note-compose"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <label className="sr-only" htmlFor={`reply-${finding.id}`}>
          Reply on this mark
        </label>
        <input
          id={`reply-${finding.id}`}
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          placeholder="Ask about this passage"
        />
        <button className="primary tight" type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>
      <div className="note-triggers">
        <button type="button" className="ghost tight" onClick={onIgnore}>
          Ignore
        </button>
        <button type="button" className="ghost tight" onClick={onClose}>
          Keep
        </button>
      </div>
    </aside>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M3 3l8 8M11 3L3 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
