function pickMiniUserFields(raw) {
  const user = raw && typeof raw === "object" ? raw : {};
  return {
    fid: Number(user.fid || 0) || null,
    username: String(user.username || user.handle || user.userName || "").trim() || null,
    displayName: String(user.displayName || user.display_name || user.name || "").trim() || null,
    pfpUrl: String(user.pfpUrl || user.pfp_url || user?.pfp?.url || "").trim() || null,
    bio: String(user.bio || user?.profile?.bio?.text || "").trim() || null
  };
}

async function fetchFarcasterProfileByAddress(address) {
  const apiKey = String(process.env.NEYNAR_API_KEY || "").trim();
  const normalized = String(address || "").trim().toLowerCase();
  if (!apiKey || !normalized) return null;

  try {
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${encodeURIComponent(normalized)}`;
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-api-key": apiKey
      }
    });
    if (!res.ok) return null;
    const data = await res.json();

    let user =
      data?.users?.[0] ||
      data?.result?.users?.[0] ||
      data?.[normalized]?.[0] ||
      null;

    if (!user && data && typeof data === "object") {
      const anyArray = Object.values(data).find((v) => Array.isArray(v) && v.length > 0);
      user = anyArray?.[0] || null;
    }
    if (!user) return null;

    return {
      fid: Number(user?.fid || 0) || null,
      username: user?.username || null,
      displayName: user?.display_name || user?.displayName || user?.username || null,
      avatarUrl: user?.pfp_url || user?.pfp?.url || null,
      bio: user?.profile?.bio?.text || null
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const miniUser = pickMiniUserFields(body.miniappUser);
  const walletAddress = String(body.walletAddress || body.authAddress || "").trim();
  const remote = walletAddress ? await fetchFarcasterProfileByAddress(walletAddress) : null;

  const fid = Number(body.fid || miniUser.fid || remote?.fid || 0) || null;
  const username = String(body.username || miniUser.username || remote?.username || "").trim() || null;
  const displayName = String(body.displayName || miniUser.displayName || remote?.displayName || "").trim() || null;
  const pfpUrl = String(body.pfpUrl || miniUser.pfpUrl || remote?.avatarUrl || "").trim() || null;
  const bio = String(body.bio || miniUser.bio || remote?.bio || "").trim() || null;

  const resolvedUserId =
    String(body.userId || "").trim() ||
    (fid ? `fc_${fid}` : walletAddress ? `wallet_${walletAddress.toLowerCase()}` : "guest");

  res.status(200).json({
    ok: true,
    userId: resolvedUserId,
    auth: {
      provider: fid ? "farcaster" : "guest",
      fid,
      address: walletAddress || null,
      username
    },
    profile: {
      displayName: displayName || null,
      pfpUrl: pfpUrl || null,
      bio: bio || null,
      verified: {
        farcaster: Boolean(fid),
        baseapp: Boolean(walletAddress),
        twitter: false
      }
    }
  });
}

