export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const token = String(req.query?.token || "ETH").trim().toUpperCase();
  const limit = Math.max(1, Math.min(20, Number(req.query?.limit || 6)));

  res.status(200).json({
    ok: true,
    token,
    profile: {
      symbol: token,
      price: 0,
      change24h: 0,
      listingStatus: "none"
    },
    holders: [],
    limit
  });
}

