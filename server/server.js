import "dotenv/config";
import { createServer } from "node:http";
import { parseWebhookEvent, verifyAppKeyWithNeynar } from "@farcaster/miniapp-node";
import { createClient as createQuickAuthClient } from "@farcaster/quick-auth";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { Attribution } from "ox/erc8021";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const db = {
  users: new Map(),
  follows: new Map(),
  notifications: new Map(),
  idempotency: new Map(),
  onchainTxs: new Map(),
  onchainOperations: new Map(),
  copySettings: new Map(),
  rateLimits: new Map(),
  webhookReplay: new Map()
};

const TOKEN_REGISTRY = {
  "0x4200000000000000000000000000000000000006": { symbol: "ETH", name: "Ethereum", contract: "0x4200000000000000000000000000000000000006", decimals: 18 },
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631": { symbol: "AERO", name: "Aerodrome", contract: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", decimals: 18 },
  "0x4ed4e862860beef2b1f4e1a6f3c5fcb4f6f8f7f7": { symbol: "DEGEN", name: "Degen", contract: "0x4ed4e862860beef2b1f4e1a6f3c5fcb4f6f8f7f7", decimals: 18 },
  "0x532f27101965dd16442e59d40670faf5ebb142e4": { symbol: "BRETT", name: "Brett", contract: "0x532f27101965dd16442e59d40670faf5ebb142e4", decimals: 18 },
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC", name: "USD Coin", contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 }
};

const tokenPrices = {
  ETH: 3500,
  AERO: 1.2,
  DEGEN: 0.015,
  BRETT: 0.14,
  USDC: 1
};

const TOKEN_MARKET_DATA = {
  ETH: { verified: true, tradable: true, mcap: "$420.2B", volume24h: "$12.8B", change24h: 1.92, spark: "0,30 16,28 32,26 48,24 64,20 80,18 96,14 112,12" },
  USDC: { verified: true, tradable: true, mcap: "$35.1B", volume24h: "$7.1B", change24h: 0.01, spark: "0,20 16,20 32,20 48,19 64,20 80,20 96,19 112,20" },
  AERO: { verified: true, tradable: true, mcap: "$2.1B", volume24h: "$182M", change24h: 4.32, spark: "0,36 16,34 32,32 48,28 64,24 80,20 96,16 112,10" },
  DEGEN: { verified: false, tradable: true, mcap: "$210M", volume24h: "$52M", change24h: -2.14, spark: "0,14 16,16 32,17 48,20 64,24 80,23 96,27 112,30" },
  BRETT: { verified: false, tradable: true, mcap: "$1.3B", volume24h: "$144M", change24h: 3.48, spark: "0,35 16,34 32,30 48,27 64,24 80,20 96,16 112,13" }
};

const ENABLE_REAL_ONCHAIN = process.env.NODE_ENV === "test" ? false : process.env.ENABLE_REAL_ONCHAIN === "true";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "";
const TRADE_EXECUTOR_ADDRESS = process.env.TRADE_EXECUTOR_ADDRESS || "";
const SERVER_SIGNER_PRIVATE_KEY = process.env.SERVER_SIGNER_PRIVATE_KEY || "";
const TRADE_EXECUTOR_FUNCTION = process.env.TRADE_EXECUTOR_FUNCTION || "executeTrade";
const BUILDER_CODE = process.env.BUILDER_CODE || "bc_g19kvpy7";
const BUILDER_DATA_SUFFIX = (() => {
  const raw = String(process.env.BUILDER_DATA_SUFFIX || "").trim();
  if (raw) return raw.startsWith("0x") ? raw : "0x" + raw;
  try {
    if (!BUILDER_CODE) return "";
    return Attribution.toDataSuffix({ codes: [BUILDER_CODE] });
  } catch {
    return "";
  }
})();

function appendBuilderDataSuffix(calldata) {
  if (!BUILDER_DATA_SUFFIX) return calldata;
  const body = String(calldata || "").replace(/^0x/, "");
  const suffix = String(BUILDER_DATA_SUFFIX).replace(/^0x/, "");
  return "0x" + body + suffix;
}
const DEFAULT_TRADE_EXECUTOR_ABI = [
  "function executeTrade(address token,uint8 side,uint256 amountUsdc,uint256 minOut,address recipient,bytes32 orderId)"
];

function loadTradeExecutorAbi() {
  const raw = process.env.TRADE_EXECUTOR_ABI_JSON;
  if (!raw) return DEFAULT_TRADE_EXECUTOR_ABI;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return DEFAULT_TRADE_EXECUTOR_ABI;
  } catch {
    return DEFAULT_TRADE_EXECUTOR_ABI;
  }
}

const TRADE_EXECUTOR_ABI = loadTradeExecutorAbi();
const APP_BASE_URL = process.env.APP_BASE_URL || "";
const FC_FRAME_VERSION = process.env.FC_FRAME_VERSION || "1";
const FC_FRAME_NAME = process.env.FC_FRAME_NAME || "BaseRush";
const FC_BUTTON_TITLE = process.env.FC_BUTTON_TITLE || "Open BaseRush";
const FC_SPLASH_BG = process.env.FC_SPLASH_BG || "#0B0F14";
const FC_SUBTITLE = process.env.FC_SUBTITLE || "Trade feed on Base";
const FC_DESCRIPTION = process.env.FC_DESCRIPTION || "Track traders, see live activity, and execute USDC trades on Base with social insights.";
const FC_TAGLINE = process.env.FC_TAGLINE || "Trade social on Base";
const FC_OG_TITLE = process.env.FC_OG_TITLE || "BaseRush";
const FC_OG_DESCRIPTION = process.env.FC_OG_DESCRIPTION || "Social trading feed and copy tools on Base.";
const FC_NOINDEX = String(process.env.FC_NOINDEX || "false").toLowerCase() === "true";
const FC_PRIMARY_CATEGORY = process.env.FC_PRIMARY_CATEGORY || "finance";
const FC_TAGS = process.env.FC_TAGS || "base,trading,socialfi,copytrade,defi";
const FC_NOTIFICATION_MODE = String(process.env.FC_NOTIFICATION_MODE || "native").toLowerCase();
const FC_NEYNAR_EVENT_WEBHOOK_URL = process.env.FC_NEYNAR_EVENT_WEBHOOK_URL || "";
const RATE_LIMIT_ENABLED = process.env.NODE_ENV === "test" ? false : String(process.env.RATE_LIMIT_ENABLED || "true") === "true";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 120);
const RATE_LIMIT_TRADE_MAX = Number(process.env.RATE_LIMIT_TRADE_MAX || 30);
const BODY_MAX_BYTES = Number(process.env.BODY_MAX_BYTES || 256 * 1024);
const FC_WEBHOOK_REQUIRE_VERIFY = process.env.NODE_ENV === "test" ? false : String(process.env.FC_WEBHOOK_REQUIRE_VERIFY || "true") === "true";
const ALLOW_LOCAL_SIGNER_IN_PROD = String(process.env.ALLOW_LOCAL_SIGNER_IN_PROD || "false") === "true";
const FC_AUTH_REQUIRED = process.env.NODE_ENV === "test" ? false : String(process.env.FC_AUTH_REQUIRED || "true") === "true";
const FC_QUICK_AUTH_ORIGIN = process.env.FC_QUICK_AUTH_ORIGIN || "https://auth.farcaster.xyz";
const FC_AUTH_ALLOWED_DOMAINS = process.env.FC_AUTH_ALLOWED_DOMAINS || "";
const FC_AUTH_DEBUG = process.env.NODE_ENV === "production" ? String(process.env.FC_AUTH_DEBUG || "false") === "true" : true;
const quickAuthClient = createQuickAuthClient({ origin: FC_QUICK_AUTH_ORIGIN });

function normalizePlainText(value, maxLen) {
  const safe = String(value || "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return safe.slice(0, maxLen);
}

function normalizeCategory(value) {
  const allowed = new Set([
    "games",
    "social",
    "finance",
    "utility",
    "productivity",
    "health-fitness",
    "news-media",
    "music",
    "shopping",
    "education",
    "developer-tools",
    "entertainment",
    "art-creativity"
  ]);
  const v = String(value || "").toLowerCase().trim();
  return allowed.has(v) ? v : "finance";
}

function normalizeTags(value) {
  const items = String(value || "")
    .split(",")
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20))
    .filter(Boolean);
  return Array.from(new Set(items)).slice(0, 5);
}

function normalizeUrls(value, limit = 3) {
  return String(value || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function trimSlash(url) {
  return String(url || "").replace(/\/$/, "");
}

function buildFarcasterManifestFromEnv() {
  const header = process.env.FC_ACCOUNT_ASSOC_HEADER || "";
  const payload = process.env.FC_ACCOUNT_ASSOC_PAYLOAD || "";
  const signature = process.env.FC_ACCOUNT_ASSOC_SIGNATURE || "";

  const hasAssociation = !!(header && payload && signature);
  const homeUrl = process.env.FC_HOME_URL || APP_BASE_URL || "";
  if (!homeUrl) return null;

  const root = trimSlash(homeUrl);
  const iconUrl = process.env.FC_ICON_URL || (root + "/icon.png");
  const imageUrl = process.env.FC_IMAGE_URL || (root + "/og.png");
  const heroImageUrl = process.env.FC_HERO_IMAGE_URL || imageUrl;
  const ogImageUrl = process.env.FC_OG_IMAGE_URL || imageUrl;
  const splashImageUrl = process.env.FC_SPLASH_IMAGE_URL || (root + "/splash.png");
  const webhookUrl = (
    FC_NOTIFICATION_MODE === "neynar" && FC_NEYNAR_EVENT_WEBHOOK_URL
      ? FC_NEYNAR_EVENT_WEBHOOK_URL
      : (process.env.FC_WEBHOOK_URL || (root + "/api/farcaster/webhook"))
  );
  const screenshotUrls = normalizeUrls(
    process.env.FC_SCREENSHOT_URLS ||
      `${root}/screenshots/home.png,${root}/screenshots/feed.png,${root}/screenshots/profile.png`,
    3
  );

  const frameMeta = {
    version: FC_FRAME_VERSION,
    name: normalizePlainText(FC_FRAME_NAME, 30) || "BaseRush",
    homeUrl,
    iconUrl,
    imageUrl,
    buttonTitle: normalizePlainText(FC_BUTTON_TITLE, 30) || "Open BaseRush",
    splashImageUrl,
    splashBackgroundColor: FC_SPLASH_BG,
    webhookUrl,
    subtitle: normalizePlainText(FC_SUBTITLE, 30),
    description: normalizePlainText(FC_DESCRIPTION, 170),
    screenshotUrls,
    heroImageUrl,
    tagline: normalizePlainText(FC_TAGLINE, 30),
    ogTitle: normalizePlainText(FC_OG_TITLE, 30),
    ogDescription: normalizePlainText(FC_OG_DESCRIPTION, 100),
    ogImageUrl,
    noindex: FC_NOINDEX,
    primaryCategory: normalizeCategory(FC_PRIMARY_CATEGORY),
    tags: normalizeTags(FC_TAGS),
    canonicalDomain: (new URL(homeUrl)).hostname,
    requiredChains: ["eip155:8453"],
    requiredCapabilities: ["actions.ready"]
  };

  return {
    accountAssociation: {
      header: hasAssociation ? header : "REPLACE_WITH_HEADER",
      payload: hasAssociation ? payload : "REPLACE_WITH_PAYLOAD",
      signature: hasAssociation ? signature : "REPLACE_WITH_SIGNATURE"
    },
    frame: frameMeta,
    miniapp: frameMeta
  };
}

const TRADE_EXECUTOR_ARGS_TEMPLATE = (() => {
  const raw = process.env.TRADE_EXECUTOR_ARGS_TEMPLATE_JSON;
  if (!raw) return ["$tokenAddress", "$sideInt", "$usdcAmount", "$minOut", "$recipient", "$orderId"];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["$tokenAddress", "$sideInt", "$usdcAmount", "$minOut", "$recipient", "$orderId"];
  } catch {
    return ["$tokenAddress", "$sideInt", "$usdcAmount", "$minOut", "$recipient", "$orderId"];
  }
})();


function json(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function httpStatusFromError(err) {
  const code = Number(err?.status || err?.statusCode || err?.code);
  if (Number.isInteger(code) && code >= 400 && code <= 599) return code;
  return 500;
}

function rounded(n, decimals = 2) {
  return Number(Number(n).toFixed(decimals));
}

function randomHex(bytes = 32) {
  let out = "";
  for (let i = 0; i < bytes; i += 1) out += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
  return out;
}

function buildMockTx(symbol) {
  const txHash = "0x" + randomHex(32);
  return {
    chainId: 8453,
    network: "base",
    token: symbol,
    status: "confirmed",
    txHash,
    explorerUrl: `https://basescan.org/tx/${txHash}`,
    confirmedAt: new Date().toISOString()
  };
}
function createOnchainOperation({ kind = "trade", userId, token, side, idempotencyKey, leaderUserId = null }) {
  const now = new Date().toISOString();
  const operationId = `op_${Date.now()}_${randomHex(6)}`;
  const operation = {
    operationId,
    kind,
    userId: String(userId || ""),
    leaderUserId: leaderUserId ? String(leaderUserId) : null,
    token: String(token || "").toUpperCase(),
    side: String(side || "").toUpperCase(),
    idempotencyKey: String(idempotencyKey || ""),
    status: "requested",
    createdAt: now,
    updatedAt: now,
    txHash: null,
    explorerUrl: null,
    executionMode: null,
    error: null,
    timeline: [{ status: "requested", at: now, note: "Operation requested" }]
  };
  db.onchainOperations.set(operationId, operation);
  return operation;
}

function readOnchainOperation(operationId) {
  const key = String(operationId || "").trim();
  return key ? db.onchainOperations.get(key) || null : null;
}

function updateOnchainOperation(operationId, status, patch = {}) {
  const operation = readOnchainOperation(operationId);
  if (!operation) return null;

  const nextStatus = String(status || operation.status || "").toLowerCase();
  const validStatuses = new Set(["requested", "submitted", "confirmed", "failed"]);
  if (!validStatuses.has(nextStatus)) return operation;

  const now = new Date().toISOString();
  if (operation.status !== nextStatus) {
    operation.timeline.unshift({
      status: nextStatus,
      at: now,
      note: patch.note || null
    });
  }

  operation.status = nextStatus;
  operation.updatedAt = now;
  if (patch.txHash !== undefined) operation.txHash = patch.txHash || null;
  if (patch.explorerUrl !== undefined) operation.explorerUrl = patch.explorerUrl || null;
  if (patch.executionMode !== undefined) operation.executionMode = patch.executionMode || null;
  if (patch.error !== undefined) operation.error = patch.error || null;

  return operation;
}

function toPublicOnchainTx(tx) {
  if (!tx) return null;
  return {
    chainId: tx.chainId,
    network: tx.network,
    token: tx.token,
    status: tx.status,
    txHash: tx.txHash,
    explorerUrl: tx.explorerUrl || null,
    confirmedAt: tx.confirmedAt || null,
    blockNumber: tx.blockNumber || null,
    quote: tx.quote || null,
    builderCode: tx.builderCode || null,
    builderSuffixApplied: !!tx.builderSuffixApplied,
    operationId: tx.operationId || null
  };
}

function toPublicOnchainOperation(operation) {
  if (!operation) return null;
  return {
    operationId: operation.operationId,
    kind: operation.kind,
    token: operation.token,
    side: operation.side,
    status: operation.status,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
    txHash: operation.txHash || null,
    explorerUrl: operation.explorerUrl || null,
    executionMode: operation.executionMode || null,
    error: operation.error || null,
    timeline: Array.isArray(operation.timeline)
      ? operation.timeline.map((step) => ({
          status: step.status,
          at: step.at,
          note: step.note || null
        }))
      : []
  };
}
function getOrCreateUser(userId) {
  if (!db.users.has(userId)) {
    db.users.set(userId, {
      userId,
      auth: { provider: "guest", fid: null, address: null, username: null },
      wallet: { usdc: 0, feesPaid: 0, realizedPnl: 0 },
      positions: {},
      trades: [],
      premium: { active: false, expiresAt: null },
      feeBps: 35
    });
  }
  return db.users.get(userId);
}

function getOrCreateCopySettings(userId) {
  if (!db.copySettings.has(userId)) {
    db.copySettings.set(userId, {
      enabled: true,
      ratio: 0.2,
      maxUsdcPerTrade: 25,
      slippageBps: 100,
      updatedAt: new Date().toISOString()
    });
  }
  return db.copySettings.get(userId);
}

function ensurePremiumStatus(user) {
  const active = !!(user.premium.active && user.premium.expiresAt && new Date(user.premium.expiresAt) > new Date());
  if (!active && user.premium.active) user.premium.active = false;
  return user.premium.active;
}

function addNotification(userId, text, meta = {}) {
  if (!db.notifications.has(userId)) db.notifications.set(userId, []);
  db.notifications.get(userId).unshift({
    id: `n_${Date.now()}`,
    text,
    at: new Date().toISOString(),
    channel: meta.channel || "in_app",
    type: meta.type || "system"
  });
}

function getPosition(user, token) {
  if (!user.positions[token]) user.positions[token] = { amount: 0, costBasis: 0 };
  return user.positions[token];
}

function buildWalletSummary(user) {
  const holdings = {};
  const positions = {};
  let unrealizedPnl = 0;

  Object.entries(user.positions).forEach(([token, pos]) => {
    if (pos.amount <= 0) return;
    const markPrice = tokenPrices[token] || 0;
    const marketValue = rounded(pos.amount * markPrice, 2);
    const positionUnrealized = rounded(marketValue - pos.costBasis, 2);
    const avgCost = pos.amount > 0 ? rounded(pos.costBasis / pos.amount, 6) : 0;

    holdings[token] = rounded(pos.amount, 6);
    positions[token] = {
      amount: rounded(pos.amount, 6),
      avgCost,
      costBasis: rounded(pos.costBasis, 2),
      markPrice,
      marketValue,
      unrealizedPnl: positionUnrealized
    };
    unrealizedPnl += positionUnrealized;
  });

  unrealizedPnl = rounded(unrealizedPnl, 2);
  const realizedPnl = rounded(user.wallet.realizedPnl || 0, 2);
  const totalPnl = rounded(realizedPnl + unrealizedPnl, 2);

  return {
    wallet: {
      usdc: rounded(user.wallet.usdc, 2),
      feesPaid: rounded(user.wallet.feesPaid || 0, 2),
      realizedPnl,
      unrealizedPnl,
      totalPnl
    },
    holdings,
    positions,
    recentTrades: user.trades.slice(0, 10)
  };
}

function buildTokenDirectory() {
  return Object.values(TOKEN_REGISTRY).map((token) => {
    const symbol = token.symbol;
    const market = TOKEN_MARKET_DATA[symbol] || {};
    return {
      ...token,
      price: tokenPrices[symbol] || 0,
      verified: !!market.verified,
      tradable: market.tradable !== false,
      mcap: market.mcap || "-",
      volume24h: market.volume24h || "-",
      change24h: Number(market.change24h || 0),
      spark: market.spark || "0,20 16,20 32,20 48,20 64,20 80,20 96,20 112,20"
    };
  });
}

function buildTokenLeaderboard(symbol) {
  const normalized = String(symbol || "").toUpperCase();
  const rows = [];

  db.users.forEach((user) => {
    const pos = user.positions?.[normalized] || { amount: 0, costBasis: 0 };
    const trades = (user.trades || []).filter((t) => t.token === normalized);
    const tradeCount = trades.length;
    const realized = rounded(trades.reduce((acc, t) => acc + Number(t.realizedPnl || 0), 0), 2);
    const mark = tokenPrices[normalized] || 0;
    const unrealized = pos.amount > 0 ? rounded(pos.amount * mark - pos.costBasis, 2) : 0;
    const pnl = rounded(realized + unrealized, 2);

    if (tradeCount > 0 || pos.amount > 0) {
      rows.push({
        userId: user.userId,
        handle: user.auth?.username ? "@" + user.auth.username : "@" + user.userId,
        pnl,
        trades: tradeCount,
        amount: rounded(pos.amount || 0, 6)
      });
    }
  });

  return rows.sort((a, b) => b.pnl - a.pnl).slice(0, 5);
}

function findTokenByContractOrSymbol(input) {
  const q = String(input || "").trim();
  if (!q) return null;
  const lower = q.toLowerCase();
  if (TOKEN_REGISTRY[lower]) return TOKEN_REGISTRY[lower];
  const upper = q.toUpperCase();
  return Object.values(TOKEN_REGISTRY).find((t) => t.symbol === upper) || null;
}

function resolveTradeInputs(user, { token, side = "BUY", amountUsdc, tokenAmount, sellPercent }) {
  const normalizedToken = String(token || "").toUpperCase();
  const price = tokenPrices[normalizedToken];
  if (!price) {
    const err = new Error("unsupported_token");
    err.code = 400;
    throw err;
  }

  const normalizedSide = String(side || "BUY").toUpperCase();
  if (!['BUY', 'SELL'].includes(normalizedSide)) {
    const err = new Error("unsupported_side");
    err.code = 400;
    throw err;
  }

  let resolvedAmountUsdc = Number(amountUsdc || 0);
  let resolvedTokenAmount = Number(tokenAmount || 0);

  if (normalizedSide === 'BUY') {
    if (!(resolvedAmountUsdc > 0)) {
      const err = new Error("invalid_amount");
      err.code = 400;
      throw err;
    }
  }

  if (normalizedSide === 'SELL') {
    const position = getPosition(user, normalizedToken);
    const percent = Number(sellPercent || 0);

    if (!(resolvedTokenAmount > 0) && percent > 0) {
      if (percent <= 0 || percent > 100) {
        const err = new Error("invalid_sell_percent");
        err.code = 400;
        throw err;
      }
      resolvedTokenAmount = rounded((position.amount * percent) / 100, 6);
    }

    if (!(resolvedTokenAmount > 0) && resolvedAmountUsdc > 0) {
      resolvedTokenAmount = rounded(resolvedAmountUsdc / price, 6);
    }

    if (!(resolvedTokenAmount > 0)) {
      const err = new Error("invalid_amount");
      err.code = 400;
      throw err;
    }

    resolvedAmountUsdc = rounded(resolvedTokenAmount * price, 2);
  }

  return {
    side: normalizedSide,
    amountUsdc: normalizedSide === 'BUY' ? resolvedAmountUsdc : resolvedAmountUsdc,
    tokenAmount: normalizedSide === 'BUY' ? 0 : resolvedTokenAmount
  };
}

function makeTradeQuote({ user, token, side = "BUY", amountUsdc, tokenAmount, slippageBps = 50 }) {
  const normalizedToken = String(token || "").toUpperCase();
  const price = tokenPrices[normalizedToken];
  if (!price) {
    const err = new Error("unsupported_token");
    err.code = 400;
    throw err;
  }

  const normalizedSide = String(side || "BUY").toUpperCase();
  if (!["BUY", "SELL"].includes(normalizedSide)) {
    const err = new Error("unsupported_side");
    err.code = 400;
    throw err;
  }

  const feeBps = user.feeBps || 35;
  const inputUsdc = normalizedSide === "BUY" ? Number(amountUsdc || 0) : rounded(Number(tokenAmount || 0) * price, 2);
  if (!inputUsdc || inputUsdc <= 0) {
    const err = new Error("invalid_amount");
    err.code = 400;
    throw err;
  }

  const feeUsdc = rounded((inputUsdc * feeBps) / 10000, 2);
  const netUsdc = rounded(inputUsdc - feeUsdc, 2);

  return {
    token: normalizedToken,
    side: normalizedSide,
    price,
    feeBps,
    feeUsdc,
    inputUsdc,
    netUsdc,
    outTokenAmount: normalizedSide === "BUY" ? rounded(netUsdc / price, 6) : Number(tokenAmount || 0),
    outUsdc: normalizedSide === "SELL" ? netUsdc : null,
    slippageBps: Number(slippageBps || 50),
    expiresInSec: 15
  };
}

function executeTradeForUser(user, { token, side = "BUY", amountUsdc, tokenAmount, sellPercent, executionMode = "SIMULATED", onchainTx = null, onchainOperation = null, copyFrom = null }) {
  const normalizedToken = String(token).toUpperCase();
  const price = tokenPrices[normalizedToken];
  if (!price) {
    const err = new Error("unsupported_token");
    err.code = 400;
    throw err;
  }

  const normalizedSide = String(side).toUpperCase();
  if (!["BUY", "SELL"].includes(normalizedSide)) {
    const err = new Error("unsupported_side");
    err.code = 400;
    throw err;
  }

  const position = getPosition(user, normalizedToken);
  let gross = Number(amountUsdc || 0);
  let qty = Number(tokenAmount || 0);

  if (normalizedSide === "BUY") {
    if (!gross || gross <= 0) {
      const err = new Error("invalid_amount");
      err.code = 400;
      throw err;
    }
    if (user.wallet.usdc < gross) {
      const err = new Error("insufficient_usdc");
      err.code = 402;
      throw err;
    }

    const fee = rounded((gross * user.feeBps) / 10000, 2);
    const net = rounded(gross - fee, 2);
    qty = rounded(net / price, 6);

    user.wallet.usdc = rounded(user.wallet.usdc - gross, 2);
    user.wallet.feesPaid = rounded(user.wallet.feesPaid + fee, 2);

    position.amount = rounded(position.amount + qty, 6);
    position.costBasis = rounded(position.costBasis + gross, 2);

    user.trades.unshift({
      id: `tr_${Date.now()}`,
      token: normalizedToken,
      side: "BUY",
      grossUsdc: gross,
      feeUsdc: fee,
      netUsdc: net,
      tokenAmount: qty,
      price,
      realizedPnl: 0,
      executionMode,
      onchainTxHash: onchainTx?.txHash || null,
      txStatus: onchainOperation?.status || onchainTx?.status || null,
      operationId: onchainOperation?.operationId || null,
      copyFrom,
      sellPercent: Number(sellPercent || 0) > 0 ? Number(sellPercent) : null,
      at: new Date().toISOString()
    });
  }

  if (normalizedSide === "SELL") {
    const percent = Number(sellPercent || 0);
    if ((!qty || qty <= 0) && percent > 0) {
      if (percent <= 0 || percent > 100) {
        const err = new Error("invalid_sell_percent");
        err.code = 400;
        throw err;
      }
      qty = rounded((position.amount * percent) / 100, 6);
    }

    if (!qty || qty <= 0) {
      if (!gross || gross <= 0) {
        const err = new Error("invalid_amount");
        err.code = 400;
        throw err;
      }
      qty = rounded(gross / price, 6);
    }

    if (!position.amount || position.amount <= 0 || qty > position.amount) {
      const err = new Error("insufficient_holding");
      err.code = 400;
      throw err;
    }

    gross = rounded(qty * price, 2);
    const fee = rounded((gross * user.feeBps) / 10000, 2);
    const net = rounded(gross - fee, 2);

    const avgCost = position.amount > 0 ? rounded(position.costBasis / position.amount, 6) : 0;
    const removedCost = rounded(avgCost * qty, 2);
    const realized = rounded(net - removedCost, 2);

    user.wallet.usdc = rounded(user.wallet.usdc + net, 2);
    user.wallet.feesPaid = rounded(user.wallet.feesPaid + fee, 2);
    user.wallet.realizedPnl = rounded(user.wallet.realizedPnl + realized, 2);

    position.amount = rounded(position.amount - qty, 6);
    position.costBasis = rounded(position.costBasis - removedCost, 2);
    if (position.amount <= 0.000001) {
      position.amount = 0;
      position.costBasis = 0;
    }

    user.trades.unshift({
      id: `tr_${Date.now()}`,
      token: normalizedToken,
      side: "SELL",
      grossUsdc: gross,
      feeUsdc: fee,
      netUsdc: net,
      tokenAmount: qty,
      price,
      realizedPnl: realized,
      executionMode,
      onchainTxHash: onchainTx?.txHash || null,
      txStatus: onchainOperation?.status || onchainTx?.status || null,
      operationId: onchainOperation?.operationId || null,
      copyFrom,
      sellPercent: Number(sellPercent || 0) > 0 ? Number(sellPercent) : null,
      at: new Date().toISOString()
    });
  }

  user.trades = user.trades.slice(0, 100);
  const summary = buildWalletSummary(user);
  return { summary, trade: user.trades[0] };
}

function resolveExecutorArgs(template, vars) {
  return template.map((entry) => {
    if (typeof entry === "string" && entry.startsWith("$")) {
      const key = entry.slice(1);
      return vars[key];
    }
    return entry;
  });
}

async function sendTradeExecutorTx({ user, token, side, amountUsdc, tokenAmount, idempotencyKey, operationId = null, onchain = {} }) {
  const markFailed = (err, note = null) => {
    if (!operationId) return;
    updateOnchainOperation(operationId, "failed", {
      error: String(err?.message || "onchain_tx_failed"),
      note: note || "Onchain operation failed"
    });
  };

  try {
    if (!ENABLE_REAL_ONCHAIN || !BASE_RPC_URL || !TRADE_EXECUTOR_ADDRESS || !SERVER_SIGNER_PRIVATE_KEY) {
      const tx = buildMockTx(String(token).toUpperCase());
      if (operationId) {
        updateOnchainOperation(operationId, "submitted", {
          txHash: tx.txHash,
          explorerUrl: tx.explorerUrl,
          executionMode: "ONCHAIN_MOCK",
          note: "Mock tx submitted"
        });
        updateOnchainOperation(operationId, "confirmed", {
          txHash: tx.txHash,
          explorerUrl: tx.explorerUrl,
          executionMode: "ONCHAIN_MOCK",
          note: "Mock tx confirmed"
        });
      }

      return {
        tx,
        mode: "ONCHAIN_MOCK",
        operation: readOnchainOperation(operationId)
      };
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const signer = new ethers.Wallet(SERVER_SIGNER_PRIVATE_KEY, provider);
    const iface = new ethers.Interface(TRADE_EXECUTOR_ABI);

    const resolved = findTokenByContractOrSymbol(token);
    if (!resolved) {
      const err = new Error("token_not_found");
      err.code = 404;
      throw err;
    }

    const tokenAddress = resolved.contract;
    const normalizedSide = String(side).toUpperCase();
    const sideInt = normalizedSide === "BUY" ? 0 : 1;
    const quote = makeTradeQuote({
      user,
      token: resolved.symbol,
      side: normalizedSide,
      amountUsdc,
      tokenAmount,
      slippageBps: onchain.slippageBps || 50
    });
    const usdcAmount = BigInt(Math.round(Number(amountUsdc || quote.inputUsdc || 0) * 1e6));
    const slippageBps = Math.max(0, Number(onchain.slippageBps || quote.slippageBps || 50));
    const derivedMinOut = normalizedSide === "BUY"
      ? Math.floor(Number(quote.outTokenAmount || 0) * 1e6 * (1 - slippageBps / 10000))
      : Math.floor(Number(quote.outUsdc || 0) * 1e6 * (1 - slippageBps / 10000));
    const minOut = BigInt(Math.max(0, Number(onchain.minOut ?? derivedMinOut)));
    const recipient = user.auth?.address || signer.address;
    const orderId = ethers.id(user.userId + ":" + idempotencyKey);

    let data;
    let functionName;
    let args;
    if (onchain.calldata) {
      data = onchain.calldata;
    } else {
      functionName = onchain.functionName || TRADE_EXECUTOR_FUNCTION;
      const vars = { tokenAddress, sideInt, usdcAmount, minOut, recipient, orderId, tokenAmount };
      args = Array.isArray(onchain.args) && onchain.args.length > 0
        ? onchain.args
        : resolveExecutorArgs(TRADE_EXECUTOR_ARGS_TEMPLATE, vars);
      data = iface.encodeFunctionData(functionName, args);
    }

    const txReq = {
      to: TRADE_EXECUTOR_ADDRESS,
      data: appendBuilderDataSuffix(data),
      value: onchain.valueWei ? BigInt(onchain.valueWei) : 0n
    };

    if (onchain.gasLimit) txReq.gasLimit = BigInt(onchain.gasLimit);

    if (onchain.dryRun === true) {
      const callReq = {
        to: txReq.to,
        data: txReq.data,
        value: txReq.value
      };
      const callOut = await provider.call(callReq);
      const tx = {
        chainId: 8453,
        network: "base",
        token: resolved.symbol,
        status: "simulated",
        txHash: "0x" + randomHex(32),
        explorerUrl: null,
        confirmedAt: new Date().toISOString(),
        simulation: {
          functionName: functionName || TRADE_EXECUTOR_FUNCTION,
          args: args || [],
          returnData: callOut,
          builderCode: BUILDER_CODE || null,
          builderSuffixApplied: !!BUILDER_DATA_SUFFIX
        }
      };

      if (operationId) {
        updateOnchainOperation(operationId, "submitted", {
          txHash: tx.txHash,
          explorerUrl: tx.explorerUrl,
          executionMode: "ONCHAIN_SIMULATED",
          note: "Dry run submitted"
        });
        updateOnchainOperation(operationId, "confirmed", {
          txHash: tx.txHash,
          explorerUrl: tx.explorerUrl,
          executionMode: "ONCHAIN_SIMULATED",
          note: "Dry run confirmed"
        });
      }

      return {
        tx,
        quote,
        mode: "ONCHAIN_SIMULATED",
        operation: readOnchainOperation(operationId)
      };
    }

    const sent = await signer.sendTransaction(txReq);
    if (operationId) {
      updateOnchainOperation(operationId, "submitted", {
        txHash: sent.hash,
        explorerUrl: "https://basescan.org/tx/" + sent.hash,
        executionMode: "ONCHAIN_REAL",
        note: "Transaction submitted"
      });
    }

    const receipt = await sent.wait(1);
    if (!receipt || receipt.status !== 1) {
      const err = new Error("onchain_tx_failed");
      err.code = 502;
      throw err;
    }

    const tx = {
      chainId: 8453,
      network: "base",
      token: resolved.symbol,
      status: "confirmed",
      txHash: sent.hash,
      explorerUrl: "https://basescan.org/tx/" + sent.hash,
      confirmedAt: new Date().toISOString(),
      blockNumber: receipt.blockNumber,
      quote,
      builderCode: BUILDER_CODE || null,
      builderSuffixApplied: !!BUILDER_DATA_SUFFIX
    };

    if (operationId) {
      updateOnchainOperation(operationId, "confirmed", {
        txHash: tx.txHash,
        explorerUrl: tx.explorerUrl,
        executionMode: "ONCHAIN_REAL",
        note: "Transaction confirmed"
      });
    }

    return {
      tx,
      mode: "ONCHAIN_REAL",
      operation: readOnchainOperation(operationId)
    };
  } catch (err) {
    markFailed(err);
    throw err;
  }
}

function getContentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".css") return "text/css";
  if (ext === ".js") return "application/javascript";
  if (ext === ".json") return "application/json";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".woff2") return "font/woff2";
  return "text/html";
}

async function readRawBody(req, maxBytes = BODY_MAX_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > maxBytes) {
      const err = new Error("payload_too_large");
      err.status = 413;
      throw err;
    }
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function parseBody(req) {
  const raw = (await readRawBody(req)).trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error("invalid_json");
    err.status = 400;
    throw err;
  }
}

function normalizeIp(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xff || req.socket?.remoteAddress || "unknown";
}

function isTradeEndpoint(pathname) {
  return pathname.startsWith("/api/trade/") || pathname.startsWith("/api/copytrade/") || pathname.startsWith("/api/onchain/");
}

function applyRateLimit(req, pathname) {
  if (!RATE_LIMIT_ENABLED || req.method === "OPTIONS") return null;
  if (!pathname.startsWith("/api/")) return null;

  const ip = normalizeIp(req);
  const scope = isTradeEndpoint(pathname) ? "trade" : "default";
  const max = scope === "trade" ? RATE_LIMIT_TRADE_MAX : RATE_LIMIT_MAX;
  const now = Date.now();
  const key = ip + ":" + scope;
  const current = db.rateLimits.get(key);

  if (!current || now - current.windowStart > RATE_LIMIT_WINDOW_MS) {
    db.rateLimits.set(key, { windowStart: now, count: 1 });
    return null;
  }

  current.count += 1;
  if (current.count > max) {
    const retryAfter = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - current.windowStart)) / 1000));
    return { retryAfter };
  }

  return null;
}

function isLocalSignerAllowed() {
  if (!ENABLE_REAL_ONCHAIN) return true;
  if (!SERVER_SIGNER_PRIVATE_KEY) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return ALLOW_LOCAL_SIGNER_IN_PROD;
}

async function parseVerifiedWebhookEvent(raw) {
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    const err = new Error("invalid_json");
    err.status = 400;
    throw err;
  }

  if (!FC_WEBHOOK_REQUIRE_VERIFY) {
    return {
      verified: false,
      eventType: payload?.event || payload?.type || null,
      fid: null,
      appFid: null,
      event: payload
    };
  }

  try {
    const parsed = await parseWebhookEvent(payload, verifyAppKeyWithNeynar);
    return {
      verified: true,
      eventType: parsed?.event?.event || null,
      fid: parsed?.fid || null,
      appFid: parsed?.appFid || null,
      event: parsed?.event || null
    };
  } catch (error) {
    const msg = String(error?.message || "invalid_webhook_signature");
    const lower = msg.toLowerCase();

    if (lower.includes("neynar_api_key") || lower.includes("needs to be set")) {
      const err = new Error("webhook_verifier_not_configured");
      err.status = 503;
      throw err;
    }

    const err = new Error("invalid_webhook_signature");
    err.status = 401;
    throw err;
  }
}

function toDomain(input) {
  try {
    return new URL(String(input || "")).hostname;
  } catch {
    return String(input || "").trim().toLowerCase();
  }
}

function buildAuthDomainCandidates() {
  const out = new Set();
  const fromUrls = [APP_BASE_URL, process.env.FC_HOME_URL].map(toDomain).filter(Boolean);
  for (const d of fromUrls) out.add(d);
  for (const d of String(FC_AUTH_ALLOWED_DOMAINS || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean)) out.add(d);
  if (out.size === 0) out.add("baserush.app");
  return Array.from(out);
}

const AUTH_DOMAIN_CANDIDATES = buildAuthDomainCandidates();

function getBearerToken(req) {
  const raw = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
  if (!raw) return "";
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

async function verifyQuickAuthToken(token) {
  let lastError = null;
  const attempts = [];
  for (const domain of AUTH_DOMAIN_CANDIDATES) {
    try {
      const payload = await quickAuthClient.verifyJwt({ token, domain });
      return { payload, domain };
    } catch (err) {
      lastError = err;
      attempts.push({ domain, reason: String(err?.message || "verify_failed") });
    }
  }

  const err = new Error("invalid_quick_auth_token");
  err.status = 401;
  err.cause = lastError;
  err.details = attempts;
  throw err;
}

async function requireQuickAuth(req) {
  if (!FC_AUTH_REQUIRED) return { required: false, verified: false, payload: null, domain: null };
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("missing_auth_bearer");
    err.status = 401;
    throw err;
  }

  const verified = await verifyQuickAuthToken(token);
  return { required: true, verified: true, token, payload: verified.payload, domain: verified.domain };
}

function bindUserToQuickAuth(user, authResult) {
  if (!authResult?.verified || !authResult?.payload) return;
  const payload = authResult.payload;
  user.auth = {
    ...(user.auth || {}),
    provider: "farcaster",
    fid: Number(payload.sub || user.auth?.fid || 0) || null,
    address: payload.address || user.auth?.address || null,
    quickAuthVerified: true,
    quickAuthAud: payload.aud || null,
    quickAuthIss: payload.iss || null,
    quickAuthExp: payload.exp || null,
    verifiedAt: new Date().toISOString()
  };
}

function enforceUserQuickAuthBinding(userId, authResult) {
  if (!FC_AUTH_REQUIRED) return getOrCreateUser(userId);
  const user = getOrCreateUser(userId);
  bindUserToQuickAuth(user, authResult);

  const payloadFid = Number(authResult?.payload?.sub || 0) || null;
  const userFid = Number(user?.auth?.fid || 0) || null;
  if (userFid && payloadFid && userFid !== payloadFid) {
    const err = new Error("auth_user_mismatch");
    err.status = 403;
    throw err;
  }

  return user;
}


function findUserIdByFid(fid) {
  const target = Number(fid || 0) || 0;
  if (!target) return "";
  for (const [id, user] of db.users.entries()) {
    if (Number(user?.auth?.fid || 0) === target) return id;
  }
  return "";
}

async function enforceRequestAuth(req, userId) {
  if (!FC_AUTH_REQUIRED) return;
  const auth = await requireQuickAuth(req);
  enforceUserQuickAuthBinding(userId, auth);
}

function getAuthDebugSnapshot() {
  return {
    authRequired: FC_AUTH_REQUIRED,
    quickAuthOrigin: FC_QUICK_AUTH_ORIGIN,
    domainCandidates: AUTH_DOMAIN_CANDIDATES,
    appBaseUrl: APP_BASE_URL || null,
    fcHomeUrl: process.env.FC_HOME_URL || null
  };
}

async function serveStatic(file, res) {
  try {
    const buf = await readFile(path.join(root, file));
    res.writeHead(200, { "Content-Type": getContentType(file) });
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3000");
  const pathNoSlash = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");

  const limited = applyRateLimit(req, url.pathname);
  if (limited) {
    res.setHeader("Retry-After", String(limited.retryAfter));
    return json(res, 429, { ok: false, error: "rate_limited", retryAfter: limited.retryAfter });
  }

  if (req.method === "GET" && url.pathname === "/.well-known/farcaster.json") {
    const dynamicManifest = buildFarcasterManifestFromEnv();
    if (dynamicManifest) return json(res, 200, dynamicManifest);
    if (await serveStatic(".well-known/farcaster.json", res)) return;
    res.writeHead(404);
    res.end("not found");
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/farcaster/webhook") {
    try {
      const raw = await readRawBody(req);
      const parsed = await parseVerifiedWebhookEvent(raw);
      return json(res, 200, {
        ok: true,
        received: true,
        verified: parsed.verified,
        eventType: parsed.eventType,
        fid: parsed.fid,
        appFid: parsed.appFid
      });
    } catch (err) {
      return json(res, httpStatusFromError(err), { ok: false, error: err.message || "webhook_failed" });
    }
  }
  if (req.method === "GET" && url.pathname === "/api/auth/status") {
    const requestedUserId = String(url.searchParams.get("userId") || "").trim();
    const token = getBearerToken(req);

    if (!token) {
      return json(res, 200, {
        ok: true,
        authVerified: false,
        userId: requestedUserId || null,
        reason: "missing_auth_bearer"
      });
    }

    try {
      const verified = await verifyQuickAuthToken(token);
      const payload = verified.payload || {};
      const fid = Number(payload.sub || 0) || null;
      const address = payload.address || null;

      const matchedUserId = requestedUserId || findUserIdByFid(fid) || (fid ? `fc_${fid}` : "");
      let user = null;
      if (matchedUserId) {
        user = getOrCreateUser(matchedUserId);
        bindUserToQuickAuth(user, { verified: true, payload });
      }

      return json(res, 200, {
        ok: true,
        authVerified: true,
        userId: matchedUserId || null,
        fid,
        address,
        provider: "farcaster",
        domain: verified.domain || null,
        quickAuthExp: payload.exp || null
      });
    } catch (err) {
      const out = { ok: false, error: err.message || "invalid_quick_auth_token" };
      if (FC_AUTH_DEBUG) {
        out.debug = {
          ...getAuthDebugSnapshot(),
          verifyAttempts: Array.isArray(err?.details) ? err.details : []
        };
      }
      return json(res, httpStatusFromError(err), out);
    }
  }
  if (req.method === "POST" && ["/api/auth/login", "/api/auth/farcaster/login", "/api/auth/base/login"].includes(url.pathname)) {
    const body = await parseBody(req);
    const fromPath = url.pathname.includes("/farcaster/") ? "farcaster" : url.pathname.includes("/base/") ? "base" : null;
    const provider = (body.provider || fromPath || "farcaster").toLowerCase();
    if (!["farcaster", "base"].includes(provider)) return json(res, 400, { ok: false, error: "invalid_provider" });

    let authResult = { required: false, verified: false, payload: null, domain: null };
    if (provider === "farcaster") {
      try {
        authResult = await requireQuickAuth(req);
      } catch (err) {
        const out = { ok: false, error: err.message || "auth_required" };
        if (FC_AUTH_DEBUG) {
          out.debug = {
            ...getAuthDebugSnapshot(),
            verifyAttempts: Array.isArray(err?.details) ? err.details : []
          };
        }
        return json(res, httpStatusFromError(err), out);
      }
    }

    const userId = body.userId || `${provider}_u_${Date.now()}`;
    const user = getOrCreateUser(userId);
    user.auth = {
      provider,
      fid: Number(body.fid || authResult?.payload?.sub || 0) || null,
      address: body.address || authResult?.payload?.address || null,
      username: body.username || null,
      quickAuthVerified: !!authResult.verified,
      quickAuthAud: authResult?.payload?.aud || null,
      quickAuthIss: authResult?.payload?.iss || null,
      quickAuthExp: authResult?.payload?.exp || null,
      verifiedAt: authResult.verified ? new Date().toISOString() : null
    };

    addNotification(userId, `${provider} login success`, { channel: provider, type: "auth" });
    return json(res, 200, { ok: true, user, session: { provider, userId, authVerified: !!authResult.verified } });
  }

  if (req.method === "POST" && url.pathname === "/api/balance/deposit-usdc") {
    const { userId, amount } = await parseBody(req);
    if (FC_AUTH_REQUIRED) {
      try {
        await enforceRequestAuth(req, userId);
      } catch (err) {
        return json(res, httpStatusFromError(err), { ok: false, error: err.message || "auth_required" });
      }
    }
    const user = getOrCreateUser(userId);
    user.wallet.usdc = rounded(user.wallet.usdc + Number(amount || 0), 2);
    addNotification(userId, `USDC deposit: ${amount}`, { channel: "base", type: "wallet" });
    const summary = buildWalletSummary(user);
    return json(res, 200, { ok: true, balance: summary.wallet.usdc, feesPaid: summary.wallet.feesPaid, wallet: summary.wallet });
  }

  if (req.method === "POST" && url.pathname === "/api/premium/activate") {
    const { userId, idempotencyKey } = await parseBody(req);
    if (!userId || !idempotencyKey) return json(res, 400, { ok: false, error: "userId and idempotencyKey required" });
    if (FC_AUTH_REQUIRED) {
      try {
        await enforceRequestAuth(req, userId);
      } catch (err) {
        return json(res, httpStatusFromError(err), { ok: false, error: err.message || "auth_required" });
      }
    }

    const idemKey = `premium:${idempotencyKey}`;
    const existing = db.idempotency.get(idemKey);
    if (existing) return json(res, 200, { ok: true, replay: true, ...existing });

    const user = getOrCreateUser(userId);
    const price = 20;
    if (user.wallet.usdc < price) return json(res, 402, { ok: false, error: "insufficient_usdc" });

    user.wallet.usdc = rounded(user.wallet.usdc - price, 2);
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    user.premium = { active: true, expiresAt: expiresAt.toISOString() };
    addNotification(userId, "Premium active: $20/month", { channel: "base", type: "premium" });

    const payload = { premium: user.premium, balance: user.wallet.usdc };
    db.idempotency.set(idemKey, payload);
    return json(res, 200, { ok: true, ...payload });
  }

  if (req.method === "GET" && url.pathname === "/api/premium/status") {
    const userId = url.searchParams.get("userId") || "guest";
    const user = getOrCreateUser(userId);
    ensurePremiumStatus(user);
    return json(res, 200, { ok: true, premium: user.premium });
  }

  if (req.method === "GET" && url.pathname === "/api/token/resolve") {
    const contract = (url.searchParams.get("contract") || "").trim().toLowerCase();
    const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();

    let token = null;
    if (contract) token = TOKEN_REGISTRY[contract] || null;
    if (!token && symbol) token = Object.values(TOKEN_REGISTRY).find((t) => t.symbol === symbol) || null;

    if (!token) return json(res, 404, { ok: false, error: "token_not_found" });
    return json(res, 200, { ok: true, token });
  }

  if (req.method === "GET" && url.pathname === "/api/token/search") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const directory = buildTokenDirectory();
    const items = !q
      ? directory
      : directory.filter((t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.contract.toLowerCase().includes(q)
        );

    return json(res, 200, { ok: true, items });
  }

  if (req.method === "GET" && url.pathname === "/api/token/insights") {
    const tokenInput = url.searchParams.get("token") || "";
    const resolved = findTokenByContractOrSymbol(tokenInput);
    if (!resolved) return json(res, 404, { ok: false, error: "token_not_found" });

    const profile = buildTokenDirectory().find((t) => t.symbol === resolved.symbol) || {
      ...resolved,
      price: tokenPrices[resolved.symbol] || 0,
      verified: false,
      tradable: true,
      mcap: "-",
      volume24h: "-",
      change24h: 0,
      spark: "0,20 16,20 32,20 48,20 64,20 80,20 96,20 112,20"
    };

    const holders = buildTokenLeaderboard(resolved.symbol);
    return json(res, 200, { ok: true, token: profile, holders });
  }

  if (req.method === "GET" && url.pathname === "/api/trade/quote") {
    try {
      const tokenInput = url.searchParams.get("token") || "";
      const side = String(url.searchParams.get("side") || "BUY").toUpperCase();
      const amountUsdc = Number(url.searchParams.get("amountUsdc") || 0);
      const tokenAmount = Number(url.searchParams.get("tokenAmount") || 0);
      const sellPercent = Number(url.searchParams.get("sellPercent") || 0);
      const slippageBps = Number(url.searchParams.get("slippageBps") || 50);
      const userId = url.searchParams.get("userId") || "guest";

      const resolved = findTokenByContractOrSymbol(tokenInput);
      if (!resolved) return json(res, 404, { ok: false, error: "token_not_found" });

      const user = getOrCreateUser(userId);
      const resolvedInputs = resolveTradeInputs(user, { token: resolved.symbol, side, amountUsdc, tokenAmount, sellPercent });
      const quote = makeTradeQuote({
        user,
        token: resolved.symbol,
        side: resolvedInputs.side,
        amountUsdc: resolvedInputs.amountUsdc,
        tokenAmount: resolvedInputs.tokenAmount,
        slippageBps
      });

      return json(res, 200, { ok: true, quote });
    } catch (err) {
      return json(res, httpStatusFromError(err), { ok: false, error: err.message || "quote_failed" });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/copytrade/settings") {
    const userId = url.searchParams.get("userId") || "guest";
    const settings = getOrCreateCopySettings(userId);
    return json(res, 200, { ok: true, userId, settings });
  }

  if (req.method === "POST" && url.pathname === "/api/copytrade/settings") {
    const { userId, enabled, ratio, maxUsdcPerTrade, slippageBps } = await parseBody(req);
    if (!userId) return json(res, 400, { ok: false, error: "userId required" });
    if (FC_AUTH_REQUIRED) {
      try {
        await enforceRequestAuth(req, userId);
      } catch (err) {
        return json(res, httpStatusFromError(err), { ok: false, error: err.message || "auth_required" });
      }
    }

    const settings = getOrCreateCopySettings(userId);
    if (typeof enabled === "boolean") settings.enabled = enabled;
    if (ratio !== undefined) settings.ratio = Math.max(0.01, Math.min(1, Number(ratio || 0.2)));
    if (maxUsdcPerTrade !== undefined) settings.maxUsdcPerTrade = Math.max(1, rounded(Number(maxUsdcPerTrade || 1), 2));
    if (slippageBps !== undefined) settings.slippageBps = Math.max(10, Math.min(2000, Number(slippageBps || 100)));
    settings.updatedAt = new Date().toISOString();

    return json(res, 200, { ok: true, userId, settings });
  }

  if (req.method === "GET" && url.pathname === "/api/copytrade/status") {
    const userId = url.searchParams.get("userId") || "guest";
    const user = getOrCreateUser(userId);
    const premiumActive = ensurePremiumStatus(user);
    const settings = getOrCreateCopySettings(userId);
    return json(res, 200, {
      ok: true,
      copyTrade: {
        premiumRequired: true,
        allowed: premiumActive && settings.enabled,
        premiumActive,
        settings
      }
    });
  }

  if (req.method === "POST" && url.pathname === "/api/trade/execute") {
    const { userId, token, side = "BUY", amountUsdc, tokenAmount, sellPercent, idempotencyKey } = await parseBody(req);
    if (!userId || !token || !idempotencyKey) return json(res, 400, { ok: false, error: "userId, token, idempotencyKey required" });
    if (FC_AUTH_REQUIRED) {
      try {
        await enforceRequestAuth(req, userId);
      } catch (err) {
        return json(res, httpStatusFromError(err), { ok: false, error: err.message || "auth_required" });
      }
    }

    const idemKey = `trade:${idempotencyKey}`;
    const existing = db.idempotency.get(idemKey);
    if (existing) return json(res, 200, { ok: true, replay: true, ...existing });

    try {
      const user = getOrCreateUser(userId);
      const resolvedInputs = resolveTradeInputs(user, { token, side, amountUsdc, tokenAmount, sellPercent });
      const out = executeTradeForUser(user, {
        token,
        side: resolvedInputs.side,
        amountUsdc: resolvedInputs.amountUsdc,
        tokenAmount: resolvedInputs.tokenAmount,
        sellPercent,
        executionMode: "SIMULATED"
      });

      addNotification(userId, `Trade executed: ${String(side).toUpperCase()} ${String(token).toUpperCase()}`, { channel: "base", type: "wallet" });

      const payload = {
        balance: out.summary.wallet.usdc,
        feesPaid: out.summary.wallet.feesPaid,
        realizedPnl: out.summary.wallet.realizedPnl,
        unrealizedPnl: out.summary.wallet.unrealizedPnl,
        totalPnl: out.summary.wallet.totalPnl,
        holdings: out.summary.holdings,
        positions: out.summary.positions,
        trade: out.trade
      };

      db.idempotency.set(idemKey, payload);
      return json(res, 200, { ok: true, ...payload });
    } catch (err) {
      return json(res, httpStatusFromError(err), { ok: false, error: err.message || "trade_failed" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/trade/execute-onchain") {
    if (!isLocalSignerAllowed()) return json(res, 503, { ok: false, error: "local_signer_blocked_in_production" });
    const { userId, token, side = "BUY", amountUsdc, tokenAmount, sellPercent, idempotencyKey, onchain = {} } = await parseBody(req);
    if (!userId || !token || !idempotencyKey) return json(res, 400, { ok: false, error: "userId, token, idempotencyKey required" });
    if (FC_AUTH_REQUIRED) {
      try {
        await enforceRequestAuth(req, userId);
      } catch (err) {
        return json(res, httpStatusFromError(err), { ok: false, error: err.message || "auth_required" });
      }
    }

    const idemKey = `onchain_trade:${idempotencyKey}`;
    const existing = db.idempotency.get(idemKey);
    if (existing) return json(res, 200, { ok: true, replay: true, ...existing });

    try {
      const user = getOrCreateUser(userId);
      const resolvedInputs = resolveTradeInputs(user, { token, side, amountUsdc, tokenAmount, sellPercent });
      const operation = createOnchainOperation({
        kind: "trade",
        userId,
        token,
        side: resolvedInputs.side,
        idempotencyKey
      });

      const onchainExec = await sendTradeExecutorTx({
        user,
        token,
        side: resolvedInputs.side,
        amountUsdc: resolvedInputs.amountUsdc,
        tokenAmount: resolvedInputs.tokenAmount,
        idempotencyKey,
        operationId: operation.operationId,
        onchain
      });
      const tx = onchainExec.tx;
      const txLifecycle = onchainExec.operation || readOnchainOperation(operation.operationId);

      const out = executeTradeForUser(user, {
        token,
        side: resolvedInputs.side,
        amountUsdc: resolvedInputs.amountUsdc,
        tokenAmount: resolvedInputs.tokenAmount,
        sellPercent,
        executionMode: onchainExec.mode,
        onchainTx: tx,
        onchainOperation: txLifecycle
      });

      db.onchainTxs.set(tx.txHash, {
        ...tx,
        userId,
        tradeId: out.trade.id,
        operationId: txLifecycle?.operationId || operation.operationId,
        copyFrom: null
      });

      addNotification(userId, `Onchain trade confirmed: ${String(side).toUpperCase()} ${String(token).toUpperCase()}`, {
        channel: "base",
        type: "wallet"
      });

      const payload = {
        balance: out.summary.wallet.usdc,
        feesPaid: out.summary.wallet.feesPaid,
        realizedPnl: out.summary.wallet.realizedPnl,
        unrealizedPnl: out.summary.wallet.unrealizedPnl,
        totalPnl: out.summary.wallet.totalPnl,
        holdings: out.summary.holdings,
        positions: out.summary.positions,
        trade: out.trade,
        tx,
        txLifecycle
      };

      db.idempotency.set(idemKey, payload);
      return json(res, 200, { ok: true, ...payload });
    } catch (err) {
      return json(res, httpStatusFromError(err), { ok: false, error: err.message || "onchain_trade_failed" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/copytrade/execute-onchain") {
    if (!isLocalSignerAllowed()) return json(res, 503, { ok: false, error: "local_signer_blocked_in_production" });
    const {
      followerUserId,
      leaderUserId,
      token,
      side = "BUY",
      amountUsdc,
      tokenAmount,
      copyRatio = 0.2,
      idempotencyKey,
      onchain = {}
    } = await parseBody(req);

    if (!followerUserId || !leaderUserId || !token || !idempotencyKey) {
      return json(res, 400, { ok: false, error: "followerUserId, leaderUserId, token, idempotencyKey required" });
    }
    if (FC_AUTH_REQUIRED) {
      try {
        await enforceRequestAuth(req, followerUserId);
      } catch (err) {
        return json(res, httpStatusFromError(err), { ok: false, error: err.message || "auth_required" });
      }
    }

    const idemKey = `onchain_copy:${idempotencyKey}`;
    const existing = db.idempotency.get(idemKey);
    if (existing) return json(res, 200, { ok: true, replay: true, ...existing });

    try {
      const follower = getOrCreateUser(followerUserId);
      ensurePremiumStatus(follower);
      if (!follower.premium.active) return json(res, 403, { ok: false, error: "premium_required" });

      const settings = getOrCreateCopySettings(followerUserId);
      if (!settings.enabled) return json(res, 403, { ok: false, error: "copytrade_disabled" });

      const ratio = Math.max(0.01, Math.min(1, Number(copyRatio || settings.ratio || 0.2)));
      const normalizedSide = String(side).toUpperCase();

      const buySeedUsdc = Number(amountUsdc || settings.maxUsdcPerTrade || 0);
      const cappedBuyUsdc = Math.min(buySeedUsdc, Number(settings.maxUsdcPerTrade || buySeedUsdc));
      const plannedAmountUsdc = normalizedSide === "BUY" ? rounded(cappedBuyUsdc * ratio, 2) : null;
      const plannedTokenAmount = normalizedSide === "SELL"
        ? rounded((Number(tokenAmount || 0) > 0 ? Number(tokenAmount || 0) : Number(amountUsdc || 0) / (tokenPrices[String(token).toUpperCase()] || 1)) * ratio, 6)
        : null;

      const operation = createOnchainOperation({
        kind: "copytrade",
        userId: followerUserId,
        leaderUserId,
        token,
        side: normalizedSide,
        idempotencyKey
      });

      const onchainExec = await sendTradeExecutorTx({
        user: follower,
        token,
        side: normalizedSide,
        amountUsdc: plannedAmountUsdc,
        tokenAmount: plannedTokenAmount,
        idempotencyKey,
        operationId: operation.operationId,
        onchain: {
          ...onchain,
          slippageBps: onchain.slippageBps || settings.slippageBps
        }
      });
      const tx = onchainExec.tx;
      const txLifecycle = onchainExec.operation || readOnchainOperation(operation.operationId);

      const out = executeTradeForUser(follower, {
        token,
        side: normalizedSide,
        amountUsdc: plannedAmountUsdc,
        tokenAmount: plannedTokenAmount,
        executionMode: onchainExec.mode,
        onchainTx: tx,
        onchainOperation: txLifecycle,
        copyFrom: leaderUserId
      });

      db.onchainTxs.set(tx.txHash, {
        ...tx,
        userId: followerUserId,
        leaderUserId,
        tradeId: out.trade.id,
        operationId: txLifecycle?.operationId || operation.operationId,
        copyFrom: leaderUserId
      });

      addNotification(followerUserId, `Copy trade executed from @${leaderUserId}`, { channel: "farcaster", type: "social" });

      const payload = {
        followerUserId,
        leaderUserId,
        copyPlan: {
          side: normalizedSide,
          ratio,
          amountUsdc: plannedAmountUsdc,
          tokenAmount: plannedTokenAmount,
          slippageBps: onchain.slippageBps || settings.slippageBps
        },
        balance: out.summary.wallet.usdc,
        feesPaid: out.summary.wallet.feesPaid,
        realizedPnl: out.summary.wallet.realizedPnl,
        unrealizedPnl: out.summary.wallet.unrealizedPnl,
        totalPnl: out.summary.wallet.totalPnl,
        holdings: out.summary.holdings,
        positions: out.summary.positions,
        trade: out.trade,
        tx,
        txLifecycle
      };

      db.idempotency.set(idemKey, payload);
      return json(res, 200, { ok: true, ...payload });
    } catch (err) {
      return json(res, httpStatusFromError(err), { ok: false, error: err.message || "copytrade_onchain_failed" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/onchain/smoke") {
    if (!isLocalSignerAllowed()) return json(res, 503, { ok: false, error: "local_signer_blocked_in_production" });
    const { userId = "guest", token = "ETH", side = "BUY", amountUsdc = 1, tokenAmount = 0, idempotencyKey = "smoke_" + Date.now(), onchain = {} } = await parseBody(req);
    if (FC_AUTH_REQUIRED) {
      try {
        await enforceRequestAuth(req, userId);
      } catch (err) {
        return json(res, httpStatusFromError(err), { ok: false, error: err.message || "auth_required" });
      }
    }
    try {
      const user = getOrCreateUser(userId);
      const exec = await sendTradeExecutorTx({
        user,
        token,
        side,
        amountUsdc,
        tokenAmount,
        idempotencyKey,
        onchain: { ...onchain, dryRun: true }
      });
      return json(res, 200, { ok: true, smoke: true, mode: exec.mode, tx: exec.tx });
    } catch (err) {
      return json(res, httpStatusFromError(err), { ok: false, error: err.message || "onchain_smoke_failed" });
    }
  }
  if (req.method === "GET" && url.pathname === "/api/miniapp/manifest-status") {
    const dynamicManifest = buildFarcasterManifestFromEnv();
    const dynamic = !!dynamicManifest;
    const frame = dynamicManifest?.frame || null;
    return json(res, 200, {
      ok: true,
      manifest: {
        source: dynamic ? "env" : "static_file",
        dynamicEnabled: dynamic,
        homeUrl: frame?.homeUrl || null,
        webhookUrl: frame?.webhookUrl || null,
        notificationMode: FC_NOTIFICATION_MODE,
        neynarWebhookConfigured: !!FC_NEYNAR_EVENT_WEBHOOK_URL,
        name: frame?.name || null
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/auth/diagnostics") {
    return json(res, 200, {
      ok: true,
      diagnostics: getAuthDebugSnapshot()
    });
  }

  if (req.method === "GET" && url.pathname === "/api/onchain/config") {
    return json(res, 200, {
      ok: true,
      onchain: {
        realEnabled: ENABLE_REAL_ONCHAIN,
        baseRpcConfigured: !!BASE_RPC_URL,
        executorConfigured: !!TRADE_EXECUTOR_ADDRESS,
        signerConfigured: !!SERVER_SIGNER_PRIVATE_KEY,
        signerStrategy: SERVER_SIGNER_PRIVATE_KEY ? "local_private_key" : "none",
        localSignerAllowed: isLocalSignerAllowed(),
        executorAddress: TRADE_EXECUTOR_ADDRESS || null,
        functionName: TRADE_EXECUTOR_FUNCTION,
        abiEntries: TRADE_EXECUTOR_ABI.length,
        argsTemplate: TRADE_EXECUTOR_ARGS_TEMPLATE,
        builderCode: BUILDER_CODE || null,
        builderSuffixConfigured: !!BUILDER_DATA_SUFFIX
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/onchain/tx") {
    const txHash = String(url.searchParams.get("txHash") || "").trim();
    if (!txHash) return json(res, 400, { ok: false, error: "txHash required" });
    const tx = db.onchainTxs.get(txHash);
    if (!tx) return json(res, 404, { ok: false, error: "tx_not_found" });
    const operation = tx.operationId ? readOnchainOperation(tx.operationId) : null;
    return json(res, 200, { ok: true, tx: toPublicOnchainTx(tx), operation: toPublicOnchainOperation(operation) });
  }

  if (req.method === "GET" && url.pathname === "/api/onchain/operation") {
    const operationId = String(url.searchParams.get("operationId") || "").trim();
    const txHash = String(url.searchParams.get("txHash") || "").trim();

    let operation = null;
    if (operationId) operation = readOnchainOperation(operationId);

    if (!operation && txHash) {
      const tx = db.onchainTxs.get(txHash);
      if (tx?.operationId) operation = readOnchainOperation(tx.operationId);
    }

    if (!operation) return json(res, 404, { ok: false, error: "operation_not_found" });
    return json(res, 200, { ok: true, operation: toPublicOnchainOperation(operation) });
  }

  if (req.method === "GET" && url.pathname === "/api/wallet/summary") {
    const userId = url.searchParams.get("userId") || "guest";
    const user = getOrCreateUser(userId);
    const summary = buildWalletSummary(user);
    return json(res, 200, { ok: true, ...summary });
  }

  if (req.method === "POST" && url.pathname === "/api/follow") {
    const { userId, traderId } = await parseBody(req);
    if (!db.follows.has(userId)) db.follows.set(userId, new Set());
    const set = db.follows.get(userId);
    if (set.has(traderId)) set.delete(traderId);
    else set.add(traderId);
    addNotification(userId, `Follow list updated: ${traderId}`, { channel: "farcaster", type: "social" });
    return json(res, 200, { ok: true, following: [...set] });
  }

  if (req.method === "GET" && url.pathname === "/api/notifications/inbox") {
    const userId = url.searchParams.get("userId") || "guest";
    return json(res, 200, { ok: true, items: db.notifications.get(userId) || [] });
  }

  if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
    if (await serveStatic(`web-dist/${pathNoSlash}`, res)) return;
  }

  if (req.method === "GET" && ["/", "/index.html"].includes(url.pathname)) {
    if (await serveStatic("web-dist/index.html", res)) return;
    if (await serveStatic("index.html", res)) return;
  }

  if (req.method === "GET" && ["/app.css", "/app.js"].includes(url.pathname)) {
    if (await serveStatic(pathNoSlash, res)) return;
  }

  if (req.method === "GET" && !url.pathname.startsWith("/api/")) {
    if (await serveStatic("web-dist/index.html", res)) return;
    if (await serveStatic("index.html", res)) return;
  }

  res.writeHead(404);
  res.end("not found");
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => {
    console.log(`server running at http://localhost:${port}`);
  });
}

export { server, db, getOrCreateUser };



