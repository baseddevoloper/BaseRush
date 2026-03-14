import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  ssr: true,
  storage: createStorage({
    storage: cookieStorage
  }),
  chains: [base],
  connectors: [
    injected(),
    baseAccount({
      appName: "BaseRush",
      appLogoUrl: "https://baserush.app/icon.png"
    })
  ],
  transports: {
    [base.id]: http("https://mainnet.base.org")
  }
});
