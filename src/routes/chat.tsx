import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { CoachChat } from "@/components/coach/CoachChat";

export const Route = createFileRoute("/chat")({
  component: () => (
    <Layout>
      <div className="mx-auto w-full max-w-[760px]">
        <h1 className="text-2xl font-semibold mb-4">Coach</h1>
        <div className="h-[calc(100vh-220px)] min-h-[480px] rounded-xl border border-neutral-200 overflow-hidden bg-white">
          <CoachChat autoFocus />
        </div>
      </div>
    </Layout>
  ),
});
