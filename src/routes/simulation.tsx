import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/simulation")({
  component: () => <Navigate to="/vulnerability" replace />,
});
