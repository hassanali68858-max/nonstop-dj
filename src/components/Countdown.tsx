"use client";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";

/** m:ss that rolls smoothly as it counts down. */
export function Countdown({ secs, className = "" }: { secs: number; className?: string }) {
  const s = Math.max(0, Math.floor(secs));
  return (
    <NumberFlowGroup>
      <span className={`mono inline-flex items-baseline ${className}`}>
        <NumberFlow value={Math.floor(s / 60)} trend={-1} />
        <span>:</span>
        <NumberFlow value={s % 60} trend={-1} format={{ minimumIntegerDigits: 2 }} digits={{ 1: { max: 5 } }} />
      </span>
    </NumberFlowGroup>
  );
}
