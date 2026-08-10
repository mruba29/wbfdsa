import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/fire-inventory")({
  component: () => <Navigate to="/floor-plans" search={{ view: "inventory" }} replace />,
});
