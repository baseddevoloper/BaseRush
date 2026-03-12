import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [farcasterMiniApp()],
  transports: {
    [base.id]: http("https://mainnet.base.org")
  }
});
