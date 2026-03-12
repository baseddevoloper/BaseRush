import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Crown,
  Gift,
  Home,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  UserCircle2
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { sdk } from "@farcaster/miniapp-sdk";

const LS_KEYS = {
  activeToken: "arena_active_token",
  buyAmount: "arena_buy_amount",
  customSell: "arena_custom_sell",
  copySettings: "arena_copy_settings",
  quickAuthToken: "arena_quick_auth_token"
};

function readLocal(key, fallback) {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : raw;
  } catch {
    return fallback;
  }
}

function readLocalJSON(key, fallback) {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const TOKENS = ["ETH", "AERO", "DEGEN", "BRETT", "USDC"];
const POPULAR_TOKENS = [
  { symbol: "ETH", contract: "0x4200000000000000000000000000000000000006", verified: true },
  { symbol: "USDC", contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", verified: true },
  { symbol: "AERO", contract: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", verified: true },
  { symbol: "DEGEN", contract: "0x4ed4e862860beef2b1f4e1a6f3c5fcb4f6f8f7f7", verified: false },
  { symbol: "BRETT", contract: "0x532f27101965dd16442e59d40670faf5ebb142e4", verified: false }
];

const TOKEN_DIRECTORY = [
  {
    symbol: "ETH",
    name: "Ethereum",
    contract: "0x4200000000000000000000000000000000000006",
    verified: true,
    tradable: true,
    price: 3500,
    change24h: 1.92,
    mcap: "$420.2B",
    volume24h: "$12.8B",
    spark: "0,30 16,28 32,26 48,24 64,20 80,18 96,14 112,12",
    holders: [
      { handle: "@GaryGoonsler69", pnl: 335937.39, trades: 48 },
      { handle: "@MidwestMalky", pnl: 86594.31, trades: 31 },
      { handle: "@basewhale", pnl: 48210.1, trades: 28 },
      { handle: "@cipher", pnl: 12864.9, trades: 19 },
      { handle: "@mino", pnl: 2944.16, trades: 8 }
    ]
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    verified: true,
    tradable: true,
    price: 1,
    change24h: 0.01,
    mcap: "$35.1B",
    volume24h: "$7.1B",
    spark: "0,20 16,20 32,20 48,19 64,20 80,20 96,19 112,20",
    holders: [
      { handle: "@stablealpha", pnl: 23103.22, trades: 87 },
      { handle: "@flowpilot", pnl: 16322.44, trades: 61 },
      { handle: "@you", pnl: 6210.38, trades: 24 },
      { handle: "@vaultcat", pnl: 4188.2, trades: 15 },
      { handle: "@brubearr", pnl: 3117.88, trades: 12 }
    ]
  },
  {
    symbol: "AERO",
    name: "Aerodrome",
    contract: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    verified: true,
    tradable: true,
    price: 1.2,
    change24h: 4.32,
    mcap: "$2.1B",
    volume24h: "$182M",
    spark: "0,36 16,34 32,32 48,28 64,24 80,20 96,16 112,10",
    holders: [
      { handle: "@alphaarc", pnl: 78221.4, trades: 34 },
      { handle: "@moontrace", pnl: 31240.18, trades: 22 },
      { handle: "@TheGreek", pnl: 14772.9, trades: 14 },
      { handle: "@rachel_fund", pnl: 5840.02, trades: 11 },
      { handle: "@bullbusterz", pnl: 1999.35, trades: 5 }
    ]
  },
  {
    symbol: "DEGEN",
    name: "Degen",
    contract: "0x4ed4e862860beef2b1f4e1a6f3c5fcb4f6f8f7f7",
    verified: false,
    tradable: true,
    price: 0.015,
    change24h: -2.14,
    mcap: "$210M",
    volume24h: "$52M",
    spark: "0,14 16,16 32,17 48,20 64,24 80,23 96,27 112,30",
    holders: [
      { handle: "@degenbot", pnl: 22580.12, trades: 52 },
      { handle: "@flowpilot", pnl: 10320.8, trades: 27 },
      { handle: "@gazellePunch", pnl: 7422.14, trades: 18 },
      { handle: "@basewhale", pnl: 5330.66, trades: 13 },
      { handle: "@you", pnl: 954.41, trades: 3 }
    ]
  },
  {
    symbol: "BRETT",
    name: "Brett",
    contract: "0x532f27101965dd16442e59d40670faf5ebb142e4",
    verified: false,
    tradable: true,
    price: 0.14,
    change24h: 3.48,
    mcap: "$1.3B",
    volume24h: "$144M",
    spark: "0,35 16,34 32,30 48,27 64,24 80,20 96,16 112,13",
    holders: [
      { handle: "@memechad", pnl: 41120.6, trades: 39 },
      { handle: "@fastlucky", pnl: 21544.23, trades: 21 },
      { handle: "@cipher", pnl: 9145.03, trades: 16 },
      { handle: "@mino", pnl: 3902.74, trades: 10 },
      { handle: "@you", pnl: 682.5, trades: 2 }
    ]
  },
  {
    symbol: "TOSHI",
    name: "Toshi",
    contract: "0xAC1CBaDfA4fCDb4C1A9E8F2fFfA9cA95BfA0f1A7",
    verified: false,
    tradable: false,
    price: 0.00021,
    change24h: 6.91,
    mcap: "$86M",
    volume24h: "$19M",
    spark: "0,38 16,34 32,30 48,28 64,22 80,20 96,14 112,8",
    holders: [
      { handle: "@basealpha", pnl: 18002.1, trades: 17 },
      { handle: "@Malky", pnl: 12500.3, trades: 14 },
      { handle: "@tradercat", pnl: 6601.8, trades: 12 },
      { handle: "@wavepilot", pnl: 2410.9, trades: 6 },
      { handle: "@you", pnl: 0, trades: 0 }
    ]
  }
];

const TAB_ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "friends", label: "Friends", icon: Users },
  { id: "feed", label: "Feed", icon: Bell },
  { id: "referrals", label: "Referrals", icon: Gift },
  { id: "profile", label: "Profile", icon: UserCircle2 }
];

const INITIAL_FEED = [
  { id: "f1", handle: "@basewhale", text: "bought ETH", amount: 4200, ts: "2m", pnl: 983 },
  { id: "f2", handle: "@flowpilot", text: "bought DEGEN", amount: 980, ts: "5m", pnl: 125 },
  { id: "f3", handle: "@moontrace", text: "sold AERO", amount: 1650, ts: "9m", pnl: -230 }
];

const FRIENDS = [
  { id: "u1", handle: "@TheGreek", pnl: 2222.97 },
  { id: "u2", handle: "@cipher", pnl: 864.85 },
  { id: "u3", handle: "@rachel_fund", pnl: 133.45 },
  { id: "u4", handle: "@mino", pnl: 2.9 },
  { id: "u5", handle: "@bullbusterz", pnl: 0 }
];

function buildAuthHeaders(authTokenOverride) {
  const token = authTokenOverride || readLocal(LS_KEYS.quickAuthToken, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiPost(path, body, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...buildAuthHeaders(options.authToken)
  };
  const res = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || "request_failed");
  return data;
}

async function apiGet(path, options = {}) {
  const headers = buildAuthHeaders(options.authToken);
  const res = await fetch(path, { headers });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || "request_failed");
  return data;
}

async function withTimeout(task, ms, label) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function money(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
}

function tokenFromText(text) {
  const match = String(text || "").toUpperCase().match(/\b[A-Z]{2,10}\b/);
  return match ? match[0] : "NOTE";
}

function FeedTradeCard({ item }) {
  const tokenLabel = tokenFromText(item.text);
  const isProfit = item.pnl >= 0;
  const maxReveal = 116;

  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const movedRef = useRef(false);

  const revealProgress = Math.min(1, Math.abs(offsetX) / 42);
  const swipePulse = Math.min(1, Math.abs(offsetX) / maxReveal);

  function beginDrag(clientX) {
    setDragging(true);
    setStartX(clientX);
    movedRef.current = false;
  }

  function onDrag(clientX) {
    if (!dragging) return;
    const base = open ? -maxReveal : 0;
    const delta = clientX - startX;
    const next = Math.max(-maxReveal, Math.min(0, base + delta));
    if (Math.abs(delta) > 8) movedRef.current = true;
    setOffsetX(next);
  }

  function endDrag() {
    if (!dragging) return;
    setDragging(false);
    const nextOpen = offsetX < -56;
    setOpen(nextOpen);
    setOffsetX(nextOpen ? -maxReveal : 0);
  }

  function closeSwipeIfOpen() {
    if (open && !movedRef.current) {
      setOpen(false);
      setOffsetX(0);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_12px_30px_-20px_rgba(0,0,0,0.9)] transition-shadow duration-200">
      <div
        className="absolute inset-y-0 right-0 z-0 flex w-[116px] items-center justify-end gap-1.5 pr-2"
        style={{
          opacity: revealProgress,
          transition: dragging ? "none" : "opacity 180ms ease"
        }}
      >
        <button
          type="button"
          className="rounded-xl bg-zinc-800 px-3 py-2 text-[11px] font-semibold text-zinc-200 transition hover:bg-zinc-700"
          style={{
            transform: `scale(${0.96 + revealProgress * 0.06})`,
            opacity: 0.82 + revealProgress * 0.18
          }}
          onClick={() => {
            setOpen(false);
            setOffsetX(0);
          }}
        >
          Watch
        </button>
        <button
          type="button"
          className="rounded-xl bg-primary/90 px-3 py-2 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary"
          style={{
            transform: `scale(${0.96 + revealProgress * 0.08})`,
            boxShadow: revealProgress > 0.2 ? "0 0 0 1px rgba(139,92,246,0.35), 0 10px 24px -16px rgba(139,92,246,0.85)" : "none"
          }}
          onClick={() => {
            setOpen(false);
            setOffsetX(0);
          }}
        >
          Copy
        </button>
      </div>

      <div
        className="relative z-10 rounded-2xl bg-zinc-950/95 p-3 backdrop-blur"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: dragging ? "none" : "transform 220ms cubic-bezier(0.22,1,0.36,1)",
          touchAction: "pan-y",
          willChange: "transform",
          boxShadow: open
            ? "0 0 0 1px rgba(139,92,246,0.35), 0 16px 30px -24px rgba(139,92,246,0.9)"
            : "0 0 0 1px rgba(255,255,255,0.02)",
          border: open ? "1px solid rgba(139,92,246,0.28)" : "1px solid rgba(255,255,255,0.06)",
          scale: 1 - swipePulse * 0.006
        }}
        onClick={closeSwipeIfOpen}
        onTouchStart={(e) => beginDrag(e.touches[0].clientX)}
        onTouchMove={(e) => onDrag(e.touches[0].clientX)}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
        onMouseDown={(e) => beginDrag(e.clientX)}
        onMouseMove={(e) => onDrag(e.clientX)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 h-10 w-10 rounded-full bg-gradient-to-br from-primary/70 to-primary/20" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold leading-none">{item.handle}</p>
                <Badge variant="muted" className="h-5 rounded-full px-2 text-[10px]">
                  {tokenLabel}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-zinc-200">{item.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.amount ? money(item.amount) : "Social note"}</p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[11px] text-muted-foreground">{item.ts}</p>
            <div
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                isProfit ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
              }`}
            >
              {isProfit ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {item.pnl ? money(item.pnl) : "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function ProfileHero({ handle, wallet, premium, followers, following, copiers }) {
  const positive = wallet.totalPnl >= 0;
  const spark = positive
    ? "0,40 12,33 24,36 36,24 48,30 60,22 72,26 84,16 96,20 108,10"
    : "0,18 12,24 24,20 36,30 48,26 60,34 72,30 84,38 96,34 108,42";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/30 via-card to-card p-4">
      <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/35 blur-2xl" />
      <div className="absolute -left-8 bottom-0 h-20 w-20 rounded-full bg-emerald-500/20 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{handle}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{money(wallet.usdc)}</p>
          <p className={`mt-1 text-sm font-medium ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            {positive ? "+" : ""}
            {money(wallet.totalPnl)} 24h
          </p>
        </div>
        <Badge variant={premium.active ? "success" : "muted"} className="rounded-full">
          {premium.active ? "Premium" : "Free"}
        </Badge>
      </div>

      <div className="relative mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Performance</span>
          <span>24h</span>
        </div>
        <svg viewBox="0 0 108 44" className="mt-2 h-10 w-full">
          <polyline fill="none" stroke="currentColor" strokeWidth="2.2" className={positive ? "text-emerald-400" : "text-rose-400"} points={spark} />
        </svg>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">
          <p className="text-base font-semibold text-foreground">{followers}</p>
          <p className="text-muted-foreground">Followers</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">
          <p className="text-base font-semibold text-foreground">{following}</p>
          <p className="text-muted-foreground">Following</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">
          <p className="text-base font-semibold text-foreground">{copiers}</p>
          <p className="text-muted-foreground">Copiers</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [userId, setUserId] = useState("");
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  const [activeToken, setActiveToken] = useState(() => readLocal(LS_KEYS.activeToken, "ETH"));
  const [tokenQuery, setTokenQuery] = useState("");
  const [contractInput, setContractInput] = useState("");
  const [buyAmount, setBuyAmount] = useState(() => readLocal(LS_KEYS.buyAmount, "50"));
  const [customSell, setCustomSell] = useState(() => readLocal(LS_KEYS.customSell, ""));
  const [depositAmount, setDepositAmount] = useState("100");
  const [note, setNote] = useState("");
  const [globalTokenQuery, setGlobalTokenQuery] = useState("");
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState(TOKEN_DIRECTORY[0].symbol);
  const [tokenExplorerHint, setTokenExplorerHint] = useState("");

  const [loading, setLoading] = useState(false);
  const [tokenDirectory, setTokenDirectory] = useState(TOKEN_DIRECTORY);
  const [tokenHolders, setTokenHolders] = useState(TOKEN_DIRECTORY[0].holders || []);
  const [quote, setQuote] = useState(null);
  const [lastTx, setLastTx] = useState(null);
  const [wallet, setWallet] = useState({ usdc: 0, feesPaid: 0, realizedPnl: 0, unrealizedPnl: 0, totalPnl: 0 });
  const [positions, setPositions] = useState({});
  const [premium, setPremium] = useState({ active: false, expiresAt: null });
  const [inbox, setInbox] = useState([]);
  const [feed, setFeed] = useState(INITIAL_FEED);
  const [onchainConfig, setOnchainConfig] = useState(null);
  const [smokeStatus, setSmokeStatus] = useState(null);
  const [isInMiniAppContext, setIsInMiniAppContext] = useState(false);
  const [autoConnectTried, setAutoConnectTried] = useState(false);
  const [connectHint, setConnectHint] = useState("");
  const [miniContext, setMiniContext] = useState(null);
  const [manifestStatus, setManifestStatus] = useState(null);
  const [notificationState, setNotificationState] = useState({
    status: "idle",
    message: "",
    token: "",
    url: ""
  });
  const [copySettings, setCopySettings] = useState(() => readLocalJSON(LS_KEYS.copySettings, {
    enabled: true,
    ratio: 0.2,
    maxUsdcPerTrade: 25,
    slippageBps: 100
  }));

  const profileHandle = useMemo(() => {
    const username = String(miniContext?.user?.username || "").trim();
    if (username) return `@${username}`;
    return userId ? `@${userId}` : "@you";
  }, [miniContext?.user?.username, userId]);

  const currentPosition = positions[activeToken] || null;
  const holdings = useMemo(() => Object.entries(positions).filter(([, p]) => p.amount > 0), [positions]);
  const filteredTokens = useMemo(() => {
    const q = tokenQuery.trim().toUpperCase();
    if (!q) return TOKENS;
    return TOKENS.filter((t) => t.includes(q));
  }, [tokenQuery]);

  const selectedTokenProfile = useMemo(
    () => tokenDirectory.find((t) => t.symbol === selectedTokenSymbol) || tokenDirectory[0] || TOKEN_DIRECTORY[0],
    [selectedTokenSymbol, tokenDirectory]
  );

  const filteredTokenDirectory = useMemo(() => {
    const q = globalTokenQuery.trim().toLowerCase();
    if (!q) return tokenDirectory;
    return tokenDirectory.filter((t) =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.contract.toLowerCase().includes(q)
    );
  }, [globalTokenQuery, tokenDirectory]);

  const socialStats = useMemo(() => {
    const followers = 128 + Math.max(0, feed.length - 3) * 2;
    const following = 42;
    const copiers = premium.active ? 9 : 0;
    return { followers, following, copiers };
  }, [feed.length, premium.active]);

  useEffect(() => {
    async function loadDirectory() {
      try {
        const out = await apiGet(`/api/token/search?q=${encodeURIComponent(globalTokenQuery.trim())}`);
        if (Array.isArray(out.items) && out.items.length > 0) {
          setTokenDirectory(out.items);
          if (!out.items.find((t) => t.symbol === selectedTokenSymbol)) {
            setSelectedTokenSymbol(out.items[0].symbol);
          }
        }
      } catch {
        // keep local fallback directory in MVP
      }
    }
    loadDirectory();
  }, [globalTokenQuery, selectedTokenSymbol]);

  useEffect(() => {
    if (!selectedTokenProfile?.symbol) return;
    async function loadInsights() {
      try {
        const out = await apiGet(`/api/token/insights?token=${encodeURIComponent(selectedTokenProfile.symbol)}`);
        if (out.token) {
          setTokenDirectory((prev) => {
            const exists = prev.some((t) => t.symbol === out.token.symbol);
            if (!exists) return [out.token, ...prev];
            return prev.map((t) => (t.symbol === out.token.symbol ? out.token : t));
          });
        }
        setTokenHolders(Array.isArray(out.holders) ? out.holders : []);
      } catch {
        setTokenHolders(selectedTokenProfile.holders || []);
      }
    }
    loadInsights();
  }, [selectedTokenProfile?.symbol]);

  useEffect(() => {
    let mounted = true;
    sdk
      .isInMiniApp()
      .then((ok) => {
        const fallback = typeof window !== "undefined" && !!(window.miniapp?.sdk || window.farcaster);
        if (mounted) setIsInMiniAppContext(!!ok || fallback);
      })
      .catch(() => {
        const fallback = typeof window !== "undefined" && !!(window.miniapp?.sdk || window.farcaster);
        if (mounted) setIsInMiniAppContext(!!fallback);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMiniContext() {
      if (!isInMiniAppContext) {
        setMiniContext(null);
        return;
      }
      try {
        const ctx = await withTimeout(() => sdk.context, 1800, "sdk.context");
        if (!cancelled) setMiniContext(ctx || null);
      } catch {
        if (!cancelled) setMiniContext(null);
      }
    }
    loadMiniContext();
    return () => {
      cancelled = true;
    };
  }, [isInMiniAppContext]);

  useEffect(() => {
    let cancelled = false;
    async function loadManifestStatus() {
      try {
        const out = await apiGet("/api/miniapp/manifest-status");
        if (!cancelled) setManifestStatus(out.manifest || null);
      } catch {
        if (!cancelled) setManifestStatus(null);
      }
    }
    loadManifestStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onEnabled({ notificationDetails }) {
      setNotificationState({
        status: "enabled",
        message: "Notifications enabled.",
        token: notificationDetails?.token || "",
        url: notificationDetails?.url || ""
      });
    }

    function onDisabled() {
      setNotificationState({
        status: "disabled",
        message: "Notifications disabled.",
        token: "",
        url: ""
      });
    }

    function onAdded({ notificationDetails }) {
      setNotificationState({
        status: "added",
        message: "Mini app added successfully.",
        token: notificationDetails?.token || "",
        url: notificationDetails?.url || ""
      });
    }

    function onRejected({ reason }) {
      setNotificationState({
        status: "rejected",
        message: `Add mini app rejected: ${reason || "unknown_reason"}`,
        token: "",
        url: ""
      });
    }

    sdk.on("notificationsEnabled", onEnabled);
    sdk.on("notificationsDisabled", onDisabled);
    sdk.on("miniAppAdded", onAdded);
    sdk.on("miniAppAddRejected", onRejected);

    return () => {
      sdk.off("notificationsEnabled", onEnabled);
      sdk.off("notificationsDisabled", onDisabled);
      sdk.off("miniAppAdded", onAdded);
      sdk.off("miniAppAddRejected", onRejected);
    };
  }, []);
  useEffect(() => {
    async function loadOnchainConfig() {
      try {
        const out = await apiGet("/api/onchain/config");
        setOnchainConfig(out.onchain || null);
      } catch {
        setOnchainConfig(null);
      }
    }
    loadOnchainConfig();
  }, [connected]);

  useEffect(() => {
    async function loadCopySettings() {
      if (!connected || !userId) return;
      try {
        const out = await apiGet(`/api/copytrade/settings?userId=${encodeURIComponent(userId)}`);
        if (out.settings) setCopySettings(out.settings);
      } catch {
        // keep local defaults
      }
    }
    loadCopySettings();
  }, [connected, userId]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(LS_KEYS.activeToken, String(activeToken || "ETH"));
      window.localStorage.setItem(LS_KEYS.buyAmount, String(buyAmount || ""));
      window.localStorage.setItem(LS_KEYS.customSell, String(customSell || ""));
      window.localStorage.setItem(LS_KEYS.copySettings, JSON.stringify(copySettings || {}));
    } catch {
      // ignore localStorage failures in embedded browsers
    }
  }, [activeToken, buyAmount, customSell, copySettings]);

  useEffect(() => {
    if (!activeToken || Number(buyAmount || 0) <= 0) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const out = await apiGet(
          `/api/trade/quote?token=${encodeURIComponent(activeToken)}&side=BUY&amountUsdc=${encodeURIComponent(buyAmount)}&userId=${encodeURIComponent(userId || "guest")}`
        );
        setQuote(out.quote || null);
      } catch {
        setQuote(null);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [activeToken, buyAmount, userId]);
  async function refreshSummary(nextUserId = userId) {
    if (!nextUserId) return;
    const [summary, premiumStatus, inboxOut] = await Promise.all([
      apiGet(`/api/wallet/summary?userId=${encodeURIComponent(nextUserId)}`),
      apiGet(`/api/premium/status?userId=${encodeURIComponent(nextUserId)}`),
      apiGet(`/api/notifications/inbox?userId=${encodeURIComponent(nextUserId)}`)
    ]);

    setWallet(summary.wallet);
    setPositions(summary.positions || {});
    setPremium(premiumStatus.premium || { active: false, expiresAt: null });
    setInbox(inboxOut.items || []);
  }

  async function resolveMiniAppIdentity({ interactive = false } = {}) {
    const identity = { fid: null, username: null, address: null };

    try {
      const ctx = await withTimeout(() => sdk.context, 1600, "sdk.context");
      identity.fid = Number(ctx?.user?.fid || 0) || null;
      identity.username = ctx?.user?.username || null;
      identity.address =
        ctx?.user?.verifiedAddresses?.ethAddresses?.[0] ||
        ctx?.user?.custodyAddress ||
        null;
    } catch {
      // continue with best-effort identity
    }

    try {
      const provider = await withTimeout(() => sdk.wallet.getEthereumProvider(), 1800, "wallet provider");
      if (provider?.request) {
        let accounts = await withTimeout(() => provider.request({ method: "eth_accounts" }), 1800, "eth_accounts");
        if ((!Array.isArray(accounts) || !accounts[0]) && interactive) {
          accounts = await withTimeout(() => provider.request({ method: "eth_requestAccounts" }), 4000, "eth_requestAccounts");
        }
        if (Array.isArray(accounts) && accounts[0]) identity.address = String(accounts[0]);
      }
    } catch {
      // wallet provider may be unavailable on some clients
    }

    return identity;
  }

  async function handleConnect() {
    setLoading(true);
    setConnectHint("Connecting mini app wallet...");
    try {
      const liveInMini = await withTimeout(() => sdk.isInMiniApp(), 1600, "isInMiniApp")
        .catch(() => typeof window !== "undefined" && !!(window.miniapp?.sdk || window.farcaster));
      setIsInMiniAppContext(!!liveInMini);
      if (!liveInMini) throw new Error("open_in_farcaster_or_base_app");

      const identity = await resolveMiniAppIdentity({ interactive: true });
      setConnectHint("Requesting Farcaster auth...");
      const qa = await withTimeout(() => sdk.quickAuth.getToken(), 7000, "quickAuth.getToken");
      const authToken = qa?.token || "";
      if (!authToken) throw new Error("quick_auth_token_missing");

      try {
        if (typeof window !== "undefined") window.localStorage.setItem(LS_KEYS.quickAuthToken, authToken);
      } catch {
        // ignore storage failures in embedded browser
      }

      setConnectHint("Authorizing session...");
      const resolvedUserId = userId.trim() || (identity.fid ? `fc_${identity.fid}` : `arena_${Date.now()}`);
      const login = await apiPost(
        "/api/auth/login",
        {
          provider: "farcaster",
          userId: resolvedUserId,
          fid: identity.fid,
          username: identity.username || "you",
          address: identity.address
        },
        { authToken }
      );
      setConnectHint(identity.address ? `Connected: ${identity.address}` : "Connected via Farcaster context");

      setUserId(login.session.userId);
      setConnected(true);
      setAutoConnectTried(true);
      await refreshSummary(login.session.userId);
    } catch (err) {
      setConnected(false);
      setConnectHint(`Connect failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isInMiniAppContext || connected || loading || autoConnectTried) return;

    let cancelled = false;
    async function runAutoConnect() {
      setLoading(true);
      try {
        const identity = await resolveMiniAppIdentity();
        let authToken = sdk.quickAuth?.token || readLocal(LS_KEYS.quickAuthToken, "");
        if (!authToken) {
          try {
            if (!cancelled) setConnectHint("Auto verifying session...");
            const qa = await withTimeout(() => sdk.quickAuth.getToken(), 5000, "quickAuth.getToken");
            authToken = qa?.token || "";
            if (authToken && typeof window !== "undefined") {
              window.localStorage.setItem(LS_KEYS.quickAuthToken, authToken);
            }
          } catch {
            // requires explicit user interaction in some clients
          }
        }
        if (!authToken) {
          if (!cancelled) setConnectHint("Tap Connect Mini App to verify your Farcaster session");
          return;
        }

        const resolvedUserId = userId.trim() || (identity.fid ? `fc_${identity.fid}` : `arena_${Date.now()}`);

        const login = await apiPost(
          "/api/auth/login",
          {
            provider: "farcaster",
            userId: resolvedUserId,
            fid: identity.fid,
            username: identity.username || "you",
            address: identity.address
          },
          { authToken }
        );

        if (cancelled) return;
        setUserId(login.session.userId);
        setConnected(true);
        setConnectHint(identity.address ? `Wallet: ${identity.address}` : "Connected via Farcaster");
        await refreshSummary(login.session.userId);
      } catch (err) {
        if (!cancelled) setConnectHint(`Auto connect failed: ${err.message}`);
      } finally {
        if (!cancelled) {
          setAutoConnectTried(true);
          setLoading(false);
        }
      }
    }

    runAutoConnect();
    return () => {
      cancelled = true;
    };
  }, [isInMiniAppContext, connected, loading, autoConnectTried, userId]);

  async function applyContractToken() {
    const normalized = contractInput.trim();
    if (!normalized) return;

    try {
      const out = await apiGet(`/api/token/resolve?contract=${encodeURIComponent(normalized)}`);
      setActiveToken(out.token.symbol);
      setContractInput(out.token.contract);
    } catch (err) {
      alert(`Token resolve failed: ${err.message}`);
    }
  }

  async function handleDeposit() {
    if (!userId) return;
    setLoading(true);
    try {
      await apiPost("/api/balance/deposit-usdc", { userId, amount: Number(depositAmount || 0) });
      await refreshSummary();
    } catch (err) {
      alert(`Deposit failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handlePremium() {
    if (!userId) return;
    setLoading(true);
    try {
      await apiPost("/api/premium/activate", { userId, idempotencyKey: `premium_react_${Date.now()}` });
      await refreshSummary();
    } catch (err) {
      alert(`Premium failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleBuyAndNote() {
    if (!userId) return;
    setLoading(true);
    try {
      const out = await apiPost("/api/trade/execute-onchain", {
        userId,
        token: activeToken,
        side: "BUY",
        amountUsdc: Number(buyAmount || 0),
        idempotencyKey: `buy_react_${activeToken}_${Date.now()}`
      });

      setLastTx(out.tx || null);

      setFeed((prev) => [{ id: `f_${Date.now()}`, handle: "@you", text: `bought ${activeToken}`, amount: Number(buyAmount || 0), ts: "now", pnl: 0 }, ...prev].slice(0, 60));

      if (note.trim()) {
        setFeed((prev) => [{ id: `n_${Date.now()}`, handle: "@you", text: `note: ${note.trim()}`, amount: 0, ts: "now", pnl: 0 }, ...prev].slice(0, 60));
        setNote("");
      }

      await refreshSummary();
    } catch (err) {
      alert(`Buy failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSellAmount(qty) {
    if (!userId || !qty || qty <= 0) return;
    setLoading(true);
    try {
      const out = await apiPost("/api/trade/execute-onchain", {
        userId,
        token: activeToken,
        side: "SELL",
        tokenAmount: Number(qty.toFixed(6)),
        idempotencyKey: `sell_react_${activeToken}_${Date.now()}`
      });

      setFeed((prev) => [{
        id: `s_${Date.now()}`,
        handle: "@you",
        text: `sold ${Number(qty).toFixed(6)} ${activeToken}`,
        amount: out.trade?.grossUsdc || 0,
        ts: "now",
        pnl: out.trade?.realizedPnl || 0
      }, ...prev].slice(0, 60));

      setCustomSell("");
      setLastTx(out.tx || null);
      await refreshSummary();
    } catch (err) {
      alert(`Sell failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSellByPct(pct) {
    if (!currentPosition || !userId) return;
    setLoading(true);
    try {
      const out = await apiPost("/api/trade/execute-onchain", {
        userId,
        token: activeToken,
        side: "SELL",
        sellPercent: Number(pct),
        idempotencyKey: `sell_pct_react_${activeToken}_${pct}_${Date.now()}`,
        onchain: { slippageBps: Number(copySettings?.slippageBps || 100) }
      });
      setFeed((prev) => [{
        id: `sp_${Date.now()}`,
        handle: "@you",
        text: `sold ${pct}% ${activeToken}`,
        amount: out.trade?.grossUsdc || 0,
        ts: "now",
        pnl: out.trade?.realizedPnl || 0
      }, ...prev].slice(0, 60));
      setLastTx(out.tx || null);
      await refreshSummary();
    } catch (err) {
      alert(`Sell failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSellCustomPercent() {
    const pct = Number(customSell || 0);
    if (!pct || pct <= 0 || pct > 100) {
      alert("Custom percent must be between 0 and 100.");
      return;
    }
    await handleSellByPct(pct);
  }
  async function handleCopyTradeTest() {
    if (!userId || !premium.active) return;
    setLoading(true);
    try {
      const out = await apiPost("/api/copytrade/execute-onchain", {
        followerUserId: userId,
        leaderUserId: "basewhale",
        token: activeToken,
        side: "BUY",
        amountUsdc: Number(buyAmount || 0),
        copyRatio: Number(copySettings?.ratio || 0.2),
        idempotencyKey: "copy_react_" + activeToken + "_" + Date.now(),
        onchain: { slippageBps: Number(copySettings?.slippageBps || 100) }
      });
      setLastTx(out.tx || null);
      await refreshSummary();
    } catch (err) {
      alert(`Copy trade failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleOnchainSmoke() {
    if (!userId) return;
    setLoading(true);
    setSmokeStatus(null);
    try {
      const out = await apiPost("/api/onchain/smoke", {
        userId,
        token: activeToken,
        side: "BUY",
        amountUsdc: Number(buyAmount || 1)
      });
      setSmokeStatus({ ok: true, mode: out.mode, tx: out.tx });
      if (out.tx) setLastTx(out.tx);
    } catch (err) {
      setSmokeStatus({ ok: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCopySettings() {
    if (!userId) return;
    setLoading(true);
    try {
      const out = await apiPost("/api/copytrade/settings", {
        userId,
        enabled: !!copySettings.enabled,
        ratio: Math.max(0.01, Math.min(1, Number(copySettings.ratio || 0.2))),
        maxUsdcPerTrade: Number(copySettings.maxUsdcPerTrade || 25),
        slippageBps: Number(copySettings.slippageBps || 100)
      });
      setCopySettings(out.settings || copySettings);
      alert("Copy settings saved.");
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }
  async function handleEnableNotifications() {
    setLoading(true);
    try {
      const inMini = await sdk.isInMiniApp();
      if (!inMini) {
        setNotificationState({
          status: "error",
          message: "Open this app inside Farcaster to enable notifications.",
          token: "",
          url: ""
        });
        return;
      }

      const out = await sdk.actions.addMiniApp();
      setNotificationState({
        status: "requested",
        message: "Notification permission requested.",
        token: out?.notificationDetails?.token || "",
        url: out?.notificationDetails?.url || ""
      });
    } catch (err) {
      const raw = String(err?.name || err?.message || "unknown_error");
      const normalized = raw.includes("RejectedByUser")
        ? "User rejected mini app add request."
        : raw.includes("InvalidDomainManifest")
          ? "Manifest is invalid for addMiniApp."
          : `Enable failed: ${raw}`;

      setNotificationState({
        status: "error",
        message: normalized,
        token: "",
        url: ""
      });
    } finally {
      setLoading(false);
    }
  }
  async function handleComposeCast() {
    try {
      const text = `I am trading ${activeToken} on BaseRush`;
      await sdk.actions.composeCast({ text, embeds: ["https://baserush.app"] });
      setConnectHint("Compose opened in Farcaster");
    } catch (err) {
      setConnectHint(`Compose failed: ${err?.message || "unknown_error"}`);
    }
  }

  async function handleViewMiniProfile() {
    try {
      const fid = Number(miniContext?.user?.fid || 0);
      if (!fid) {
        setConnectHint("Profile action unavailable: missing fid");
        return;
      }
      await sdk.actions.viewProfile({ fid });
      setConnectHint(`Opened profile fid ${fid}`);
    } catch (err) {
      setConnectHint(`View profile failed: ${err?.message || "unknown_error"}`);
    }
  }

  async function handleOpenBaseScan() {
    try {
      const token = selectedTokenProfile?.contract || "0x4200000000000000000000000000000000000006";
      await sdk.actions.openUrl(`https://basescan.org/token/${token}`);
      setConnectHint("Opened BaseScan token page");
    } catch (err) {
      setConnectHint(`openUrl failed: ${err?.message || "unknown_error"}`);
    }
  }

  async function handleCloseMiniApp() {
    try {
      await sdk.actions.close();
    } catch (err) {
      setConnectHint(`Close action failed: ${err?.message || "unknown_error"}`);
    }
  }

  function handleUseTokenFromExplorer(token) {
    setSelectedTokenSymbol(token.symbol);
    setContractInput(token.contract);

    if (TOKENS.includes(token.symbol)) {
      setActiveToken(token.symbol);
      setTokenExplorerHint(`${token.symbol} selected for Quick Trade`);
      return;
    }

    setTokenExplorerHint(`${token.symbol} added to watch. Not tradable in MVP.`);
  }

  return (
    <div className="mx-auto max-w-md px-3 pb-28 pt-4">
      <Card className="mb-4 border-primary/35 bg-gradient-to-br from-primary/20 to-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>BASERUSH APP</CardDescription>
              <CardTitle className="text-xl">BaseRush</CardTitle>
            </div>
            <Badge variant={connected ? "success" : "muted"}>{connected ? "Connected" : "Guest"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded-lg border border-white/10 bg-muted/30 px-3 py-2 text-sm">
            Active profile: <span className="font-medium">{profileHandle}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleConnect} disabled={loading}>{loading ? "Connecting..." : connected ? "Connected" : "Connect Mini App"}</Button>
            <Button variant="outline" onClick={() => refreshSummary()} disabled={!connected || loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
          {connectHint && <p className="text-xs text-muted-foreground">{connectHint.replace("open_in_farcaster_or_base_app", "Open this mini app inside Farcaster/Base app")}</p>}
        </CardContent>
      </Card>

      {activeTab === "home" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="rounded-2xl border-white/10">
              <CardHeader>
                <CardDescription>Portfolio</CardDescription>
                <CardTitle>{money(wallet.usdc)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between"><span>24h</span><span className={wallet.totalPnl >= 0 ? "text-green-400" : "text-red-400"}>{money(wallet.totalPnl)}</span></div>
                <div className="flex justify-between"><span>Fees</span><span>{money(wallet.feesPaid)}</span></div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-white/10">
              <CardHeader>
                <CardDescription>Quick Deposit</CardDescription>
                <CardTitle className="text-base">Top Up USDC</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                <Button className="w-full" variant="outline" onClick={handleDeposit} disabled={!connected || loading}>Deposit</Button>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-2xl border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Spotlight</CardTitle>
                <Badge variant="muted" className="rounded-full">
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> {inbox.length} alerts
                </Badge>
              </div>
              <CardDescription>Top movers in app right now</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {FRIENDS.slice(0, 2).map((f) => (
                  <div key={f.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="text-xs text-muted-foreground">{f.handle}</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-400">{money(f.pnl)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Popular Tokens</CardTitle>
              <CardDescription>Tap to quick-select token, contract prefilled</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {POPULAR_TOKENS.map((token) => (
                <button
                  key={token.symbol}
                  type="button"
                  onClick={() => {
                    setActiveToken(token.symbol);
                    setContractInput(token.contract);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-muted/30 p-3 text-left transition hover:border-primary/40"
                >
                  <div className="flex items-center justify-between">
                    <strong className="flex items-center gap-1.5">
                      {token.symbol}
                      {token.verified && <ShieldCheck className="h-4 w-4 text-primary" />}
                    </strong>
                    <Badge variant="muted" className="rounded-full">Popular</Badge>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{token.contract}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Token Explorer</CardTitle>
              <CardDescription>General search, token page, app holders leaderboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  value={globalTokenQuery}
                  onChange={(e) => setGlobalTokenQuery(e.target.value)}
                  placeholder="Search symbol, name or contract..."
                />
                <Button variant="outline"><Search className="h-4 w-4" /></Button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {filteredTokenDirectory.slice(0, 8).map((token) => (
                  <button
                    key={token.symbol}
                    type="button"
                    onClick={() => {
                      setSelectedTokenSymbol(token.symbol);
                      setContractInput(token.contract);
                    }}
                    className={selectedTokenProfile.symbol === token.symbol ? "min-w-[96px] rounded-xl border border-primary/60 bg-primary/10 px-3 py-2 text-left transition" : "min-w-[96px] rounded-xl border border-white/10 bg-muted/30 px-3 py-2 text-left transition hover:border-primary/30"}
                  >
                    <p className="text-sm font-semibold">{token.symbol}</p>
                    <p className="text-[11px] text-muted-foreground">{token.verified ? "Verified" : "Listed"}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-white/10 bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">
                      {selectedTokenProfile.symbol}
                      {" "}
                      {selectedTokenProfile.verified && <ShieldCheck className="ml-1 inline h-4 w-4 text-primary" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedTokenProfile.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold">{money(selectedTokenProfile.price)}</p>
                    <p className={selectedTokenProfile.change24h >= 0 ? "text-xs text-emerald-400" : "text-xs text-rose-400"}>
                      {selectedTokenProfile.change24h >= 0 ? "+" : ""}{selectedTokenProfile.change24h}%
                    </p>
                  </div>
                </div>

                <svg viewBox="0 0 112 36" className="mt-3 h-10 w-full">
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    className={selectedTokenProfile.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}
                    points={selectedTokenProfile.spark}
                  />
                </svg>

                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">MC: {selectedTokenProfile.mcap}</div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">Vol 24h: {selectedTokenProfile.volume24h}</div>
                </div>

                <p className="mt-2 truncate text-[11px] text-muted-foreground">{selectedTokenProfile.contract}</p>

                <div className="mt-3 flex items-center justify-between">
                  <Badge variant={selectedTokenProfile.tradable ? "success" : "muted"}>
                    {selectedTokenProfile.tradable ? "Tradable in app" : "Watch-only (MVP)"}
                  </Badge>
                  <Button size="sm" onClick={() => handleUseTokenFromExplorer(selectedTokenProfile)}>
                    Use in Quick Trade
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-muted/20 p-3">
                <p className="text-sm font-semibold">Top 5 App Holders</p>
                <p className="text-xs text-muted-foreground">PnL and trade count inside this app</p>
                <div className="mt-2 space-y-2">
                  {(tokenHolders.length ? tokenHolders : (selectedTokenProfile.holders || [])).map((h, idx) => (
                    <div key={selectedTokenProfile.symbol + "_" + h.handle} className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs">
                      <span className="text-muted-foreground">#{idx + 1}</span>
                      <span className="truncate">{h.handle}</span>
                      <span className="text-muted-foreground">{h.trades} trades</span>
                      <span className={h.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>{money(h.pnl)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {tokenExplorerHint && (
                <p className="text-xs text-primary">{tokenExplorerHint}</p>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Quick Trade</CardTitle>
              <CardDescription>Search/paste contract and buy-sell fast</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input value={tokenQuery} onChange={(e) => setTokenQuery(e.target.value)} placeholder="Search by symbol..." />
                <Button variant="outline"><Search className="h-4 w-4" /></Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {filteredTokens.map((t) => (
                  <Button key={t} size="sm" variant={activeToken === t ? "default" : "ghost"} onClick={() => setActiveToken(t)}>{t}</Button>
                ))}
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input value={contractInput} onChange={(e) => setContractInput(e.target.value)} placeholder="Paste contract" />
                <Button variant="outline" onClick={applyContractToken}>Use</Button>
              </div>

              <div className="rounded-xl border border-white/10 bg-muted/40 p-3 text-sm">
                <div className="flex justify-between"><strong>{activeToken}</strong><Badge>Selected</Badge></div>
                <div className="mt-2 flex justify-between"><span className="text-muted-foreground">Holding</span><span>{currentPosition ? currentPosition.amount : 0}</span></div>
                {quote && (
                  <div className="mt-2 rounded-lg border border-primary/30 bg-primary/10 p-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Estimated receive</span><span>{Number(quote.outTokenAmount || 0).toFixed(6)} {activeToken}</span></div>
                    <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Fee</span><span>{money(quote.feeUsdc || 0)}</span></div>
                  </div>
                )}
                {lastTx && (
                  <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Last onchain tx</span><span className="font-medium text-emerald-300">confirmed</span></div>
                    <a className="mt-1 block truncate text-emerald-300 underline" href={lastTx.explorerUrl} target="_blank" rel="noreferrer">{lastTx.txHash}</a>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input type="number" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} />
                <Button onClick={handleBuyAndNote} disabled={!connected || loading}>Buy</Button>
              </div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write note and buy" />

              <Separator />

              <div className="grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((pct) => (
                  <Button key={pct} variant="ghost" onClick={() => handleSellByPct(pct)} disabled={!connected || !currentPosition || loading}>
                    %{pct}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input type="number" min="1" max="100" step="1" value={customSell} onChange={(e) => setCustomSell(e.target.value)} placeholder="Custom %" />
                <Button variant="outline" onClick={handleSellCustomPercent} disabled={!connected || loading}>Sell %</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "friends" && (
        <Card className="rounded-2xl border-white/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Friends</CardTitle>
            <CardDescription>My friends performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {FRIENDS.map((f) => (
              <div key={f.id} className="rounded-xl border border-white/10 bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <strong>{f.handle}</strong>
                  <span className={f.pnl >= 0 ? "text-green-400" : "text-red-400"}>{money(f.pnl)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "feed" && (
        <Card className="rounded-2xl border-white/10">
          <CardHeader>
            <CardTitle className="text-base">Feed</CardTitle>
            <CardDescription>Live social trade stream</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {feed.map((item) => (
              <FeedTradeCard key={item.id} item={item} />
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "referrals" && (
        <Card className="rounded-2xl border-white/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> Referrals</CardTitle>
            <CardDescription>Earn 25% of friends' fees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
              <div className="text-muted-foreground">Total earned rewards</div>
              <div className="mt-1 text-2xl font-bold">$0.00</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-white/10 bg-muted/30 p-3">
                <div className="text-muted-foreground">Earned last 7d</div>
                <div className="mt-1 font-semibold">$0</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-muted/30 p-3">
                <div className="text-muted-foreground">Friends referred</div>
                <div className="mt-1 font-semibold">0</div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-muted/30 p-3 text-xs text-muted-foreground">
              your referral link: baserush.app/invite/{(miniContext?.user?.username || userId || "you")}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "profile" && (
        <div className="space-y-3">
          <ProfileHero
            handle={profileHandle}
            wallet={wallet}
            premium={premium}
            followers={socialStats.followers}
            following={socialStats.following}
            copiers={socialStats.copiers}
          />
          <Card className="rounded-2xl border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Mini App Notifications</CardTitle>
              <CardDescription>Enable notification permission to receive push alerts in Farcaster.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-muted/30 p-2">
                  <p className="text-muted-foreground">Context</p>
                  <p>{isInMiniAppContext ? "In mini app" : "Browser / outside"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-muted/30 p-2">
                  <p className="text-muted-foreground">Status</p>
                  <p className="capitalize">{notificationState.status}</p>
                </div>
              </div>

              <Button className="w-full" onClick={handleEnableNotifications} disabled={loading}>
                Enable Notifications
              </Button>

              {notificationState.message && (
                <div className="rounded-lg border border-white/10 bg-muted/20 p-2 text-xs">
                  <p>{notificationState.message}</p>
                  {notificationState.token && (
                    <p className="mt-1 truncate text-muted-foreground">token: {notificationState.token}</p>
                  )}
                  {notificationState.url && (
                    <p className="mt-1 truncate text-muted-foreground">url: {notificationState.url}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Mini App Actions</CardTitle>
              <CardDescription>Frames v2 style actions: compose, profile, open url, close app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-muted/30 p-2">
                  <p className="text-muted-foreground">FID</p>
                  <p>{miniContext?.user?.fid || "-"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-muted/30 p-2">
                  <p className="text-muted-foreground">Username</p>
                  <p>{miniContext?.user?.username ? `@${miniContext.user.username}` : "-"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-muted/30 p-2">
                  <p className="text-muted-foreground">Manifest Source</p>
                  <p>{manifestStatus?.source || "unknown"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-muted/30 p-2">
                  <p className="text-muted-foreground">Webhook Mode</p>
                  <p>{manifestStatus?.notificationMode || "unknown"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={handleComposeCast} disabled={loading}>Compose Cast</Button>
                <Button variant="outline" onClick={handleViewMiniProfile} disabled={loading}>View Profile</Button>
                <Button variant="outline" onClick={handleOpenBaseScan} disabled={loading}>Open BaseScan</Button>
                <Button variant="outline" onClick={handleCloseMiniApp} disabled={loading}>Close Mini App</Button>
              </div>
              <div className="rounded-lg border border-white/10 bg-muted/20 p-2 text-xs text-muted-foreground">
                {manifestStatus?.webhookUrl ? `webhook: ${manifestStatus.webhookUrl}` : "webhook unknown"}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Onchain Status</CardTitle>
              <CardDescription>Base RPC + TradeExecutor readiness and smoke check</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-muted/30 p-2">
                  <p className="text-muted-foreground">Real Mode</p>
                  <p>{onchainConfig?.realEnabled ? "Enabled" : "Disabled"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-muted/30 p-2">
                  <p className="text-muted-foreground">RPC</p>
                  <p>{onchainConfig?.baseRpcConfigured ? "Configured" : "Missing"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-muted/30 p-2">
                  <p className="text-muted-foreground">Executor</p>
                  <p>{onchainConfig?.executorConfigured ? "Configured" : "Missing"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-muted/30 p-2">
                  <p className="text-muted-foreground">Signer</p>
                  <p>{onchainConfig?.signerConfigured ? "Configured" : "Missing"}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleOnchainSmoke} disabled={!connected || loading}>
                Run Onchain Smoke
              </Button>
              {smokeStatus?.ok && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs">
                  <p>Smoke OK ({smokeStatus.mode})</p>
                  <p className="truncate">{smokeStatus.tx?.txHash}</p>
                </div>
              )}
              {smokeStatus && smokeStatus.ok === false && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs">
                  <p>Smoke failed: {smokeStatus.error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Profile Detail</CardTitle>
              <CardDescription>Performance and premium</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-white/10 bg-muted/30 p-3">
                  <div className="text-muted-foreground">Realized</div>
                  <div className={wallet.realizedPnl >= 0 ? "text-green-400" : "text-red-400"}>{money(wallet.realizedPnl)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-muted/30 p-3">
                  <div className="text-muted-foreground">Unrealized</div>
                  <div className={wallet.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}>{money(wallet.unrealizedPnl)}</div>
                </div>
              </div>

              <div className="space-y-2">
                {holdings.length === 0 && <p className="text-sm text-muted-foreground">No open position.</p>}
                {holdings.map(([symbol, pos]) => (
                  <div key={symbol} className="rounded-xl border border-white/10 bg-muted/30 p-3 text-sm">
                    <div className="flex justify-between"><strong>{symbol}</strong><span>{Number(pos.amount).toFixed(6)}</span></div>
                    <div className="mt-1 flex justify-between text-muted-foreground"><span>Avg</span><span>{money(pos.avgCost)}</span></div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Premium</span>
                <Badge variant={premium.active ? "success" : "muted"}>{premium.active ? "Active" : "Locked"}</Badge>
              </div>
              <Button className="w-full" onClick={handlePremium} disabled={!connected || premium.active || loading}>
                <Crown className="mr-2 h-4 w-4" /> Activate Premium ($20)
              </Button>
              <Button variant="outline" className="w-full" onClick={handleCopyTradeTest} disabled={!connected || !premium.active || loading}>
                Run Copy Trade (Premium)
              </Button>
              <Separator />
              <div className="space-y-2 rounded-xl border border-white/10 bg-muted/30 p-3">
                <p className="text-sm font-semibold">Copy Trade Settings</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Enabled</p>
                    <Button
                      type="button"
                      variant={copySettings.enabled ? "default" : "outline"}
                      className="w-full"
                      onClick={() => setCopySettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    >
                      {copySettings.enabled ? "On" : "Off"}
                    </Button>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Ratio (%)</p>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={Math.round(Number(copySettings.ratio || 0.2) * 100)}
                      onChange={(e) => {
                        const next = Number(e.target.value || 20);
                        setCopySettings((prev) => ({ ...prev, ratio: Math.max(0.01, Math.min(1, next / 100)) }));
                      }}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Max USDC/Trade</p>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={copySettings.maxUsdcPerTrade}
                      onChange={(e) => setCopySettings((prev) => ({ ...prev, maxUsdcPerTrade: Number(e.target.value || 1) }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Slippage (bps)</p>
                    <Input
                      type="number"
                      min="10"
                      max="2000"
                      step="10"
                      value={copySettings.slippageBps}
                      onChange={(e) => setCopySettings((prev) => ({ ...prev, slippageBps: Number(e.target.value || 100) }))}
                    />
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={handleSaveCopySettings} disabled={!connected || loading}>
                  Save Copy Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <nav className="fixed bottom-2 left-1/2 z-30 flex w-[min(440px,calc(100%-16px))] -translate-x-1/2 items-center justify-between rounded-[26px] border border-white/10 bg-black/75 p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        {TAB_ITEMS.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex min-w-[70px] flex-col items-center rounded-2xl px-2 py-1.5 transition-all duration-300 ease-out ${active ? "-translate-y-0.5 scale-[1.02] bg-primary/90 text-primary-foreground shadow-[0_10px_20px_-12px_rgba(139,92,246,0.95)]" : "text-zinc-400 hover:-translate-y-0.5 hover:text-zinc-200"}`}
            >
              <span className={`absolute inset-x-5 -top-0.5 h-[2px] rounded-full bg-white/80 transition-all duration-300 ${active ? "opacity-100 scale-100" : "opacity-0 scale-50"}`} />
              <Icon className={`h-4.5 w-4.5 ${active ? "text-primary-foreground" : "text-zinc-400"}`} />
              <span className={`mt-1 text-[10px] font-medium ${active ? "text-primary-foreground" : "text-zinc-400"}`}>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="h-10" />
    </div>
  );
}









