import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/ai-analysis")({
  component: AIAnalysisRedirect,
});

function AIAnalysisRedirect() {
  return <Navigate to="/" replace />;
}
