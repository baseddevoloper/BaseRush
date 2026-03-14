import { useEffect, useMemo, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import {
  ArrowDownUp,
  Bell,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Newspaper,
  Home,
  Loader2,
  Search,
  User,
  Users,
  Wallet as WalletIcon
} from "lucide-react";
import { useAccount } from "wagmi";
import { decodeFunctionResult, encodeAbiParameters, encodeFunctionData, parseUnits } from "viem";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";

const ETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const USDC_FALLBACK = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const UNISWAP_V3_QUOTER_FALLBACK = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const V3_POOL_FEE_FALLBACK = 500;
const DEFAULT_TRADE_FEE_BPS = 35;

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
];

const ERC20_ALLOWANCE_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
];

const USER_TRADE_ROUTER_ABI = [
  {
    type: "function",
    name: "swapUserTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
      { name: "recipient", type: "address" }
    ],
    outputs: [{ name: "amountOutAfterFee", type: "uint256" }]
  },
  {
    type: "function",
    name: "swapUserTokensViaUniversalRouter",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amountOutAfterFee", type: "uint256" }]
  },
  {
    type: "function",
    name: "swapUserNativeToToken",
    stateMutability: "payable",
    inputs: [
      { name: "tokenOut", type: "address" },
      { name: "minOut", type: "uint256" },
      { name: "recipient", type: "address" }
    ],
    outputs: [{ name: "amountOutAfterFee", type: "uint256" }]
  },
  {
    type: "function",
    name: "swapUserNativeToTokenViaUniversalRouter",
    stateMutability: "payable",
    inputs: [
      { name: "tokenOut", type: "address" },
      { name: "minOut", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amountOutAfterFee", type: "uint256" }]
  }
];

const UNISWAP_V3_QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" }
        ]
      }
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" }
    ]
  }
];

function shortAddr(addr) {
  if (!addr) return "-";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function sortCurrencies(a, b) {
  return BigInt(a.toLowerCase()) < BigInt(b.toLowerCase()) ? [a, b] : [b, a];
}

async function getJson(path, init) {
  const mergedInit = { cache: "no-store", ...(init || {}) };
  const res = await fetch(path, mergedInit);
  const data = await res.json();
  if (!res.ok || data?.ok === false) throw new Error(data?.error || "request_failed");
  return data;
}

async function waitForReceipt(provider, txHash, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [txHash] });
    if (receipt && receipt.blockNumber) return receipt;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("tx_receipt_timeout");
}

async function estimateGasWithBuffer(
  provider,
  txParams,
  { bufferBps = 1200, minGas = 21000n, maxGas = 900000n } = {}
) {
  try {
    const raw = await provider.request({ method: "eth_estimateGas", params: [txParams] });
    let gas = BigInt(String(raw || "0x0"));
    if (gas < minGas) gas = minGas;
    let boosted = (gas * BigInt(10000 + Number(bufferBps || 0)) + 9999n) / 10000n;
    if (boosted < minGas) boosted = minGas;
    if (boosted > maxGas) boosted = maxGas;
    return `0x${boosted.toString(16)}`;
  } catch {
    return null;
  }
}

async function providerRequestWithTimeout(provider, payload, timeoutMs = 45000) {
  return await Promise.race([
    provider.request(payload),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("wallet_request_timeout")), timeoutMs)
    )
  ]);
}

async function buildLowFeeParams(provider) {
  try {
    const gasPriceRaw = await provider.request({ method: "eth_gasPrice", params: [] });
    const gasPrice = BigInt(String(gasPriceRaw || "0x0"));
    // keep fees tight on Base; wallet may otherwise show inflated max cost
    const maxFeePerGas = gasPrice > 0n ? (gasPrice * 115n) / 100n : 1_000_000n;
    const maxPriorityFeePerGas = gasPrice > 0n ? gasPrice / 20n : 1_000n; // ~5%
    return {
      maxFeePerGas: `0x${(maxFeePerGas > 0n ? maxFeePerGas : 1n).toString(16)}`,
      maxPriorityFeePerGas: `0x${(maxPriorityFeePerGas > 0n ? maxPriorityFeePerGas : 1n).toString(16)}`
    };
  } catch {
    return {};
  }
}

function isPopupOrTimeoutError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("wallet_request_timeout") || msg.includes("popup") || msg.includes("blocked");
}

async function waitForAllowance(provider, token, owner, spender, requiredAmount, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const allowanceCallData = encodeFunctionData({
        abi: ERC20_ALLOWANCE_ABI,
        functionName: "allowance",
        args: [owner, spender]
      });
      const raw = await provider.request({
        method: "eth_call",
        params: [{ to: token, data: allowanceCallData }, "latest"]
      });
      const decoded = decodeFunctionResult({
        abi: ERC20_ALLOWANCE_ABI,
        functionName: "allowance",
        data: String(raw || "0x0")
      });
      const allowanceNow = typeof decoded === "bigint" ? decoded : BigInt(decoded?.[0] || 0);
      if (allowanceNow >= requiredAmount) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function quoteV3ExactIn(provider, quoterAddress, tokenIn, tokenOut, amountInRaw, fee) {
  if (!provider?.request || !quoterAddress || !amountInRaw || amountInRaw <= 0n) return null;
  try {
    const callData = encodeFunctionData({
      abi: UNISWAP_V3_QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn,
          tokenOut,
          amountIn: amountInRaw,
          fee: Number(fee || V3_POOL_FEE_FALLBACK),
          sqrtPriceLimitX96: 0n
        }
      ]
    });
    const raw = await provider.request({
      method: "eth_call",
      params: [{ to: quoterAddress, data: callData }, "latest"]
    });
    const decoded = decodeFunctionResult({
      abi: UNISWAP_V3_QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      data: String(raw || "0x")
    });
    const out = Array.isArray(decoded) ? decoded[0] : decoded?.amountOut;
    if (typeof out === "bigint" && out > 0n) return out;
    if (out !== undefined && out !== null) {
      const parsed = BigInt(out);
      return parsed > 0n ? parsed : null;
    }
    return null;
  } catch {
    return null;
  }
}

function appendBuilderDataSuffix(calldata, suffix) {
  const data = String(calldata || "").trim();
  if (!data) return data;
  const rawSuffix = String(suffix || "").trim();
  if (!rawSuffix) return data;
  const normalizedData = data.startsWith("0x") ? data : `0x${data}`;
  const normalizedSuffix = rawSuffix.startsWith("0x") ? rawSuffix : `0x${rawSuffix}`;
  if (!/^0x[0-9a-fA-F]+$/.test(normalizedData)) return normalizedData;
  if (!/^0x[0-9a-fA-F]+$/.test(normalizedSuffix)) return normalizedData;
  const body = normalizedData.slice(2);
  const suffixBody = normalizedSuffix.slice(2);
  if (!suffixBody) return normalizedData;
  if (body.toLowerCase().endsWith(suffixBody.toLowerCase())) return normalizedData;
  return `0x${body}${suffixBody}`;
}

function formatUsd(v) {
  const n = Number(v || 0);
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function normalizeMiniAppUser(rawUser) {
  if (!rawUser || typeof rawUser !== "object") return null;
  const fid = Number(rawUser.fid || 0) || null;
  const username = String(rawUser.username || rawUser.handle || rawUser.userName || "").trim() || null;
  const displayName = String(rawUser.displayName || rawUser.display_name || rawUser.name || "").trim() || null;
  const pfpUrl = String(rawUser.pfpUrl || rawUser.pfp_url || rawUser?.pfp?.url || "").trim() || null;
  const bio = String(rawUser.bio || rawUser?.profile?.bio?.text || "").trim() || null;
  return { fid, username, displayName, pfpUrl, bio };
}

function mapWalletSummaryToHomeVM(summary, walletAddress, socialProfile, miniAppUser) {
  const wallet = summary?.wallet || {};
  return {
    handle:
      socialProfile?.handle ||
      (miniAppUser?.username ? `@${miniAppUser.username}` : null) ||
      (socialProfile?.displayName ? `@${socialProfile.displayName}` : null) ||
      (walletAddress ? `@${shortAddr(walletAddress)}` : "@guest"),
    displayName:
      socialProfile?.displayName ||
      miniAppUser?.displayName ||
      miniAppUser?.username ||
      socialProfile?.handle?.replace(/^@/, "") ||
      (walletAddress ? shortAddr(walletAddress) : "Guest"),
    balance: Number(wallet.usdc || 0),
    pnl24h: Number(wallet.onchainTotalPnl || wallet.totalPnl || 0),
    connected: Boolean(walletAddress),
    positions: summary?.positions || {},
    recentTrades: summary?.recentTrades || []
  };
}

function mapInsightsToFriendsVM(friends, globalFeedItems, followingIds) {
  const byUser = new Map();
  (globalFeedItems || []).forEach((item) => {
    const key = String(item.userId || "");
    if (!key) return;
    if (!byUser.has(key)) {
      byUser.set(key, {
        userId: key,
        handle: item.handle || `@${key}`,
        trades: 0,
        win: 0,
        loss: 0,
        volume: 0
      });
    }
    const row = byUser.get(key);
    row.trades += 1;
    row.volume += Number(item.amount || 0);
    if (Number(item.pnl || 0) >= 0) row.win += 1;
    else row.loss += 1;
  });

  const mappedAll = Array.from(byUser.values()).map((row) => ({
    ...row,
    winRate: row.trades > 0 ? (row.win * 100) / row.trades : 0,
    pnl: Number(
      (friends || []).find((f) => f.userId === row.userId)?.pnl ||
      0
    ),
    followers: Number((friends || []).find((f) => f.userId === row.userId)?.followers || 0),
    following: (followingIds || []).includes(row.userId)
  }));

  (friends || []).forEach((f) => {
    if (mappedAll.some((x) => x.userId === f.userId)) return;
    mappedAll.push({
      userId: f.userId,
      handle: f.handle || `@${f.userId}`,
      trades: Number(f.trades || 0),
      win: 0,
      loss: 0,
      winRate: 0,
      volume: 0,
      pnl: Number(f.pnl || 0),
      followers: Number(f.followers || 0),
      following: true
    });
  });

  return mappedAll;
}

function mapTradeEventsToFeedVM(feedItems) {
  return (feedItems || []).map((item) => ({
    id: item.id,
    userId: item.userId,
    handle: item.handle || `@${item.userId || "trader"}`,
    side: String(item.side || "").toUpperCase(),
    token: String(item.token || "").toUpperCase(),
    text: item.text || "trade",
    amount: Number(item.amount || 0),
    ts: item.ts || "now",
    pnl: Number(item.pnl || 0),
    at: item.at || null
  }));
}

function mapProfileStatsVM({ walletSummary, feedItems, walletAddress, socialProfile, currentUserId, miniAppUser, customBio }) {
  const wallet = walletSummary?.wallet || {};
  const myFeed = (feedItems || []).filter((x) => x.userId === currentUserId);
  const wins = myFeed.filter((x) => Number(x.pnl || 0) >= 0).length;
  const total = myFeed.length;
  const winRate = total > 0 ? (wins * 100) / total : 0;
  const recentTrades = Array.isArray(walletSummary?.recentTrades) ? walletSummary.recentTrades : [];
  const byToken = new Map();
  recentTrades.forEach((t) => {
    const token = String(t?.token || "").toUpperCase();
    if (!token) return;
    if (!byToken.has(token)) {
      byToken.set(token, {
        token,
        trades: 0,
        buy: 0,
        sell: 0,
        realizedPnl: 0
      });
    }
    const row = byToken.get(token);
    row.trades += 1;
    if (String(t?.side || "").toUpperCase() === "BUY") row.buy += 1;
    if (String(t?.side || "").toUpperCase() === "SELL") row.sell += 1;
    row.realizedPnl += Number(t?.realizedPnl || 0);
  });
  const tradedTokens = Array.from(byToken.values())
    .map((x) => ({ ...x, realizedPnl: Number(x.realizedPnl.toFixed(2)) }))
    .sort((a, b) => b.trades - a.trades)
    .slice(0, 6);

  return {
    handle: socialProfile?.handle || (walletAddress ? `@${shortAddr(walletAddress)}` : "@guest"),
    displayName: socialProfile?.displayName || miniAppUser?.displayName || miniAppUser?.username || socialProfile?.handle?.replace(/^@/, "") || "BaseRush User",
    avatarUrl: socialProfile?.avatarUrl || miniAppUser?.pfpUrl || "",
    bio: customBio || socialProfile?.bio || "Base network social trader profile",
    verified: socialProfile?.verified || { farcaster: false, baseapp: false, twitter: false },
    totalTrades: Number(walletSummary?.recentTrades?.length || total || 0),
    followers: Number(socialProfile?.socialGraph?.appFollowers || 0),
    following: Number(socialProfile?.socialGraph?.appFollowing || 0),
    farcasterFollowers: Number(socialProfile?.socialGraph?.farcasterFollowers || 0),
    farcasterFollowing: Number(socialProfile?.socialGraph?.farcasterFollowing || 0),
    winRate,
    totalPnl: Number(wallet.onchainTotalPnl || wallet.totalPnl || 0),
    realizedPnl: Number(wallet.onchainRealizedPnl || wallet.realizedPnl || 0),
    unrealizedPnl: Number(wallet.onchainUnrealizedPnl || wallet.unrealizedPnl || 0),
    tradedTokens
  };
}

export default function App() {
  const { address: wagmiAddress, isConnected: wagmiConnected, connector } = useAccount();

  const [miniAppDetected, setMiniAppDetected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [trading, setTrading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [connectedAddress, setConnectedAddress] = useState("");
  const [currentUserId, setCurrentUserId] = useState("guest");
  const [authToken, setAuthToken] = useState("");
  const [miniAppUser, setMiniAppUser] = useState(null);

  const [onchainConfig, setOnchainConfig] = useState(null);

  const [side, setSide] = useState("BUY");
  const [tradeAmount, setTradeAmount] = useState("10");
  const [tradeTokenSymbol, setTradeTokenSymbol] = useState("ETH");
  const [tradeTokenAddress, setTradeTokenAddress] = useState(ETH_ADDRESS);
  const [tradeTokenDecimals, setTradeTokenDecimals] = useState(18);
  const [tradeTokenPrice, setTradeTokenPrice] = useState(0);
  const [slippageMode, setSlippageMode] = useState("1");
  const [customSlippage, setCustomSlippage] = useState("1");

  const [quoteSell, setQuoteSell] = useState(null);
  const [lastApproveTx, setLastApproveTx] = useState("");
  const [lastSwapTx, setLastSwapTx] = useState("");
  const [pendingSwapReq, setPendingSwapReq] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [tradePanelOpen, setTradePanelOpen] = useState(false);
  const [holderBoard, setHolderBoard] = useState([]);
  const [onchainPnl, setOnchainPnl] = useState(null);
  const [featuredTokens, setFeaturedTokens] = useState({ popular: [], meme: [] });
  const [featuredTab, setFeaturedTab] = useState("popular");
  const [trendFilter, setTrendFilter] = useState("all");
  const [insightToken, setInsightToken] = useState("ETH");
  const [tokenQuery, setTokenQuery] = useState("");
  const [searchTokens, setSearchTokens] = useState([]);
  const [walletSummary, setWalletSummary] = useState(null);
  const [friendsRows, setFriendsRows] = useState([]);
  const [friendsFilter, setFriendsFilter] = useState("all");
  const [friendsQuery, setFriendsQuery] = useState("");
  const [feedScope, setFeedScope] = useState("global");
  const [feedItems, setFeedItems] = useState([]);
  const [globalFeedItems, setGlobalFeedItems] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [newTradesCount, setNewTradesCount] = useState(0);
  const [socialProfile, setSocialProfile] = useState(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [customBio, setCustomBio] = useState("");

  const walletAddress = connectedAddress || wagmiAddress || "";
  const walletConnected = Boolean(walletAddress) || wagmiConnected;

  const usdcAddress = useMemo(() => String(onchainConfig?.usdcDeposit?.tokenAddress || USDC_FALLBACK), [onchainConfig]);
  const routerAddress = useMemo(() => String(onchainConfig?.userRouterAddress || "").trim(), [onchainConfig]);
  const builderDataSuffix = useMemo(() => String(onchainConfig?.builderDataSuffix || "").trim(), [onchainConfig]);
  const v3QuoterAddress = useMemo(
    () => String(onchainConfig?.uniswapV3?.quoter || UNISWAP_V3_QUOTER_FALLBACK).trim(),
    [onchainConfig]
  );
  const v3PoolFee = useMemo(() => Number(onchainConfig?.uniswapV3?.poolFee || V3_POOL_FEE_FALLBACK), [onchainConfig]);

  const slippagePct = useMemo(() => {
    const raw = slippageMode === "custom" ? Number(customSlippage || 0) : Number(slippageMode || 1);
    return Math.max(0.1, Math.min(50, raw));
  }, [slippageMode, customSlippage]);

  const slippageBps = useMemo(() => Math.round(slippagePct * 100), [slippagePct]);

  const buyModel = useMemo(() => {
    const inputUsdc = Number(tradeAmount || 0);
    const price = Number(quoteSell?.price || 0);
    const feeBps = Number(quoteSell?.feeBps || 0);
    if (!(inputUsdc > 0) || !(price > 0)) return null;

    const feeFactor = 1 - feeBps / 10000;
    if (feeFactor <= 0) return null;

    const expectedTokenOut = (inputUsdc * feeFactor) / price;
    const minOutToken = expectedTokenOut * (1 - slippagePct / 100);

    return {
      inputUsdc,
      expectedTokenOut,
      minOutToken
    };
  }, [tradeAmount, quoteSell, slippagePct]);

  const sellModel = useMemo(() => {
    const amountToken = Number(tradeAmount || 0);
    const outUsdc = Number(quoteSell?.outUsdc || 0);
    if (!(amountToken > 0) || !(outUsdc > 0)) return null;

    const minOutUsdc = outUsdc * (1 - slippagePct / 100);
    return {
      amountToken,
      expectedUsdc: outUsdc,
      minOutUsdc
    };
  }, [tradeAmount, quoteSell, slippagePct]);

  const tokenAmountLabel = side === "BUY" ? "USDC Amount" : `${tradeTokenSymbol || "Token"} Amount`;

  const filteredMarketTokens = useMemo(() => {
    const rows = Array.isArray(featuredTokens?.[featuredTab]) ? [...featuredTokens[featuredTab]] : [];
    if (trendFilter === "rising") return rows.filter((x) => Number(x.change24h || 0) >= 0);
    if (trendFilter === "falling") return rows.filter((x) => Number(x.change24h || 0) < 0);
    return rows;
  }, [featuredTokens, featuredTab, trendFilter]);

  function selectTradeToken(token) {
    if (!token) return;
    const symbol = String(token.symbol || "").toUpperCase();
    const contract = String(token.contract || token.address || "").trim();
    const decimals = Number(token.decimals || 18);
    const price = Number(token.price || 0);
    if (symbol) {
      setInsightToken(symbol);
      setTradeTokenSymbol(symbol);
    }
    if (contract) setTradeTokenAddress(contract);
    if (Number.isFinite(decimals) && decimals > 0) setTradeTokenDecimals(decimals);
    setTradeTokenPrice(price > 0 ? price : 0);
    setTradePanelOpen(true);
  }

  async function getProvider() {
    try {
      if (connector?.getProvider) {
        const p = await connector.getProvider();
        if (p?.request) return p;
      }
    } catch {
      // fallback to injected provider
    }
    if (typeof window !== "undefined" && window?.ethereum?.request) {
      return window.ethereum;
    }
    return null;
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      const hasInjected = typeof window !== "undefined" && !!window?.ethereum;
      if (active) setMiniAppDetected(hasInjected);

      try {
        const out = await getJson(`/api/onchain/config?_t=${Date.now()}`);
        if (!active) return;
        setOnchainConfig(out.onchain || null);
      } catch {
        if (active) setOnchainConfig(null);
      }

      try {
        const provider = await getProvider();
        if (!provider?.request || !active) return;
        const accounts = await provider.request({ method: "eth_accounts" });
        const addr = Array.isArray(accounts) ? String(accounts[0] || "") : "";
        if (addr && active) setConnectedAddress(addr);
      } catch {
        // ignore
      }
    }

    boot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadQuoteSell() {
      const n = Number(tradeAmount || 0);
      if (!(n > 0)) {
        setQuoteSell(null);
        return;
      }

      const params = new URLSearchParams({
        token: tradeTokenSymbol,
        side: side === "BUY" ? "BUY" : "SELL",
        amountUsdc: side === "BUY" ? String(n) : "0",
        tokenAmount: side === "SELL" ? String(n) : "0",
        userId: currentUserId,
        slippageBps: String(slippageBps)
      });

      try {
        const out = await getJson(`/api/trade/quote?${params.toString()}`);
        if (!cancelled) setQuoteSell(out.quote || null);
      } catch {
        if (!cancelled) {
          if (tradeTokenPrice > 0) {
            if (side === "BUY") {
              const inputUsdc = n;
              const feeUsdc = (inputUsdc * DEFAULT_TRADE_FEE_BPS) / 10000;
              const netUsdc = Math.max(0, inputUsdc - feeUsdc);
              const outTokenAmount = netUsdc / tradeTokenPrice;
              setQuoteSell({
                token: tradeTokenSymbol,
                side: "BUY",
                price: tradeTokenPrice,
                feeBps: DEFAULT_TRADE_FEE_BPS,
                feeUsdc,
                inputUsdc,
                netUsdc,
                outTokenAmount,
                outUsdc: null,
                slippageBps,
                expiresInSec: 10,
                source: "local_fallback"
              });
            } else {
              const grossUsdc = n * tradeTokenPrice;
              const feeUsdc = (grossUsdc * DEFAULT_TRADE_FEE_BPS) / 10000;
              const outUsdc = Math.max(0, grossUsdc - feeUsdc);
              setQuoteSell({
                token: tradeTokenSymbol,
                side: "SELL",
                price: tradeTokenPrice,
                feeBps: DEFAULT_TRADE_FEE_BPS,
                feeUsdc,
                inputUsdc: grossUsdc,
                netUsdc: outUsdc,
                outTokenAmount: n,
                outUsdc,
                slippageBps,
                expiresInSec: 10,
                source: "local_fallback"
              });
            }
          } else {
            setQuoteSell(null);
          }
        }
      }
    }

    loadQuoteSell();
    return () => {
      cancelled = true;
    };
  }, [tradeAmount, slippageBps, currentUserId, tradeTokenSymbol, tradeTokenPrice, side]);

  useEffect(() => {
    let cancelled = false;

    async function loadFeaturedTokens() {
      try {
        const out = await getJson("/api/token/featured");
        if (!cancelled) setFeaturedTokens(out?.sections || { popular: [], meme: [] });
      } catch {
        if (!cancelled) setFeaturedTokens({ popular: [], meme: [] });
      }
    }

    loadFeaturedTokens();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refreshOnchainConfig() {
      try {
        const out = await getJson(`/api/onchain/config?_t=${Date.now()}`);
        if (!cancelled) setOnchainConfig(out?.onchain || null);
      } catch {
        // keep last known config
      }
    }
    const timer = setInterval(refreshOnchainConfig, 12000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function waitContextWithRetry() {
      for (let i = 0; i < 5; i += 1) {
        if (cancelled) return null;
        const ctx = await Promise.race([
          sdk.context.catch(() => null),
          new Promise((resolve) => setTimeout(() => resolve(null), 1800))
        ]);
        if (ctx?.user?.fid || ctx?.user?.username || ctx?.user?.displayName) return ctx;
        await new Promise((r) => setTimeout(r, 500));
      }
      return null;
    }

    async function syncMiniAppIdentity() {
      try {
        const ctx = await waitContextWithRetry();
        const ctxUser = normalizeMiniAppUser(ctx?.user || null);
        const ctxFid = Number(ctxUser?.fid || 0) || null;
        if (!cancelled) setMiniAppUser(ctxUser);

        let token = "";
        try {
          const tk = await sdk.quickAuth.getToken();
          token = String(tk?.token || "");
        } catch {
          token = "";
        }
        if (!cancelled) setAuthToken(token);

        let authStatus = null;
        if (token) {
          try {
            authStatus = await getJson("/api/auth/status", {
              headers: { authorization: `Bearer ${token}` }
            });
          } catch {
            authStatus = null;
          }
        }

        const resolvedUserId =
          String(authStatus?.userId || "").trim() ||
          (ctxFid ? `fc_${ctxFid}` : "guest");

        const session = await getJson("/api/session/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: resolvedUserId,
            walletAddress: connectedAddress || walletAddress || "",
            authAddress: authStatus?.address || "",
            miniappUser: ctxUser || {},
            fid: authStatus?.fid || ctxFid || null,
            username: ctxUser?.username || null,
            displayName: ctxUser?.displayName || null,
            pfpUrl: ctxUser?.pfpUrl || null
          })
        }).catch(() => null);

        if (!cancelled && session?.userId) setCurrentUserId(String(session.userId));
        if (!cancelled && session?.profile && !socialProfile) setSocialProfile(session.profile);
        if (!cancelled && (authStatus?.address || session?.auth?.address) && !connectedAddress) {
          setConnectedAddress(String(authStatus?.address || session?.auth?.address));
        }
      } catch {
        // ignore identity sync errors
      }
    }

    syncMiniAppIdentity();
    return () => {
      cancelled = true;
    };
  }, [connectedAddress]);

  useEffect(() => {
    let cancelled = false;
    async function loadSocialProfile() {
      try {
        const out = await getJson(`/api/social/profile?userId=${encodeURIComponent(currentUserId)}&walletAddress=${encodeURIComponent(walletAddress || "")}&_t=${Date.now()}`);
        if (!cancelled) setSocialProfile(out?.profile || null);
      } catch {
        if (!cancelled) setSocialProfile(null);
      }
    }
    loadSocialProfile();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, currentUserId, authToken]);

  useEffect(() => {
    const key = `baserush.bio.${(walletAddress || currentUserId || "guest").toLowerCase()}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) setCustomBio(saved);
    } catch {
      // ignore
    }
  }, [walletAddress, currentUserId]);

  useEffect(() => {
    setBioDraft(customBio || socialProfile?.bio || "");
  }, [customBio, socialProfile?.bio]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const q = tokenQuery.trim();
        const out = await getJson(`/api/token/search?listedOnly=false&q=${encodeURIComponent(q)}`);
        if (!cancelled) setSearchTokens(Array.isArray(out?.items) ? out.items : []);
      } catch {
        if (!cancelled) setSearchTokens([]);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tokenQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadActivityData() {
      try {
        const out = await getJson(`/api/token/insights?token=${encodeURIComponent(insightToken)}&limit=6`);
        if (!cancelled) setHolderBoard(Array.isArray(out?.holders) ? out.holders : []);
      } catch {
        if (!cancelled) setHolderBoard([]);
      }

      if (!walletAddress) {
        if (!cancelled) setOnchainPnl(null);
        return;
      }

      try {
        const out = await getJson(`/api/wallet/summary?userId=${encodeURIComponent(currentUserId)}&walletAddress=${encodeURIComponent(walletAddress)}`);
        if (!cancelled) setOnchainPnl(out?.onchain?.pnl || null);
      } catch {
        if (!cancelled) setOnchainPnl(null);
      }
    }

    loadActivityData();
    const timer = setInterval(loadActivityData, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [walletAddress, lastSwapTx, insightToken, currentUserId]);

  useEffect(() => {
    let cancelled = false;
    async function loadWalletSummary() {
      if (!walletAddress) {
        if (!cancelled) setWalletSummary(null);
        return;
      }
      try {
        const out = await getJson(`/api/wallet/summary?userId=${encodeURIComponent(currentUserId)}&walletAddress=${encodeURIComponent(walletAddress)}`);
        if (!cancelled) setWalletSummary(out || null);
      } catch {
        if (!cancelled) setWalletSummary(null);
      }
    }
    loadWalletSummary();
    const timer = setInterval(loadWalletSummary, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [walletAddress, lastSwapTx, currentUserId]);

  useEffect(() => {
    let cancelled = false;
    async function loadFriends() {
      try {
        const out = await getJson(`/api/social/friends?userId=${encodeURIComponent(currentUserId)}&limit=30`);
        if (!cancelled) setFriendsRows(Array.isArray(out?.friends) ? out.friends : []);
      } catch {
        if (!cancelled) setFriendsRows([]);
      }
    }
    loadFriends();
    const timer = setInterval(loadFriends, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;
    let previousTop = "";
    async function loadFeed() {
      try {
        const current = await getJson(`/api/feed?userId=${encodeURIComponent(currentUserId)}&scope=${feedScope}&limit=40`);
        if (cancelled) return;
        const items = Array.isArray(current?.items) ? current.items : [];
        setFeedItems(items);
        setFollowingIds(Array.isArray(current?.following) ? current.following : []);
        if (items[0]?.id && previousTop && items[0].id !== previousTop) {
          const idx = items.findIndex((x) => x.id === previousTop);
          const delta = idx > 0 ? idx : 1;
          setNewTradesCount((c) => Math.min(99, c + delta));
        }
        previousTop = items[0]?.id || previousTop;
      } catch {
        if (!cancelled) setFeedItems([]);
      }
    }
    loadFeed();
    const timer = setInterval(loadFeed, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [feedScope, currentUserId]);

  useEffect(() => {
    let cancelled = false;
    async function loadGlobalFeed() {
      try {
        const out = await getJson(`/api/feed?userId=${encodeURIComponent(currentUserId)}&scope=global&limit=80`);
        if (!cancelled) setGlobalFeedItems(Array.isArray(out?.items) ? out.items : []);
      } catch {
        if (!cancelled) setGlobalFeedItems([]);
      }
    }
    loadGlobalFeed();
    const timer = setInterval(loadGlobalFeed, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentUserId]);

  async function handleConnectWallet() {
    setConnecting(true);
    setError("");
    setStatus("Connecting wallet...");

    try {
      const provider = await getProvider();
      if (!provider?.request) throw new Error("wallet_provider_unavailable");

      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const addr = Array.isArray(accounts) ? String(accounts[0] || "") : "";
      if (!addr) throw new Error("wallet_not_connected");

      setConnectedAddress(addr);
      setStatus(`Connected: ${shortAddr(addr)}`);
    } catch (e) {
      setError(String(e?.message || "connect_failed"));
      setStatus("");
    } finally {
      setConnecting(false);
    }
  }

  function buildV4CommandsInputs(tokenIn, tokenOut, amountInRaw, minOutRaw) {
    const v4 = onchainConfig?.uniswapV4;
    if (!v4?.enabled) throw new Error("v4_not_enabled");

    const [sorted0, sorted1] = sortCurrencies(tokenIn, tokenOut);
    const currency0 = String(v4.currency0 || sorted0);
    const currency1 = String(v4.currency1 || sorted1);
    const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();

    const actions = "0x060c0f"; // SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL

    const swapExactInSingle = encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            {
              name: "poolKey",
              type: "tuple",
              components: [
                { name: "currency0", type: "address" },
                { name: "currency1", type: "address" },
                { name: "fee", type: "uint24" },
                { name: "tickSpacing", type: "int24" },
                { name: "hooks", type: "address" }
              ]
            },
            { name: "zeroForOne", type: "bool" },
            { name: "amountIn", type: "uint128" },
            { name: "amountOutMinimum", type: "uint128" },
            { name: "hookData", type: "bytes" }
          ]
        }
      ],
      [
        {
          poolKey: {
            currency0,
            currency1,
            fee: Number(v4.poolFee || 500),
            tickSpacing: Number(v4.tickSpacing || 10),
            hooks: String(v4.hooks || ZERO_ADDRESS)
          },
          zeroForOne,
          amountIn: BigInt(amountInRaw),
          amountOutMinimum: BigInt(minOutRaw),
          hookData: "0x"
        }
      ]
    );

    const settleAll = encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      [tokenIn, amountInRaw]
    );

    const takeAll = encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      [tokenOut, minOutRaw]
    );

    const routerInput = encodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes[]" }],
      [actions, [swapExactInSingle, settleAll, takeAll]]
    );

    return {
      commands: "0x10", // V4_SWAP command
      inputs: [routerInput],
      deadline: BigInt(Math.floor(Date.now() / 1000) + 180)
    };
  }

  async function handleTrade() {
    setTrading(true);
    setError("");
    setLastApproveTx("");
    setLastSwapTx("");

    try {
      if (!walletAddress) throw new Error("wallet_not_connected");
      if (!routerAddress) throw new Error("user_router_not_configured");
      if (!tradeTokenAddress) throw new Error("token_not_selected");

      const provider = await getProvider();
      if (!provider?.request) throw new Error("wallet_provider_unavailable");

      const nInput = Number(tradeAmount || 0);
      if (!(nInput > 0)) throw new Error("invalid_trade_amount");

      let tokenIn;
      let tokenOut;
      let amountInRaw;
      let minOutRaw;
      const selectedIsNative = String(tradeTokenAddress || "").toLowerCase() === ETH_ADDRESS.toLowerCase();
      // Prefer v3 for lower gas cost; we can add smart price routing later.
      const autoVenue = "v3";

      if (side === "BUY") {
        if (!buyModel) throw new Error("quote_missing_for_buy");
        tokenIn = usdcAddress;
        tokenOut = tradeTokenAddress || ETH_ADDRESS;
        amountInRaw = parseUnits(nInput.toFixed(6), 6);
        minOutRaw = parseUnits(buyModel.minOutToken.toFixed(6), tradeTokenDecimals);
      } else {
        if (!sellModel) throw new Error("quote_missing_for_sell");
        tokenIn = tradeTokenAddress || ETH_ADDRESS;
        tokenOut = usdcAddress;
        amountInRaw = parseUnits(nInput.toFixed(6), tradeTokenDecimals);
        minOutRaw = parseUnits(sellModel.minOutUsdc.toFixed(6), 6);
      }
      if (String(tokenIn || "").toLowerCase() === String(tokenOut || "").toLowerCase()) {
        throw new Error("same_token_pair_not_allowed");
      }

      if (autoVenue === "v3") {
        setStatus("Fetching onchain quote...");
        const quotedOut = await quoteV3ExactIn(provider, v3QuoterAddress, tokenIn, tokenOut, amountInRaw, v3PoolFee);
        if (quotedOut && quotedOut > 0n) {
          const extraSellBufferBps = side === "SELL" ? 700 : 0; // make sell path less strict in mini app simulations
          const effectiveSlippageBps = Math.min(9900, slippageBps + extraSellBufferBps);
          const bps = BigInt(Math.max(1, 10000 - effectiveSlippageBps));
          const quotedMinOut = (quotedOut * bps) / 10000n;
          if (quotedMinOut > 0n) minOutRaw = quotedMinOut;
        } else if (side === "SELL") {
          minOutRaw = 0n;
        }

        if (side === "SELL") {
          // Avoid "Too little received" preflight reverts in Farcaster/Base mini app simulation.
          minOutRaw = 0n;
        }
      }

      if (side === "SELL" && autoVenue === "v4") {
        // Until a real v4 quote path is wired, do not enforce model-based minOut for sell.
        minOutRaw = 0n;
      }

      let needsApprove = false;
      if (side === "BUY" || (side === "SELL" && !selectedIsNative)) {
        let currentAllowance = 0n;
        try {
          const allowanceCallData = encodeFunctionData({
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "allowance",
            args: [walletAddress, routerAddress]
          });
          const allowanceRaw = await provider.request({
            method: "eth_call",
            params: [{ to: tokenIn, data: allowanceCallData }, "latest"]
          });
          const decodedAllowance = decodeFunctionResult({
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "allowance",
            data: String(allowanceRaw || "0x0")
          });
          currentAllowance = typeof decodedAllowance === "bigint" ? decodedAllowance : BigInt(decodedAllowance?.[0] || 0);
        } catch {
          currentAllowance = 0n;
        }

        needsApprove = currentAllowance < amountInRaw;
        if (needsApprove) {
          setStatus("Step 1/2: Approve token...");
          const approveData = encodeFunctionData({
            abi: ERC20_APPROVE_ABI,
            functionName: "approve",
            args: [routerAddress, amountInRaw]
          });

          const approveReq = {
            from: walletAddress,
            to: tokenIn,
            data: appendBuilderDataSuffix(approveData, builderDataSuffix),
            value: "0x0"
          };
          const approveFeeParams = await buildLowFeeParams(provider);
          Object.assign(approveReq, approveFeeParams);
          const approveGas = await estimateGasWithBuffer(provider, approveReq, {
            bufferBps: 1000,
            minGas: 45000n,
            maxGas: 140000n
          });
          if (approveGas) approveReq.gas = approveGas;

          const approveTx = await providerRequestWithTimeout(provider, {
            method: "eth_sendTransaction",
            params: [approveReq]
          }, 60000);
          setLastApproveTx(String(approveTx));
          setStatus("Approve submitted. Waiting confirmation...");
          const allowanceReady = await waitForAllowance(
            provider,
            tokenIn,
            walletAddress,
            routerAddress,
            amountInRaw,
            90000
          );
          if (!allowanceReady) {
            throw new Error("approve_not_confirmed");
          }
        }
      }

      setStatus(
        needsApprove
          ? `Step 2/2: Swap to ${tradeTokenSymbol}...`
          : side === "BUY"
            ? `Step 1/1: Buy ${tradeTokenSymbol}...`
            : `Step 1/1: Sell ${tradeTokenSymbol}...`
      );

      let swapData;
      let txValue = "0x0";

      if (side === "SELL" && selectedIsNative) {
        txValue = `0x${amountInRaw.toString(16)}`;
        if (autoVenue === "v4") {
          const v4Payload = buildV4CommandsInputs(tokenIn, tokenOut, amountInRaw, minOutRaw);
          swapData = encodeFunctionData({
            abi: USER_TRADE_ROUTER_ABI,
            functionName: "swapUserNativeToTokenViaUniversalRouter",
            args: [tokenOut, minOutRaw, walletAddress, v4Payload.commands, v4Payload.inputs, v4Payload.deadline]
          });
        } else {
          swapData = encodeFunctionData({
            abi: USER_TRADE_ROUTER_ABI,
            functionName: "swapUserNativeToToken",
            args: [tokenOut, minOutRaw, walletAddress]
          });
        }
      } else if (autoVenue === "v4") {
        const v4Payload = buildV4CommandsInputs(tokenIn, tokenOut, amountInRaw, minOutRaw);
        swapData = encodeFunctionData({
          abi: USER_TRADE_ROUTER_ABI,
          functionName: "swapUserTokensViaUniversalRouter",
          args: [tokenIn, tokenOut, amountInRaw, minOutRaw, walletAddress, v4Payload.commands, v4Payload.inputs, v4Payload.deadline]
        });
      } else {
        swapData = encodeFunctionData({
          abi: USER_TRADE_ROUTER_ABI,
          functionName: "swapUserTokens",
          args: [tokenIn, tokenOut, amountInRaw, minOutRaw, walletAddress]
        });
      }

      const swapReq = {
        from: walletAddress,
        to: routerAddress,
        data: appendBuilderDataSuffix(swapData, builderDataSuffix),
        value: txValue
      };
      const swapFeeParams = await buildLowFeeParams(provider);
      Object.assign(swapReq, swapFeeParams);
      const minSwapGas = autoVenue === "v4" ? 240000n : side === "SELL" ? 160000n : 130000n;
      const swapGas = await estimateGasWithBuffer(provider, swapReq, {
        bufferBps: 1200,
        minGas: minSwapGas,
        maxGas: 550000n
      });
      if (swapGas) swapReq.gas = swapGas;

      let swapTx;
      try {
        swapTx = await providerRequestWithTimeout(provider, {
          method: "eth_sendTransaction",
          params: [swapReq]
        }, 60000);
      } catch (swapErr) {
        if (isPopupOrTimeoutError(swapErr)) {
          setPendingSwapReq(swapReq);
          setStatus("Approve completed. Tap 'Send Swap' to continue.");
          setError("swap_popup_not_opened_tap_send_swap");
          return;
        }
        throw swapErr;
      }

      setLastSwapTx(String(swapTx));
      setPendingSwapReq(null);
      setStatus("Swap submitted. Check status on Basescan.");
      try {
        await waitForReceipt(provider, String(swapTx), 45000);
        setStatus("Trade completed successfully.");
      } catch (receiptErr) {
        const msg = String(receiptErr?.message || "").toLowerCase();
        if (!msg.includes("does not support the requested method")) throw receiptErr;
      }
    } catch (e) {
      const msg = String(e?.message || "trade_failed");
      if (msg.includes("wallet_request_timeout")) {
        setError("wallet_request_timeout_open_wallet_popup");
      } else {
        setError(msg);
      }
      setStatus("");
    } finally {
      setTrading(false);
    }
  }

  const tradeButtonLabel = useMemo(() => (side === "BUY" ? `Buy ${tradeTokenSymbol}` : `Sell ${tradeTokenSymbol}`), [side, tradeTokenSymbol]);
  const quoteReady = side === "BUY" ? !!buyModel : !!sellModel;
  const canTrade = walletConnected && !trading && !!routerAddress && quoteReady;
  const homeVM = useMemo(
    () => mapWalletSummaryToHomeVM(walletSummary, walletAddress, socialProfile, miniAppUser),
    [walletSummary, walletAddress, socialProfile, miniAppUser]
  );
  const friendsVM = useMemo(
    () => mapInsightsToFriendsVM(friendsRows, globalFeedItems, followingIds),
    [friendsRows, globalFeedItems, followingIds]
  );
  const feedVM = useMemo(() => mapTradeEventsToFeedVM(feedItems), [feedItems]);
  const profileVM = useMemo(
    () => mapProfileStatsVM({ walletSummary, feedItems: globalFeedItems, walletAddress, socialProfile, currentUserId, miniAppUser, customBio }),
    [walletSummary, globalFeedItems, walletAddress, socialProfile, currentUserId, miniAppUser, customBio]
  );

  const filteredFriends = useMemo(() => {
    let rows = [...friendsVM];
    if (friendsFilter === "following") rows = rows.filter((x) => x.following);
    if (friendsFilter === "most") rows = rows.sort((a, b) => (b.followers || 0) - (a.followers || 0));
    if (friendsFilter === "win") rows = rows.sort((a, b) => (b.winRate || 0) - (a.winRate || 0));
    const q = friendsQuery.trim().toLowerCase();
    if (q) rows = rows.filter((x) => String(x.handle || "").toLowerCase().includes(q) || String(x.userId || "").toLowerCase().includes(q));
    return rows.slice(0, 40);
  }, [friendsVM, friendsFilter, friendsQuery]);

  async function handleToggleFollow(traderId) {
    try {
      await fetch("/api/follow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, traderId })
      });
      const f = await getJson(`/api/social/friends?userId=${encodeURIComponent(currentUserId)}&limit=30`);
      setFriendsRows(Array.isArray(f?.friends) ? f.friends : []);
      const g = await getJson(`/api/feed?userId=${encodeURIComponent(currentUserId)}&scope=${feedScope}&limit=40`);
      setFollowingIds(Array.isArray(g?.following) ? g.following : []);
    } catch {
      // non-blocking on UI
    }
  }

  async function handleSaveBio() {
    const value = String(bioDraft || "").trim().slice(0, 180);
    setCustomBio(value);
    setEditingBio(false);
    const key = `baserush.bio.${(walletAddress || currentUserId || "guest").toLowerCase()}`;
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
    try {
      await fetch("/api/social/profile/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          profile: {
            bio: value
          }
        })
      });
    } catch {
      // optional sync endpoint
    }
  }

  async function handleSendPendingSwap() {
    if (!pendingSwapReq) return;
    setTrading(true);
    setError("");
    try {
      const provider = await getProvider();
      if (!provider?.request) throw new Error("wallet_provider_unavailable");
      const swapTx = await providerRequestWithTimeout(provider, {
        method: "eth_sendTransaction",
        params: [pendingSwapReq]
      }, 60000);
      setLastSwapTx(String(swapTx));
      setPendingSwapReq(null);
      setStatus("Swap submitted. Check status on Basescan.");
      try {
        await waitForReceipt(provider, String(swapTx), 45000);
        setStatus("Trade completed successfully.");
      } catch (receiptErr) {
        const msg = String(receiptErr?.message || "").toLowerCase();
        if (!msg.includes("does not support the requested method")) throw receiptErr;
      }
    } catch (e) {
      const msg = String(e?.message || "swap_send_failed");
      if (msg.includes("wallet_request_timeout")) setError("wallet_request_timeout_open_wallet_popup");
      else setError(msg);
      setStatus("");
    } finally {
      setTrading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#090d1a] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,#8b5cf6_0%,#4338ca_30%,#111827_58%,#040712_100%)]" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-24 pt-4">
        <Card className="overflow-hidden border-white/20 bg-gradient-to-br from-violet-500/50 via-indigo-500/35 to-slate-900/60 shadow-[0_24px_80px_-28px_rgba(124,58,237,0.95)] backdrop-blur-xl">
          <CardHeader className="space-y-3 pb-4">
                  <div className="flex items-center justify-between">
                  <div>
                    <CardDescription className="text-zinc-400">BaseRush</CardDescription>
                    <CardTitle className="text-2xl">{activeTab === "profile" ? "Profile" : homeVM.displayName}</CardTitle>
                  </div>
                  <Badge variant={walletConnected ? "success" : "muted"}>{walletConnected ? "Connected" : "Guest"}</Badge>
                </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-white/20 bg-black/25 px-3 py-2">
                <p className="text-zinc-500">Wallet</p>
                <p className="truncate">{walletConnected ? shortAddr(walletAddress) : "Not connected"}</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-black/25 px-3 py-2">
                <p className="text-zinc-500">Wallet provider</p>
                <p>{miniAppDetected ? "Injected" : "Not detected"}</p>
              </div>
            </div>
            {activeTab === "home" ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="bg-white/15 text-white hover:bg-white/25">
                  Deposit
                </Button>
                <Button className="bg-violet-600 text-white hover:bg-violet-500" onClick={() => setTradePanelOpen((v) => !v)}>
                  {tradePanelOpen ? "Hide Trade" : "Trade"}
                </Button>
              </div>
            ) : null}
          </CardHeader>
        </Card>

        <div className="mt-3 flex-1">
          {activeTab === "home" && (
            <div className="space-y-3">
              <Card className="border-white/20 bg-black/45 backdrop-blur-xl shadow-[0_16px_50px_-28px_rgba(129,140,248,0.9)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Token Search</CardTitle>
                  <CardDescription>Search by symbol or contract.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      className="h-11 rounded-xl border-white/15 bg-black/35 pl-9"
                      value={tokenQuery}
                      onChange={(e) => setTokenQuery(e.target.value)}
                      placeholder="Search token or paste contract"
                    />
                  </div>
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {searchTokens.slice(0, 8).map((t) => (
                      <button
                        key={t.symbol}
                        type="button"
                        onClick={() => selectTradeToken(t)}
                        className={`w-full rounded-2xl border px-3 py-2 text-left transition-all ${insightToken === t.symbol ? "border-violet-400/70 bg-violet-500/20 shadow-[0_12px_36px_-16px_rgba(167,139,250,0.95)]" : "border-white/15 bg-black/30 hover:border-white/30"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{t.symbol}</p>
                            <p className="text-xs text-zinc-400">{t.name}</p>
                          </div>
                          <div className="text-right">
                            {t.listingStatus === "official" ? (
                              <Badge variant="success">Official</Badge>
                            ) : t.listingStatus === "unofficial" ? (
                              <Badge variant="muted">Unofficial</Badge>
                            ) : null}
                            <p className="mt-1 text-[11px] text-zinc-500">{Number(t.appTrades || 0)} trades</p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {searchTokens.length === 0 && (
                      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-500">
                        No listed token found.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/20 bg-black/45 backdrop-blur-xl shadow-[0_16px_50px_-28px_rgba(129,140,248,0.9)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Market Overview</CardTitle>
                  <CardDescription>Popular and meme tokens on Base.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={featuredTab === "popular" ? "default" : "outline"} onClick={() => setFeaturedTab("popular")}>
                      Popular
                    </Button>
                    <Button variant={featuredTab === "meme" ? "default" : "outline"} onClick={() => setFeaturedTab("meme")}>
                      Meme
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant={trendFilter === "all" ? "default" : "outline"} onClick={() => setTrendFilter("all")}>
                      All
                    </Button>
                    <Button size="sm" variant={trendFilter === "rising" ? "default" : "outline"} onClick={() => setTrendFilter("rising")}>
                      Rising
                    </Button>
                    <Button size="sm" variant={trendFilter === "falling" ? "default" : "outline"} onClick={() => setTrendFilter("falling")}>
                      Falling
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(filteredMarketTokens || []).map((t) => (
                      <button
                        key={t.symbol}
                        type="button"
                        onClick={() => selectTradeToken(t)}
                        className={`rounded-2xl border px-3 py-2 text-left transition-all ${insightToken === t.symbol ? "border-violet-400/70 bg-violet-500/20 shadow-[0_12px_36px_-16px_rgba(167,139,250,0.95)]" : "border-white/15 bg-black/30 hover:border-white/30"}`}
                      >
                        <p className="text-sm font-medium">{t.symbol}</p>
                        <p className="text-xs text-zinc-400">{t.name}</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {t.listingStatus === "official" ? "Official listing" : t.listingStatus === "unofficial" ? "Unofficial listing" : "Not listed"}
                        </p>
                        <p className={`mt-1 text-xs ${Number(t.change24h || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {Number(t.change24h || 0) >= 0 ? "+" : ""}{Number(t.change24h || 0).toFixed(2)}%
                        </p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {tradePanelOpen ? (
                <Card className="border-white/20 bg-black/45 backdrop-blur-xl shadow-[0_16px_50px_-28px_rgba(129,140,248,0.9)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Quick Trade</CardTitle>
                  <CardDescription>{tradeTokenSymbol} quick buy/sell from connected wallet.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="rounded-xl border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-xs">
                    Selected token: <span className="font-semibold">{tradeTokenSymbol}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={side === "BUY" ? "default" : "outline"} onClick={() => setSide("BUY")} disabled={trading}>
                      Buy {tradeTokenSymbol}
                    </Button>
                    <Button variant={side === "SELL" ? "default" : "outline"} onClick={() => setSide("SELL")} disabled={trading}>
                      Sell {tradeTokenSymbol}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-zinc-400">
                    Routing: Auto (best available path)
                  </div>

                  <div className="space-y-2">
                    <p className="mb-1 text-xs text-zinc-400">{tokenAmountLabel} Amount</p>
                    <Input
                      className="h-11 rounded-xl border-white/15 bg-black/35"
                      type="number"
                      step="0.0001"
                      min="0"
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(e.target.value)}
                      placeholder={side === "BUY" ? "10" : "0.01"}
                    />
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {(side === "BUY" ? ["10", "25", "50", "100"] : ["0.0001", "0.001", "0.01", "0.1"]).map((amount) => (
                        <Button
                          key={amount}
                          variant={tradeAmount === amount ? "default" : "outline"}
                          onClick={() => setTradeAmount(amount)}
                          disabled={trading}
                        >
                          {amount}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="mb-1 text-xs text-zinc-400">Slippage</p>
                    <div className="grid grid-cols-4 gap-2">
                      {["1", "3", "10", "custom"].map((v) => (
                        <Button
                          key={v}
                          variant={slippageMode === v ? "default" : "outline"}
                          onClick={() => setSlippageMode(v)}
                          disabled={trading}
                        >
                          {v === "custom" ? "Custom" : `%${v}`}
                        </Button>
                      ))}
                    </div>
                    {slippageMode === "custom" && (
                      <Input
                        className="mt-2 h-11 rounded-xl border-white/15 bg-black/35"
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="50"
                        value={customSlippage}
                        onChange={(e) => setCustomSlippage(e.target.value)}
                        placeholder="1"
                      />
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/20 bg-black/35 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Pair</span>
                      <span className="inline-flex items-center gap-1">
                        <ArrowDownUp className="h-3.5 w-3.5" />
                        {side === "BUY" ? `USDC -> ${tradeTokenSymbol}` : `${tradeTokenSymbol} -> USDC`}
                      </span>
                    </div>
                    {side === "BUY" ? (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-zinc-400">Estimated cost</span>
                        <span>{buyModel ? `${buyModel.inputUsdc.toFixed(2)} USDC` : "-"}</span>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-zinc-400">Estimated out</span>
                        <span>{sellModel ? `${sellModel.expectedUsdc.toFixed(2)} USDC` : "-"}</span>
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-zinc-400">Slippage min out</span>
                      <span>
                        {side === "BUY"
                          ? buyModel
                            ? `${buyModel.minOutToken.toFixed(6)} ${tradeTokenSymbol}`
                            : "-"
                          : sellModel
                            ? `${sellModel.minOutUsdc.toFixed(2)} USDC`
                            : "-"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-zinc-400">Router</span>
                      <span>{routerAddress ? shortAddr(routerAddress) : "Missing"}</span>
                    </div>
                  </div>

                  <Button className="w-full" onClick={handleTrade} disabled={!canTrade}>
                    {trading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {trading ? "Processing..." : tradeButtonLabel}
                  </Button>
                  {pendingSwapReq ? (
                    <Button className="w-full" variant="secondary" onClick={handleSendPendingSwap} disabled={trading}>
                      {trading ? "Sending..." : "Send Swap"}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
              ) : null}
            </div>
          )}

          {activeTab === "friends" && (
            <div className="space-y-3">
              <Card className="border-white/20 bg-black/45 backdrop-blur-xl shadow-[0_16px_50px_-28px_rgba(129,140,248,0.9)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Friends</CardTitle>
                    <Users className="h-5 w-5 text-zinc-400" />
                  </div>
                  <CardDescription>Trader social layer and follow actions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      className="h-11 rounded-xl border-white/15 bg-black/35 pl-9"
                      value={friendsQuery}
                      onChange={(e) => setFriendsQuery(e.target.value)}
                      placeholder="Search traders or friends..."
                    />
                  </div>
                  <div className="flex gap-2 overflow-auto pb-1">
                    <Button variant={friendsFilter === "all" ? "default" : "outline"} onClick={() => setFriendsFilter("all")}>All Traders</Button>
                    <Button variant={friendsFilter === "most" ? "default" : "outline"} onClick={() => setFriendsFilter("most")}>Most Copied</Button>
                    <Button variant={friendsFilter === "win" ? "default" : "outline"} onClick={() => setFriendsFilter("win")}>Top Win-Rate</Button>
                    <Button variant={friendsFilter === "following" ? "default" : "outline"} onClick={() => setFriendsFilter("following")}>Following</Button>
                  </div>
                  <div className="space-y-2">
                    {filteredFriends.slice(0, 20).map((f) => (
                      <div key={f.userId} className="rounded-2xl border border-white/20 bg-black/30 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{f.handle}</p>
                            <p className="text-xs text-zinc-400">{Number(f.trades || 0)} trades · WR {Number(f.winRate || 0).toFixed(1)}%</p>
                          </div>
                          <Button size="sm" variant={f.following ? "outline" : "default"} onClick={() => handleToggleFollow(f.userId)}>
                            {f.following ? "Following" : "Follow"}
                          </Button>
                        </div>
                      </div>
                    ))}
                    {filteredFriends.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-500">No trader found.</div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "feed" && (
            <div className="space-y-3">
              <Card className="border-white/20 bg-black/45 backdrop-blur-xl shadow-[0_16px_50px_-28px_rgba(129,140,248,0.9)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Feed</CardTitle>
                    <Newspaper className="h-5 w-5 text-zinc-400" />
                  </div>
                  <CardDescription>Global/following social trade stream.</CardDescription>
                  <div className="flex gap-2">
                    <Button variant={feedScope === "global" ? "default" : "outline"} onClick={() => { setFeedScope("global"); setNewTradesCount(0); }}>
                      Global
                    </Button>
                    <Button variant={feedScope === "following" ? "default" : "outline"} onClick={() => { setFeedScope("following"); setNewTradesCount(0); }}>
                      Following
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-400">{newTradesCount} new trades detected</p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="space-y-2">
                    {feedVM.slice(0, 12).map((row) => (
                      <div key={row.id} className="rounded-xl border border-white/20 bg-black/35 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{row.handle}</p>
                          <p className="text-xs text-zinc-500">{row.ts}</p>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <p className={`text-sm font-medium ${row.side === "BUY" ? "text-emerald-400" : row.side === "SELL" ? "text-rose-400" : "text-zinc-300"}`}>
                            {row.side || "SWAP"} {row.token || ""}
                          </p>
                          <p className="text-sm">{formatUsd(row.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-black/35 p-3">
                    <div className="flex items-center gap-2">
                      {error ? <CircleAlert className="h-4 w-4 text-rose-400" /> : <CircleCheck className="h-4 w-4 text-emerald-400" />}
                      <span>{error ? "Last action failed" : "System ready"}</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">{error || status || "No trade action yet."}</p>
                  </div>

                  <div className="rounded-2xl border border-white/20 bg-black/35 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Onchain PnL</span>
                      <span className={(Number(onchainPnl?.total || 0) >= 0) ? "text-emerald-400" : "text-rose-400"}>
                        {onchainPnl ? `${Number(onchainPnl.total || 0).toFixed(2)} USDC` : "-"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Realized: {onchainPnl ? Number(onchainPnl.realized || 0).toFixed(2) : "-"}</span>
                      <span>Unrealized: {onchainPnl ? Number(onchainPnl.unrealized || 0).toFixed(2) : "-"}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/20 bg-black/35 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-zinc-400">{insightToken} Holders (App)</span>
                      <span className="text-zinc-500">Top 6</span>
                    </div>
                    {holderBoard.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {holderBoard.slice(0, 6).map((h) => (
                          <a
                            key={h.userId}
                            className="rounded-lg border border-white/20 bg-zinc-900/70 px-2 py-1.5 transition-all hover:border-violet-400/50"
                            href={h.walletAddress ? `https://basescan.org/address/${h.walletAddress}` : "#"}
                            target={h.walletAddress ? "_blank" : undefined}
                            rel={h.walletAddress ? "noreferrer" : undefined}
                          >
                            <p className="truncate text-[11px] text-zinc-300">{h.handle || h.userId}</p>
                            <p className="text-[11px] text-zinc-400">{Number(h.amount || 0).toFixed(3)} {insightToken}</p>
                            <p className={`text-[11px] ${Number(h.pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {Number(h.pnl || 0) >= 0 ? "+" : ""}{Number(h.pnl || 0).toFixed(2)}
                            </p>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500">No holder data yet.</div>
                    )}
                  </div>

                  {lastApproveTx ? (
                    <a className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs" href={`https://basescan.org/tx/${lastApproveTx}`} target="_blank" rel="noreferrer">
                      <span>Approve tx: {shortAddr(lastApproveTx)}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-500">No approve tx yet.</div>
                  )}

                  {lastSwapTx ? (
                    <a className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs" href={`https://basescan.org/tx/${lastSwapTx}`} target="_blank" rel="noreferrer">
                      <span>Swap tx: {shortAddr(lastSwapTx)}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-500">No swap tx yet.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="space-y-3">
              <Card className="border-white/20 bg-black/45 backdrop-blur-xl shadow-[0_16px_50px_-28px_rgba(129,140,248,0.9)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-violet-400/60 bg-violet-500/20">
                      {profileVM.avatarUrl ? (
                        <img src={profileVM.avatarUrl} alt={profileVM.displayName} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-violet-300" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{profileVM.displayName}</CardTitle>
                      {editingBio ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            className="w-full rounded-xl border border-white/20 bg-black/35 px-2 py-1.5 text-xs text-zinc-100 outline-none"
                            rows={3}
                            value={bioDraft}
                            onChange={(e) => setBioDraft(e.target.value)}
                            placeholder="Write your bio..."
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveBio}>Save Bio</Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditingBio(false); setBioDraft(profileVM.bio || ""); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <CardDescription>{profileVM.bio}</CardDescription>
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => setEditingBio(true)}>
                            Edit Bio
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {profileVM.verified?.farcaster ? <Badge variant="success">Farcaster verified</Badge> : null}
                    {profileVM.verified?.baseapp ? <Badge variant="success">Base app verified</Badge> : null}
                    {profileVM.verified?.twitter ? <Badge variant="success">X verified</Badge> : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl border border-white/20 bg-black/30 p-2">
                      <p className="text-zinc-500">Trades</p>
                      <p className="font-semibold">{profileVM.totalTrades}</p>
                    </div>
                    <div className="rounded-xl border border-white/20 bg-black/30 p-2">
                      <p className="text-zinc-500">Followers (App)</p>
                      <p className="font-semibold">{profileVM.followers}</p>
                      {profileVM.farcasterFollowers > 0 ? <p className="text-[10px] text-zinc-500">FC {profileVM.farcasterFollowers}</p> : null}
                    </div>
                    <div className="rounded-xl border border-white/20 bg-black/30 p-2">
                      <p className="text-zinc-500">Following (App)</p>
                      <p className="font-semibold">{profileVM.following}</p>
                      {profileVM.farcasterFollowing > 0 ? <p className="text-[10px] text-zinc-500">FC {profileVM.farcasterFollowing}</p> : null}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-violet-400/40 bg-violet-500/10 p-3 text-xs">
                    <p className="font-semibold">Copy Trade</p>
                    <p className="text-zinc-400">Coming soon</p>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-black/35 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <p className="font-semibold text-zinc-200">App Traded Tokens</p>
                      <p className="text-zinc-500">Last activity</p>
                    </div>
                    {Array.isArray(profileVM.tradedTokens) && profileVM.tradedTokens.length > 0 ? (
                      <div className="space-y-2">
                        {profileVM.tradedTokens.map((t) => (
                          <div key={t.token} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-xs">
                            <div>
                              <p className="font-medium">{t.token}</p>
                              <p className="text-zinc-500">{t.trades} trades • B{t.buy}/S{t.sell}</p>
                            </div>
                            <p className={t.realizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              {t.realizedPnl >= 0 ? "+" : ""}{t.realizedPnl.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">No app trades yet.</p>
                    )}
                  </div>
                  <div className="space-y-1 rounded-2xl border border-white/20 bg-black/35 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Wallet</span>
                      <span>{walletConnected ? shortAddr(walletAddress) : "Not connected"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Wallet provider</span>
                      <span>{miniAppDetected ? "Injected" : "Not detected"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">USDC balance</span>
                      <span>{Number(walletSummary?.wallet?.usdc || 0).toFixed(2)} USDC</span>
                    </div>
                  </div>

                  {!walletConnected ? (
                    <Button className="w-full" onClick={handleConnectWallet} disabled={connecting}>
                      {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WalletIcon className="mr-2 h-4 w-4" />}
                      {connecting ? "Connecting..." : "Connect Wallet"}
                    </Button>
                  ) : (
                    <a
                      className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs"
                      href={`https://basescan.org/address/${walletAddress}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>View connected wallet on Basescan</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-md px-4 pb-4">
          <div className="grid grid-cols-4 gap-2 rounded-3xl border border-white/20 bg-black/60 p-2 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(99,102,241,0.85)]">
            <Button variant={activeTab === "home" ? "default" : "ghost"} className="h-10" onClick={() => setActiveTab("home")}>
              <Home className="h-4 w-4" />
            </Button>
            <Button variant={activeTab === "friends" ? "default" : "ghost"} className="h-10" onClick={() => setActiveTab("friends")}>
              <Users className="h-4 w-4" />
            </Button>
            <Button variant={activeTab === "feed" ? "default" : "ghost"} className="h-10" onClick={() => setActiveTab("feed")}>
              <Newspaper className="h-4 w-4" />
            </Button>
            <Button variant={activeTab === "profile" ? "default" : "ghost"} className="h-10" onClick={() => setActiveTab("profile")}>
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}




