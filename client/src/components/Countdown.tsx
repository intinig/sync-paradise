import { useEffect, useState } from "react";

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
  const seconds = Math.ceil(remainingMs / 1000);
  const text = `00 : ${seconds.toString().padStart(2, "0")}`;
  if (props.variant === "inline") {
    return <span className="countdown-inline">{text}</span>;
  }
  return <div className="countdown-numerals">{text}</div>;
}
