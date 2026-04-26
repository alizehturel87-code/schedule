import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Installability still works without surfacing a noisy runtime error.
    });
  });
}
