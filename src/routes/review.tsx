import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ReviewCategories } from "@/components/CategoryReview";

export const Route = createFileRoute("/review")({
  component: () => (
    <Layout>
      <ReviewCategories />
    </Layout>
  ),
});
