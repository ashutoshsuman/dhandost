import { useEffect, useState } from "react";

export function useCyclingMessage(messages: string[], intervalMs = 2500) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => Math.min(i + 1, messages.length - 1));
    }, intervalMs);
    return () => clearInterval(id);
  }, [messages, intervalMs]);
  return messages[index] ?? messages[0] ?? "";
}

export default function CyclingStatus({
  messages,
  intervalMs = 2500,
  className = "",
}: {
  messages: string[];
  intervalMs?: number;
  className?: string;
}) {
  const msg = useCyclingMessage(messages, intervalMs);
  return (
    <p
      key={msg}
      className={`text-sm text-muted-foreground transition-opacity duration-500 ${className}`}
    >
      {msg}
    </p>
  );
}
