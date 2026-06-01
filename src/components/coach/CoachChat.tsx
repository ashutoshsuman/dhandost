import { useEffect, useRef, useState, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase";
import { useCoach } from "./CoachContext";

const STARTERS = [
  "How am I doing this month?",
  "Which debt should I clear first?",
];

export function CoachChat({
  autoFocus = false,
  className = "",
}: {
  autoFocus?: boolean;
  className?: string;
}) {
  const { messages, setMessages, conversationId, setConversationId } = useCoach();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setPending(true);
    try {
      const { data, error } = await supabase.functions.invoke("financial-chat", {
        body: { conversation_id: conversationId, message },
      });
      if (error || !data || (data as any).error) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Something went wrong — please try again." },
        ]);
      } else {
        const d = data as { conversation_id?: string; reply?: string };
        if (d.conversation_id) setConversationId(d.conversation_id);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: d.reply ?? "Something went wrong — please try again." },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Something went wrong — please try again." },
      ]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div
      className={`flex flex-col h-full bg-white ${className}`}
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div
        ref={listRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto px-5 py-6 space-y-4 focus:outline-none"
      >
        {messages.length === 0 && !pending && (
          <div className="space-y-4 text-[15px]">
            <p style={{ color: "#9aa5b1" }}>
              Ask about your plan, spending, goals, or debts.
            </p>
            <div className="flex flex-col gap-2 items-start">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-left px-3 py-2 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors text-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-neutral-100 text-neutral-900 text-[15px] leading-relaxed whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl px-4 py-3 bg-white border border-neutral-200 text-neutral-900 text-[15px] leading-relaxed coach-markdown">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          ),
        )}

        {pending && (
          <div className="text-sm" style={{ color: "#9aa5b1" }}>
            Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200 p-3 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Message Coach…"
            className="flex-1 resize-none rounded-xl border border-neutral-200 px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-neutral-200 max-h-40"
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={pending || !input.trim()}
            className="rounded-xl px-4 py-2 text-white text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: "#1a9c6e" }}
          >
            Send
          </button>
        </div>
      </div>

      <style>{`
        .coach-markdown h1,.coach-markdown h2,.coach-markdown h3 { font-weight:600; margin:0.5em 0 0.3em; }
        .coach-markdown h1 { font-size:1.1rem; }
        .coach-markdown h2 { font-size:1.05rem; }
        .coach-markdown h3 { font-size:1rem; }
        .coach-markdown p { margin:0.4em 0; }
        .coach-markdown ul,.coach-markdown ol { margin:0.4em 0 0.4em 1.2em; }
        .coach-markdown ul { list-style:disc; }
        .coach-markdown ol { list-style:decimal; }
        .coach-markdown li { margin:0.15em 0; }
        .coach-markdown table { border-collapse:collapse; margin:0.5em 0; font-size:0.92em; }
        .coach-markdown th,.coach-markdown td { border:1px solid #e5e7eb; padding:4px 8px; text-align:left; }
        .coach-markdown th { background:#f9fafb; font-weight:600; }
        .coach-markdown code { background:#f3f4f6; padding:1px 4px; border-radius:4px; font-size:0.9em; }
        .coach-markdown a { color:#1a9c6e; text-decoration:underline; }
      `}</style>
    </div>
  );
}
