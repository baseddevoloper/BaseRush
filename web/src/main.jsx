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

    async function signalReady() {
      const calls = [
        () => sdk?.actions?.ready?.({}),
        () => window?.miniapp?.sdk?.actions?.ready?.({}),
        () => window?.farcaster?.actions?.ready?.({})
      ];

      for (const call of calls) {
        try {
          const out = call?.();
          if (out && typeof out.then === "function") await out;
          if (!cancelled && typeof window !== "undefined") {
            window.__BASERUSH_READY_SENT__ = true;
          }
          return;
        } catch {
          // try next ready bridge
        }
      }
    }

    if (typeof window !== "undefined" && !window.__BASERUSH_READY_SENT__) {
      signalReady();
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
