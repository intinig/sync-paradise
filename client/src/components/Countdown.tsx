import { useEffect, useState } from "react";

export function Countdown(props: { targetServerMs: number; offsetMs: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const remainingMs = Math.max(0, props.targetServerMs - (now + props.offsetMs));
  const seconds = Math.ceil(remainingMs / 1000);
  return <div className="countdown">{seconds.toString().padStart(2, "0")}</div>;
}
