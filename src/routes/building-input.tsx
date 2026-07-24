import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/building-input")({
  component: BuildingInputRedirect,
});

function BuildingInputRedirect() {
  return <Navigate to="/buildings" replace />;
}
