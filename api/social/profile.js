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

    const verifiedAccounts = Array.isArray(user?.verified_accounts) ? user.verified_accounts : [];
    const twitterVerified = verifiedAccounts.some((a) => {
      const platform = String(a?.platform || a?.platform_type || a?.type || "").toLowerCase();
      return platform.includes("twitter") || platform === "x";
    });

    const verifiedAddresses = Array.isArray(user?.verified_addresses?.eth_addresses)
      ? user.verified_addresses.eth_addresses
      : [];

    return {
      fid: Number(user?.fid || 0) || null,
      username: user?.username || null,
      displayName: user?.display_name || user?.displayName || user?.username || null,
      avatarUrl: user?.pfp_url || user?.pfp?.url || null,
      bio: user?.profile?.bio?.text || null,
      verified: {
        farcaster: true,
        twitter: twitterVerified,
        baseapp: verifiedAddresses.length > 0
      },
      verifiedAddresses,
      farcasterFollowers: Number(user?.follower_count || user?.followerCount || 0) || 0,
      farcasterFollowing: Number(user?.following_count || user?.followingCount || 0) || 0
    };
  } catch {
    return null;
  }
}

function shortAddr(addr) {
  const a = String(addr || "");
  if (!a || a.length < 10) return a || "guest";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const userId = String(req.query?.userId || "guest");
  const walletAddress = String(req.query?.walletAddress || "").trim();
  const miniUser = pickMiniUserFields(req.query?.miniappUser || null);
  const remote = walletAddress ? await fetchFarcasterProfileByAddress(walletAddress) : null;

  const handle = remote?.username
    ? `@${remote.username}`
    : miniUser.username
      ? `@${miniUser.username}`
      : walletAddress
        ? `@${shortAddr(walletAddress)}`
        : `@${userId}`;

  const profile = {
    userId,
    fid: remote?.fid || miniUser.fid || null,
    handle,
    displayName: remote?.displayName || miniUser.displayName || shortAddr(walletAddress) || userId,
    avatarUrl: remote?.avatarUrl || miniUser.pfpUrl || null,
    bio: remote?.bio || miniUser.bio || "Base network social trader profile",
    walletAddress: walletAddress || null,
    verified: {
      farcaster: Boolean(remote?.verified?.farcaster || miniUser.fid),
      baseapp: Boolean(remote?.verified?.baseapp || walletAddress),
      twitter: Boolean(remote?.verified?.twitter)
    },
    verifiedAddresses: remote?.verifiedAddresses || [],
    socialGraph: {
      appFollowers: 0,
      appFollowing: 0,
      farcasterFollowers: Number(remote?.farcasterFollowers || 0),
      farcasterFollowing: Number(remote?.farcasterFollowing || 0)
    }
  };

  res.status(200).json({ ok: true, profile });
}

