import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/occupancy")({
  component: OccupancyRedirect,
});

function OccupancyRedirect() {
  return <Navigate to="/vulnerability" replace />;
}
