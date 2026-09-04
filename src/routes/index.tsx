import { createFileRoute } from "@tanstack/react-router";
import { XCapApp } from "@/components/xcap-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <XCapApp />;
}
