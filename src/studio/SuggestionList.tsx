import { rewriteKindLabel } from "./analyze.ts";
import type { SuggestionCard } from "./types.ts";

type SuggestionListProps = {
  cards: SuggestionCard[];
  selected: string[];
  onToggle: (id: string) => void;
  onOpen?: (findingId: string) => void;
};

export function SuggestionList({ cards, selected, onToggle, onOpen }: SuggestionListProps) {
  if (cards.length === 0) {
    return null;
  }
  const count = selected.length;
  return (
    <div className="suggestion-list" aria-label="Rewrite suggestions">
      <h3>Suggestions</h3>
      <ul>
        {cards.map((card) => {
          const checked = selected.includes(card.id);
          const findingId = card.findingId;
          return (
            <li key={card.id}>
              <label className={`suggestion-card${checked ? " is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(card.id)}
                />
                <span>
                  <strong>{card.title}</strong>
                  {card.recoverPoints ? (
                    <em className="recover">Recover {card.recoverPoints}</em>
                  ) : (
                    <em>{rewriteKindLabel(card.kind)}</em>
                  )}
                  <span className="suggestion-detail">{card.detail}</span>
                  {findingId && onOpen ? (
                    <button
                      type="button"
                      className="linkish"
                      onClick={(event) => {
                        event.preventDefault();
                        onOpen(findingId);
                      }}
                    >
                      Show on page
                    </button>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className={`ghost tight enhance${count > 0 ? " is-armed" : ""}`}
        disabled
        title="Coming soon"
      >
        {count > 0 ? `Enhance ${count}` : "Enhance resume"}
        <span className="soon-tag">Coming soon</span>
      </button>
    </div>
  );
}
