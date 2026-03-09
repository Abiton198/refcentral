import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ✅ Create the React root
const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// ✅ PWA Service Worker Registration + Auto-refresh on new deployment
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then((registration) => {
        console.log("✅ Service Worker registered:", registration);

        // Check for updates and refresh automatically
        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener("statechange", () => {
            if (newWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                console.log("🔄 New version available — refreshing...");
                newWorker.postMessage("SKIP_WAITING");
                window.location.reload();
              }
            }
          });
        };
      })
      .catch((error) => {
        console.error("❌ Service Worker registration failed:", error);
      });
  });
}
