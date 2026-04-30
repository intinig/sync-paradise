export function SyncIndicator(props: { offsetMs: number }) {
  const sign = props.offsetMs >= 0 ? "+" : "−";
  const abs = Math.abs(Math.round(props.offsetMs));
  return <div className="sync-indicator">synced {sign}{abs}ms</div>;
}
