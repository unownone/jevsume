type LeaderProps = {
  from: DOMRect | null;
  to: DOMRect | null;
};

export function Leader({ from, to }: LeaderProps) {
  if (!from || !to) {
    return null;
  }
  const x1 = from.right;
  const y1 = from.top + from.height / 2;
  const x2 = to.left;
  const y2 = to.top + 22;
  const mid = (x1 + x2) / 2;
  return (
    <svg className="leader" aria-hidden="true">
      <path d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} />
    </svg>
  );
}
