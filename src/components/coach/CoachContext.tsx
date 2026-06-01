import { createContext, useContext, useState, ReactNode } from "react";

export type CoachMessage = { role: "user" | "assistant"; content: string };

type CoachContextValue = {
  messages: CoachMessage[];
  setMessages: React.Dispatch<React.SetStateAction<CoachMessage[]>>;
  conversationId: string | null;
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  isOpen: boolean;
  setOpen: (v: boolean) => void;
};

const CoachContext = createContext<CoachContextValue | null>(null);

export function CoachProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isOpen, setOpen] = useState(false);
  return (
    <CoachContext.Provider
      value={{ messages, setMessages, conversationId, setConversationId, isOpen, setOpen }}
    >
      {children}
    </CoachContext.Provider>
  );
}

export function useCoach() {
  const ctx = useContext(CoachContext);
  if (!ctx) throw new Error("useCoach must be used inside CoachProvider");
  return ctx;
}
