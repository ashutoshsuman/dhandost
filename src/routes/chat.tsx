import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";

export const Route = createFileRoute("/chat")({
  component: () => (
    <Layout>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Coming soon. This will be a conversational view over your transactions, goals, and plan.
        </p>
      </div>
    </Layout>
  ),
});
