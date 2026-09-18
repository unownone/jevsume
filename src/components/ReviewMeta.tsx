import { formatDurationMs, formatReviewCost } from "../../shared/format.ts";

type ReviewMetaProps = {
  clientMs: number;
  serverMs: number;
  inputTokens: number;
  costUsd: number;
};

export function ReviewMeta({ clientMs, serverMs, inputTokens, costUsd }: ReviewMetaProps) {
  return (
    <footer className="review-meta" aria-label="Review timing and cost">
      <span>
        Overall <strong>{formatDurationMs(clientMs)}</strong>
      </span>
      <span>
        Jev <strong>{formatDurationMs(serverMs)}</strong>
      </span>
      <span>
        Input tokens <strong>{Math.round(inputTokens).toLocaleString("en-US")}</strong>
      </span>
      <span>
        Est. cost <strong>{formatReviewCost(costUsd)}</strong>
      </span>
    </footer>
  );
}
