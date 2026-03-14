const featured = {
  popular: [
    { symbol: "ETH", name: "Ethereum", contract: "0x4200000000000000000000000000000000000006", decimals: 18, price: 3500, change24h: 1.9, listingStatus: "official" },
    { symbol: "USDC", name: "USD Coin", contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, price: 1, change24h: 0.01, listingStatus: "official" },
    { symbol: "CBBTC", name: "Coinbase Wrapped BTC", contract: "0xCbb7C0000aB88B473b1f5AFd9ef808440eed33bF", decimals: 8, price: 88000, change24h: 0.8, listingStatus: "official" },
    { symbol: "AERO", name: "Aerodrome", contract: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", decimals: 18, price: 1.2, change24h: 4.3, listingStatus: "official" },
    { symbol: "WELL", name: "Moonwell", contract: "0xA88594D404727625A9437C3f886C7643872296AE", decimals: 18, price: 0.07, change24h: 1.4, listingStatus: "official" },
    { symbol: "ZORA", name: "Zora", contract: "0x1111111111166b7FE7bd91427724B487980aFc69", decimals: 18, price: 0.08, change24h: 2.4, listingStatus: "official" }
  ],
  meme: [
    { symbol: "BRETT", name: "Brett", contract: "0x532f27101965dd16442e59d40670faf5ebb142e4", decimals: 18, price: 0.14, change24h: 3.5, listingStatus: "none" },
    { symbol: "DEGEN", name: "Degen", contract: "0x4ed4e862860beef2b1f4e1a6f3c5fcb4f6f8f7f7", decimals: 18, price: 0.015, change24h: -2.1, listingStatus: "none" },
    { symbol: "ZORA", name: "Zora", contract: "0x1111111111166b7FE7bd91427724B487980aFc69", decimals: 18, price: 0.08, change24h: 2.4, listingStatus: "official" }
  ]
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }
  res.status(200).json({ ok: true, sections: featured });
}

