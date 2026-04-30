import { useEffect, useState } from "react";
import { formatCountdown } from "../lib/time.js";

export function Countdown(props: {
  targetServerMs: number;
  offsetMs: number;
  variant?: "numerals" | "inline";
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const remainingMs = Math.max(0, props.targetServerMs - (now + props.offsetMs));
  // formatCountdown rolls over to MM:SS at >=60s so admin-configured
  // COUNTDOWN_SECONDS / COOLDOWN_SECONDS values past a minute display
  // sensibly (e.g. "01 : 30" rather than "00 : 90").
  const text = formatCountdown(Math.ceil(remainingMs / 1000));
  if (props.variant === "inline") {
    return <span className="countdown-inline">{text}</span>;
  }
  return <div className="countdown-numerals">{text}</div>;
}
