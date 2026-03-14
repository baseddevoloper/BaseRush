const TOKENS = [
  { symbol: "ETH", name: "Ethereum", contract: "0x4200000000000000000000000000000000000006", decimals: 18, price: 3500, change24h: 1.9, mcap: "$420.2B", volume24h: "$12.8B", official: true, popular: true, meme: false },
  { symbol: "USDC", name: "USD Coin", contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, price: 1, change24h: 0.01, mcap: "$35.1B", volume24h: "$7.1B", official: true, popular: true, meme: false },
  { symbol: "CBBTC", name: "Coinbase Wrapped BTC", contract: "0xCbb7C0000aB88B473b1f5AFd9ef808440eed33bF", decimals: 8, price: 88000, change24h: 0.8, mcap: "$5.1B", volume24h: "$680M", official: true, popular: true, meme: false },
  { symbol: "AERO", name: "Aerodrome", contract: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", decimals: 18, price: 1.2, change24h: 4.3, mcap: "$2.1B", volume24h: "$182M", official: true, popular: true, meme: false },
  { symbol: "WELL", name: "Moonwell", contract: "0xA88594D404727625A9437C3f886C7643872296AE", decimals: 18, price: 0.07, change24h: 1.4, mcap: "$280M", volume24h: "$14M", official: true, popular: true, meme: false },
  { symbol: "ZORA", name: "Zora", contract: "0x1111111111166b7FE7bd91427724B487980aFc69", decimals: 18, price: 0.08, change24h: 2.4, mcap: "$370M", volume24h: "$12M", official: true, popular: true, meme: true },
  { symbol: "BRETT", name: "Brett", contract: "0x532f27101965dd16442e59d40670faf5ebb142e4", decimals: 18, price: 0.14, change24h: 3.5, mcap: "$1.3B", volume24h: "$144M", official: false, popular: false, meme: true },
  { symbol: "DEGEN", name: "Degen", contract: "0x4ed4e862860beef2b1f4e1a6f3c5fcb4f6f8f7f7", decimals: 18, price: 0.015, change24h: -2.1, mcap: "$210M", volume24h: "$52M", official: false, popular: false, meme: true }
];

function toItem(t) {
  return {
    symbol: t.symbol,
    name: t.name,
    contract: t.contract,
    decimals: t.decimals,
    price: t.price,
    change24h: t.change24h,
    mcap: t.mcap,
    volume24h: t.volume24h,
    appTrades: 0,
    listingStatus: t.official ? "official" : "none",
    isOfficialListing: t.official,
    isUnofficialListing: false,
    source: "registry"
  };
}

function formatUsdCompact(value) {
  const n = Number(value || 0);
  if (!(n > 0)) return "-";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

async function fetchDexBaseSearch(q) {
  const query = String(q || "").trim();
  if (!query) return [];
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`, {
      headers: { accept: "application/json" }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
    const out = [];
    const seen = new Set();
    for (const p of pairs) {
      if (String(p?.chainId || "").toLowerCase() !== "base") continue;
      const base = p?.baseToken || {};
      const address = String(base?.address || "").toLowerCase();
      const symbol = String(base?.symbol || "").toUpperCase();
      if (!address || !symbol || seen.has(address)) continue;
      seen.add(address);
      out.push({
        symbol,
        name: String(base?.name || symbol),
        contract: address,
        decimals: 18,
        price: Number(p?.priceUsd || 0) || 0,
        change24h: Number(p?.priceChange?.h24 || 0) || 0,
        mcap: formatUsdCompact(p?.fdv || p?.marketCap || 0),
        volume24h: formatUsdCompact(p?.volume?.h24 || 0),
        appTrades: 0,
        listingStatus: "none",
        isOfficialListing: false,
        isUnofficialListing: false,
        source: "dexscreener"
      });
      if (out.length >= 20) break;
    }
    return out;
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const q = String(req.query?.q || "").trim().toLowerCase();
  const listedOnly = String(req.query?.listedOnly || "false").toLowerCase() === "true";

  let items = TOKENS.map(toItem);
  if (q) {
    items = items.filter((t) =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.contract.toLowerCase().includes(q)
    );
    const dex = await fetchDexBaseSearch(q);
    const byContract = new Map(items.map((i) => [String(i.contract || "").toLowerCase(), i]));
    dex.forEach((d) => {
      const key = String(d.contract || "").toLowerCase();
      if (!key || byContract.has(key)) return;
      byContract.set(key, d);
    });
    items = Array.from(byContract.values());
  }

  if (listedOnly) items = items.filter((i) => i.listingStatus !== "none");

  items.sort((a, b) => {
    const rank = (x) => (x.listingStatus === "official" ? 0 : x.listingStatus === "unofficial" ? 1 : 2);
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return Number(b.price || 0) - Number(a.price || 0);
  });

  res.status(200).json({ ok: true, items });
}

