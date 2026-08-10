import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/occupancy")({
  component: () => <Navigate to="/vulnerability" replace />,
});
