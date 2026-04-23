import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress Clerk's internal session keep-alive network errors from the dev
// error overlay. These are transient network blips from Clerk polling
// (e.g. /v1/client/sessions/.../touch) and are not application bugs.
// Clerk handles them internally — they should never surface to the user.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const msg = (event.reason?.message ?? event.reason ?? "").toString();
    if (
      msg.includes("clerk.accounts.dev") ||
      msg.includes("ClerkJS") ||
      (msg.includes("NetworkError") && msg.includes("fetch"))
    ) {
      event.preventDefault();
    }
  });

  window.addEventListener("error", (event) => {
    const msg = (event.message ?? "").toString();
    if (msg.includes("ClerkJS") || msg.includes("clerk.accounts.dev")) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
