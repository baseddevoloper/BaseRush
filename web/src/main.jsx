import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";
import App from "./App";
import { wagmiConfig } from "./wagmi";
import "./index.css";

const queryClient = new QueryClient();

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
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Root />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
