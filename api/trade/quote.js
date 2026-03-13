const TOKEN_REGISTRY = {
  ETH: {
    symbol: "ETH",
    contract: "0x4200000000000000000000000000000000000006",
  },
  USDC: {
    symbol: "USDC",
    contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  AERO: {
    symbol: "AERO",
    contract: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
  },
  DEGEN: {
    symbol: "DEGEN",
    contract: "0x4ed4e862860beef2b1f4e1a6f3c5fcb4f6f8f7f7",
  },
  BRETT: {
    symbol: "BRETT",
    contract: "0x532f27101965dd16442e59d40670faf5ebb142e4",
  },
};

const TOKEN_PRICES = {
  ETH: 3500,
  USDC: 1,
  AERO: 1.2,
  DEGEN: 0.015,
  BRETT: 0.14,
};

function rounded(n, decimals = 2) {
  return Number(Number(n || 0).toFixed(decimals));
}

function parsePositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function resolveToken(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const symbolKey = raw.toUpperCase();
  if (TOKEN_REGISTRY[symbolKey]) return TOKEN_REGISTRY[symbolKey];

  const lower = raw.toLowerCase();
  const byContract = Object.values(TOKEN_REGISTRY).find((t) => t.contract.toLowerCase() === lower);
  return byContract || null;
}

function buildQuote({ token, side, amountUsdc, tokenAmount, slippageBps }) {
  const normalizedSide = String(side || "BUY").toUpperCase();
  if (!["BUY", "SELL"].includes(normalizedSide)) {
    const err = new Error("unsupported_side");
    err.status = 400;
    throw err;
  }

  const price = Number(TOKEN_PRICES[token.symbol] || 0);
  if (!(price > 0)) {
    const err = new Error("unsupported_token");
    err.status = 400;
    throw err;
  }

  const feeBps = Number(process.env.DEFAULT_TRADE_FEE_BPS || 35);
  let inputUsdc = 0;

  if (normalizedSide === "BUY") {
    const requestedUsdc = parsePositiveNumber(amountUsdc);
    const requestedToken = parsePositiveNumber(tokenAmount);
    inputUsdc = requestedUsdc > 0 ? requestedUsdc : requestedToken > 0 ? requestedToken * price : 0;
    if (!(inputUsdc > 0)) {
      const err = new Error("invalid_amount");
      err.status = 400;
      throw err;
    }

    const feeUsdc = rounded((inputUsdc * feeBps) / 10000, 2);
    const netUsdc = rounded(inputUsdc - feeUsdc, 2);
    const outTokenAmount = rounded(netUsdc / price, 6);

    return {
      token: token.symbol,
      side: normalizedSide,
      price,
      feeBps,
      feeUsdc,
      inputUsdc: rounded(inputUsdc, 2),
      netUsdc,
      outTokenAmount,
      outUsdc: null,
      slippageBps: Number(slippageBps || 50),
      expiresInSec: 15,
    };
  }

  const requestedToken = parsePositiveNumber(tokenAmount);
  const requestedUsdc = parsePositiveNumber(amountUsdc);
  const sellTokenAmount = requestedToken > 0 ? requestedToken : requestedUsdc > 0 ? requestedUsdc / price : 0;
  if (!(sellTokenAmount > 0)) {
    const err = new Error("invalid_amount");
    err.status = 400;
    throw err;
  }

  inputUsdc = rounded(sellTokenAmount * price, 2);
  const feeUsdc = rounded((inputUsdc * feeBps) / 10000, 2);
  const netUsdc = rounded(inputUsdc - feeUsdc, 2);

  return {
    token: token.symbol,
    side: normalizedSide,
    price,
    feeBps,
    feeUsdc,
    inputUsdc,
    netUsdc,
    outTokenAmount: rounded(sellTokenAmount, 6),
    outUsdc: netUsdc,
    slippageBps: Number(slippageBps || 50),
    expiresInSec: 15,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const {
      token = "ETH",
      side = "BUY",
      amountUsdc = "0",
      tokenAmount = "0",
      slippageBps = "50",
    } = req.query || {};

    const resolvedToken = resolveToken(token);
    if (!resolvedToken) {
      res.status(404).json({ ok: false, error: "token_not_found" });
      return;
    }

    const quote = buildQuote({
      token: resolvedToken,
      side,
      amountUsdc,
      tokenAmount,
      slippageBps,
    });

    res.status(200).json({ ok: true, quote });
  } catch (err) {
    res.status(Number(err?.status || 500)).json({ ok: false, error: err?.message || "quote_failed" });
  }
}
