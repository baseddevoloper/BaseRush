import assert from "node:assert/strict";

const port = 3010;
const base = `http://localhost:${port}`;

async function post(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { res, body: await res.json() };
}

async function get(path) {
  const res = await fetch(`${base}${path}`);
  return { res, body: await res.json() };
}

async function run() {
  process.env.NODE_ENV = "test";
  const { server } = await import("../server/server.js");
  await new Promise((resolve) => server.listen(port, resolve));

  try {
    const resolvedByContract = await get("/api/token/resolve?contract=0x4200000000000000000000000000000000000006");
    assert.equal(resolvedByContract.res.status, 200);
    assert.equal(resolvedByContract.body.token.symbol, "ETH");

    const resolvedBySymbol = await get("/api/token/resolve?symbol=USDC");
    assert.equal(resolvedBySymbol.res.status, 200);
    assert.equal(resolvedBySymbol.body.token.symbol, "USDC");

    const search = await get("/api/token/search?q=eth");
    assert.equal(search.res.status, 200);
    assert.equal(Array.isArray(search.body.items), true);
    assert.equal(search.body.items.some((t) => t.symbol === "ETH"), true);

    const quote = await get("/api/trade/quote?token=ETH&side=BUY&amountUsdc=10&userId=u1");
    assert.equal(quote.res.status, 200);
    assert.equal(quote.body.quote.token, "ETH");
    assert.equal(typeof quote.body.quote.outTokenAmount, "number");

    const login = await post("/api/auth/login", { provider: "farcaster", userId: "u1", fid: 123, username: "you" });
    assert.equal(login.res.status, 200);
    assert.equal(login.body.session.provider, "farcaster");
    assert.equal(login.body.user.auth.fid, 123);

    await post("/api/balance/deposit-usdc", { userId: "u1", amount: 100 });

    const trade = await post("/api/trade/execute", {
      userId: "u1",
      token: "ETH",
      side: "BUY",
      amountUsdc: 10,
      idempotencyKey: "trade_1"
    });
    assert.equal(trade.res.status, 200);
    assert.equal(trade.body.trade.token, "ETH");
    assert.equal(typeof trade.body.feesPaid, "number");

    const tradeReplay = await post("/api/trade/execute", {
      userId: "u1",
      token: "ETH",
      side: "BUY",
      amountUsdc: 10,
      idempotencyKey: "trade_1"
    });
    assert.equal(tradeReplay.res.status, 200);
    assert.equal(tradeReplay.body.replay, true);

    const onchain = await post("/api/trade/execute-onchain", {
      userId: "u1",
      token: "ETH",
      side: "BUY",
      amountUsdc: 5,
      idempotencyKey: "onchain_1"
    });
    assert.equal(onchain.res.status, 200);
    assert.equal(onchain.body.trade.executionMode, "ONCHAIN_MOCK");
    assert.equal(typeof onchain.body.tx.txHash, "string");

    const txLookup = await get("/api/onchain/tx?txHash=" + encodeURIComponent(onchain.body.tx.txHash));
    assert.equal(txLookup.res.status, 200);
    assert.equal(txLookup.body.tx.txHash, onchain.body.tx.txHash);

    const onchainConfig = await get("/api/onchain/config");
    assert.equal(onchainConfig.res.status, 200);
    assert.equal(onchainConfig.body.ok, true);
    assert.equal(Array.isArray(onchainConfig.body.onchain.argsTemplate), true);

    const copySettings = await post("/api/copytrade/settings", {
      userId: "u4",
      enabled: true,
      ratio: 0.25,
      maxUsdcPerTrade: 12,
      slippageBps: 120
    });
    assert.equal(copySettings.res.status, 200);
    assert.equal(copySettings.body.settings.ratio, 0.25);
    assert.equal(copySettings.body.settings.maxUsdcPerTrade, 12);

    const copyStatus = await get("/api/copytrade/status?userId=u4");
    assert.equal(copyStatus.res.status, 200);
    assert.equal(copyStatus.body.copyTrade.settings.slippageBps, 120);

    const smoke = await post("/api/onchain/smoke", { userId: "u1", token: "ETH", side: "BUY", amountUsdc: 1 });
    assert.equal(smoke.res.status, 200);
    assert.equal(smoke.body.ok, true);

    const first = await post("/api/premium/activate", { userId: "u1", idempotencyKey: "idem_1" });
    assert.equal(first.res.status, 200);
    assert.equal(first.body.balance, 65);
    assert.equal(first.body.premium.active, true);

    const replay = await post("/api/premium/activate", { userId: "u1", idempotencyKey: "idem_1" });
    assert.equal(replay.res.status, 200);
    assert.equal(replay.body.replay, true);
    assert.equal(replay.body.balance, 65);

    await post("/api/balance/deposit-usdc", { userId: "u4", amount: 100 });
    await post("/api/premium/activate", { userId: "u4", idempotencyKey: "u4_premium" });

    const copyOnchain = await post("/api/copytrade/execute-onchain", {
      followerUserId: "u4",
      leaderUserId: "basewhale",
      token: "ETH",
      side: "BUY",
      amountUsdc: 20,
      idempotencyKey: "copy_1"
    });
    assert.equal(copyOnchain.res.status, 200);
    assert.equal(copyOnchain.body.trade.executionMode, "ONCHAIN_MOCK");
    assert.equal(copyOnchain.body.trade.copyFrom, "basewhale");

    const insuff = await post("/api/premium/activate", { userId: "u2", idempotencyKey: "idem_2" });
    assert.equal(insuff.res.status, 402);
    assert.equal(insuff.body.error, "insufficient_usdc");

    await post("/api/balance/deposit-usdc", { userId: "u3", amount: 50 });
    const buy = await post("/api/trade/execute", {
      userId: "u3",
      token: "AERO",
      side: "BUY",
      amountUsdc: 20,
      idempotencyKey: "u3_buy_1"
    });
    assert.equal(buy.res.status, 200);
    assert.equal(buy.body.trade.side, "BUY");

    const sellPercent = await post("/api/trade/execute", {
      userId: "u3",
      token: "AERO",
      side: "SELL",
      sellPercent: 50,
      idempotencyKey: "u3_sell_pct_1"
    });
    assert.equal(sellPercent.res.status, 200);
    assert.equal(sellPercent.body.trade.side, "SELL");
    assert.equal(sellPercent.body.trade.sellPercent, 50);

    const onchainSellPercent = await post("/api/trade/execute-onchain", {
      userId: "u3",
      token: "AERO",
      side: "SELL",
      sellPercent: 10,
      idempotencyKey: "u3_onchain_sell_pct_1"
    });
    assert.equal(onchainSellPercent.res.status, 200);
    assert.equal(onchainSellPercent.body.trade.side, "SELL");
    assert.equal(onchainSellPercent.body.trade.sellPercent, 10);

    const sell = await post("/api/trade/execute", {
      userId: "u3",
      token: "AERO",
      side: "SELL",
      tokenAmount: 5,
      idempotencyKey: "u3_sell_1"
    });
    assert.equal(sell.res.status, 200);
    assert.equal(sell.body.trade.side, "SELL");
    assert.equal(typeof sell.body.trade.realizedPnl, "number");

    const summary = await get("/api/wallet/summary?userId=u3");
    assert.equal(summary.res.status, 200);
    assert.equal(summary.body.ok, true);
    assert.equal(typeof summary.body.wallet.realizedPnl, "number");
    assert.equal(typeof summary.body.wallet.unrealizedPnl, "number");

    const insights = await get("/api/token/insights?token=ETH");
    assert.equal(insights.res.status, 200);
    assert.equal(insights.body.token.symbol, "ETH");
    assert.equal(Array.isArray(insights.body.holders), true);

    console.log("All tests passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});


