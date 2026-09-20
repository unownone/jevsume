import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import StudioApp from "./studio/StudioApp.tsx";
import { trackPageview } from "./lib/events.ts";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element missing");
}

trackPageview();

const view = new URLSearchParams(window.location.search).get("view");
const Root = view === "classic" ? App : StudioApp;

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
