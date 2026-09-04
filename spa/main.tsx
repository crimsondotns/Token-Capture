import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { XCapApp } from "@/components/xcap-app";
import "@/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <>
    <XCapApp />
    <Toaster
      theme="dark"
      position="bottom-center"
      toastOptions={{
        className: "font-sans text-sm border-0 bg-surface text-fg rounded-2xl shadow-panel",
      }}
    />
  </>,
);
