import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { sdk } from "@farcaster/miniapp-sdk";
import App from "./App";
import "./index.css";

function Root() {
  useEffect(() => {
    let cancelled = false;

    async function markReady() {
      try {
        await sdk.actions.ready();
      } catch {
        try {
          if (typeof window !== "undefined" && window.miniapp?.sdk?.actions?.ready) {
            await window.miniapp.sdk.actions.ready();
          }
        } catch {
          // no-op fallback
        }
      }

      if (!cancelled && typeof window !== "undefined") {
        window.__BASERUSH_READY_SENT__ = true;
      }
    }

    if (typeof window !== "undefined" && !window.__BASERUSH_READY_SENT__) {
      markReady();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
