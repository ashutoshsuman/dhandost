import { useEffect, useRef } from "react";
import { MessageCircle, X } from "lucide-react";
import { useCoach } from "./CoachContext";
import { CoachChat } from "./CoachChat";

export function CoachLauncher() {
  const { isOpen, setOpen } = useCoach();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panelRef.current) {
        // simple focus trap
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, setOpen]);

  return (
    <>
      <button
        type="button"
        aria-label="Open Coach chat"
        onClick={() => setOpen(!isOpen)}
        className="group fixed bottom-6 right-6 z-40 flex items-center justify-center rounded-full text-white shadow-lg cursor-pointer"
        style={{ width: 52, height: 52, backgroundColor: "#1a9c6e" }}
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute right-full mr-3 px-2 py-1 rounded-md bg-neutral-900 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          Coach
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Coach chat"
            className="absolute right-0 top-0 h-full w-full sm:w-[440px] bg-white shadow-2xl border-l border-neutral-200 flex flex-col animate-in slide-in-from-right duration-200"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
              <h2 className="text-base font-semibold text-neutral-900">Coach</h2>
              <button
                type="button"
                aria-label="Close Coach chat"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md hover:bg-neutral-100 cursor-pointer"
              >
                <X className="h-4 w-4 text-neutral-600" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <CoachChat autoFocus />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
