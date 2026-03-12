import "dotenv/config";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const db = {
  users: new Map(),
  follows: new Map(),
  notifications: new Map(),
  idempotency: new Map(),
  onchainTxs: new Map(),
  copySettings: new Map()
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
  const splashImageUrl = process.env.FC_SPLASH_IMAGE_URL || (root + "/splash.png");
  const webhookUrl = process.env.FC_WEBHOOK_URL || (root + "/api/farcaster/webhook");

  return {
    accountAssociation: {
      header: hasAssociation ? header : "REPLACE_WITH_HEADER",
      payload: hasAssociation ? payload : "REPLACE_WITH_PAYLOAD",
      signature: hasAssociation ? signature : "REPLACE_WITH_SIGNATURE"
    },
    frame: {
      version: FC_FRAME_VERSION,
      name: FC_FRAME_NAME,
      homeUrl,
      iconUrl,
      imageUrl,
      buttonTitle: FC_BUTTON_TITLE,
      splashImageUrl,
      splashBackgroundColor: FC_SPLASH_BG,
      webhookUrl
    }
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

function executeTradeForUser(user, { token, side = "BUY", amountUsdc, tokenAmount, sellPercent, executionMode = "SIMULATED", onchainTx = null, copyFrom = null }) {
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

async function sendTradeExecutorTx({ user, token, side, amountUsdc, tokenAmount, idempotencyKey, onchain = {} }) {
  if (!ENABLE_REAL_ONCHAIN || !BASE_RPC_URL || !TRADE_EXECUTOR_ADDRESS || !SERVER_SIGNER_PRIVATE_KEY) {
    return {
      tx: buildMockTx(String(token).toUpperCase()),
      mode: "ONCHAIN_MOCK"
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
    data,
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
    return {
      tx: {
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
          returnData: callOut
        }
      },
      quote,
      mode: "ONCHAIN_SIMULATED"
    };
  }

  const sent = await signer.sendTransaction(txReq);
  const receipt = await sent.wait(1);
  if (!receipt || receipt.status !== 1) {
    const err = new Error("onchain_tx_failed");
    err.code = 502;
    throw err;
  }

  return {
    tx: {
      chainId: 8453,
      network: "base",
      token: resolved.symbol,
      status: "confirmed",
      txHash: sent.hash,
      explorerUrl: "https://basescan.org/tx/" + sent.hash,
      confirmedAt: new Date().toISOString(),
      blockNumber: receipt.blockNumber,
      quote
    },
    mode: "ONCHAIN_REAL"
  };
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

async function parseBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  return JSON.parse(raw);
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

  if (req.method === "GET" && url.pathname === "/.well-known/farcaster.json") {
    const dynamicManifest = buildFarcasterManifestFromEnv();
    if (dynamicManifest) return json(res, 200, dynamicManifest);
    if (await serveStatic(".well-known/farcaster.json", res)) return;
    res.writeHead(404);
    res.end("not found");
    return;
  }

  if (req.method === "POST" && ["/api/auth/login", "/api/auth/farcaster/login", "/api/auth/base/login"].includes(url.pathname)) {
    const body = await parseBody(req);
    const fromPath = url.pathname.includes("/farcaster/") ? "farcaster" : url.pathname.includes("/base/") ? "base" : null;
    const provider = (body.provider || fromPath || "farcaster").toLowerCase();
    if (!["farcaster", "base"].includes(provider)) return json(res, 400, { ok: false, error: "invalid_provider" });

    const userId = body.userId || `${provider}_u_${Date.now()}`;
    const user = getOrCreateUser(userId);
    user.auth = {
      provider,
      fid: body.fid || null,
      address: body.address || null,
      username: body.username || null
    };

    addNotification(userId, `${provider} login success`, { channel: provider, type: "auth" });
    return json(res, 200, { ok: true, user, session: { provider, userId } });
  }

  if (req.method === "POST" && url.pathname === "/api/balance/deposit-usdc") {
    const { userId, amount } = await parseBody(req);
    const user = getOrCreateUser(userId);
    user.wallet.usdc = rounded(user.wallet.usdc + Number(amount || 0), 2);
    addNotification(userId, `USDC deposit: ${amount}`, { channel: "base", type: "wallet" });
    const summary = buildWalletSummary(user);
    return json(res, 200, { ok: true, balance: summary.wallet.usdc, feesPaid: summary.wallet.feesPaid, wallet: summary.wallet });
  }

  if (req.method === "POST" && url.pathname === "/api/premium/activate") {
    const { userId, idempotencyKey } = await parseBody(req);
    if (!userId || !idempotencyKey) return json(res, 400, { ok: false, error: "userId and idempotencyKey required" });

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
    const { userId, token, side = "BUY", amountUsdc, tokenAmount, sellPercent, idempotencyKey, onchain = {} } = await parseBody(req);
    if (!userId || !token || !idempotencyKey) return json(res, 400, { ok: false, error: "userId, token, idempotencyKey required" });

    const idemKey = `onchain_trade:${idempotencyKey}`;
    const existing = db.idempotency.get(idemKey);
    if (existing) return json(res, 200, { ok: true, replay: true, ...existing });

    try {
      const user = getOrCreateUser(userId);
      const resolvedInputs = resolveTradeInputs(user, { token, side, amountUsdc, tokenAmount, sellPercent });
      const onchainExec = await sendTradeExecutorTx({
        user,
        token,
        side: resolvedInputs.side,
        amountUsdc: resolvedInputs.amountUsdc,
        tokenAmount: resolvedInputs.tokenAmount,
        idempotencyKey,
        onchain
      });
      const tx = onchainExec.tx;
      const out = executeTradeForUser(user, {
        token,
        side: resolvedInputs.side,
        amountUsdc: resolvedInputs.amountUsdc,
        tokenAmount: resolvedInputs.tokenAmount,
        sellPercent,
        executionMode: onchainExec.mode,
        onchainTx: tx
      });

      db.onchainTxs.set(tx.txHash, {
        ...tx,
        userId,
        tradeId: out.trade.id,
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
        tx
      };

      db.idempotency.set(idemKey, payload);
      return json(res, 200, { ok: true, ...payload });
    } catch (err) {
      return json(res, httpStatusFromError(err), { ok: false, error: err.message || "onchain_trade_failed" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/copytrade/execute-onchain") {
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

      const onchainExec = await sendTradeExecutorTx({
        user: follower,
        token,
        side: normalizedSide,
        amountUsdc: plannedAmountUsdc,
        tokenAmount: plannedTokenAmount,
        idempotencyKey,
        onchain: {
          ...onchain,
          slippageBps: onchain.slippageBps || settings.slippageBps
        }
      });
      const tx = onchainExec.tx;
      const out = executeTradeForUser(follower, {
        token,
        side: normalizedSide,
        amountUsdc: plannedAmountUsdc,
        tokenAmount: plannedTokenAmount,
        executionMode: onchainExec.mode,
        onchainTx: tx,
        copyFrom: leaderUserId
      });

      db.onchainTxs.set(tx.txHash, {
        ...tx,
        userId: followerUserId,
        leaderUserId,
        tradeId: out.trade.id,
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
        tx
      };

      db.idempotency.set(idemKey, payload);
      return json(res, 200, { ok: true, ...payload });
    } catch (err) {
      return json(res, httpStatusFromError(err), { ok: false, error: err.message || "copytrade_onchain_failed" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/onchain/smoke") {
    const { userId = "guest", token = "ETH", side = "BUY", amountUsdc = 1, tokenAmount = 0, idempotencyKey = "smoke_" + Date.now(), onchain = {} } = await parseBody(req);
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
        name: frame?.name || null
      }
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
        executorAddress: TRADE_EXECUTOR_ADDRESS || null,
        functionName: TRADE_EXECUTOR_FUNCTION,
        abiEntries: TRADE_EXECUTOR_ABI.length,
        argsTemplate: TRADE_EXECUTOR_ARGS_TEMPLATE
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/onchain/tx") {
    const txHash = String(url.searchParams.get("txHash") || "").trim();
    if (!txHash) return json(res, 400, { ok: false, error: "txHash required" });
    const tx = db.onchainTxs.get(txHash);
    if (!tx) return json(res, 404, { ok: false, error: "tx_not_found" });
    return json(res, 200, { ok: true, tx });
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








