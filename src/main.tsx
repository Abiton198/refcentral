import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Firebase config passed to the service worker via the URL
// (service workers can't read import.meta.env)
const swParams = new URLSearchParams({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`/firebase-messaging-sw.js?${swParams.toString()}`)
      .then((registration) => {
        console.log("✅ Service Worker registered:", registration);

        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("🔄 New version available — refreshing...");
              newWorker.postMessage("SKIP_WAITING");
              window.location.reload();
            }
          });
        };
      })
      .catch((error) => {
        console.error("❌ Service Worker registration failed:", error);
      });
  });
}