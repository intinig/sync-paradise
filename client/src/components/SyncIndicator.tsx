export function SyncIndicator(props: { offsetMs: number }) {
  const sign = props.offsetMs >= 0 ? "+" : "−";
  const abs = Math.abs(Math.round(props.offsetMs));
  return (
    <div className="sync-indicator" aria-label={`tracking offset ${sign}${abs}ms`}>
      <span className="label">▌ TRK</span>
      <span>{sign}{abs}ms</span>
    </div>
  );
}
