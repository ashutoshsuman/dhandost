import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ReviewCategories } from "@/components/CategoryReview";
import { SelfTransferReview } from "@/components/SelfTransferReview";

export const Route = createFileRoute("/review")({
  component: () => (
    <Layout>
      <div className="space-y-8">
        <ReviewCategories />
        <SelfTransferReview />
      </div>
    </Layout>
  ),
});
