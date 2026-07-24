import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/portfolio-map")({
  component: PortfolioMapRedirect,
});

function PortfolioMapRedirect() {
  return <Navigate to="/buildings" replace />;
}
