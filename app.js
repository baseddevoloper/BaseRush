const state = {
  activeTab: "feed",
  isConnected: false,
  selectedToken: "ETH",
  user: {
    handle: "@you",
    userId: null,
    provider: "guest",
    bio: "I hunt momentum on Base.",
    portfolio: 0,
    pnl24h: 0,
    followers: 1842,
    followingCount: 311,
    copiers: 126,
    scans: 9432,
    copyTradeEnabled: false,
    copyTradeAmount: 150
  },
  wallet: {
    usdc: 1200.0,
    feesPaid: 0,
    holdings: [
      { symbol: "ETH", amount: 0.43, pnl: 286.11 },
      { symbol: "DEGEN", amount: 5480, pnl: -73.8 },
      { symbol: "AERO", amount: 1320, pnl: 144.2 }
    ]
  },
  traders: [
    { id: "t1", handle: "@basewhale", token: "ETH", action: "BUY", size: 4200, pnl: 983.42, followers: 1221, following: false },
    { id: "t2", handle: "@dexsniper", token: "AERO", action: "SELL", size: 1650, pnl: -230.1, followers: 904, following: true },
    { id: "t3", handle: "@flowpilot", token: "DEGEN", action: "BUY", size: 980, pnl: 125.4, followers: 712, following: false },
    { id: "t4", handle: "@moontrace", token: "ETH", action: "SELL", size: 2890, pnl: 311.87, followers: 643, following: false },
    { id: "t5", handle: "@aeroking", token: "AERO", action: "BUY", size: 2200, pnl: 411.3, followers: 533, following: false },
    { id: "t6", handle: "@ethflow", token: "ETH", action: "BUY", size: 5100, pnl: 1204.21, followers: 1490, following: true },
    { id: "t7", handle: "@degenlab", token: "DEGEN", action: "BUY", size: 1400, pnl: -54.2, followers: 481, following: false }
  ],
  market: [
    { symbol: "ETH", change: 3.2 },
    { symbol: "AERO", change: -1.7 },
    { symbol: "DEGEN", change: 8.1 },
    { symbol: "USDC", change: 0.0 },
    { symbol: "BRETT", change: -4.9 }
  ],
  tokenInsights: {
    ETH: { appHolders: 4821, appHolderProfitRate: 62, appHolderAvgPnl: 1440, volume24h: 3400000, aiSignal: "Momentum is hot. Whales are stacking.", series: [100, 102, 103, 101, 105, 108, 110, 109, 111, 114, 116, 117] },
    AERO: { appHolders: 2189, appHolderProfitRate: 49, appHolderAvgPnl: 620, volume24h: 1760000, aiSignal: "Sell pressure is heavy. High-risk entry zone.", series: [100, 99, 101, 100, 98, 97, 99, 96, 97, 95, 94, 93] },
    DEGEN: { appHolders: 5912, appHolderProfitRate: 45, appHolderAvgPnl: 280, volume24h: 5120000, aiSignal: "Vol is wild. Fast flips everywhere.", series: [100, 104, 107, 103, 109, 115, 110, 117, 122, 119, 125, 128] },
    USDC: { appHolders: 11440, appHolderProfitRate: 100, appHolderAvgPnl: 0, volume24h: 14000000, aiSignal: "Stable core liquidity for the arena.", series: [100, 100, 100, 100.1, 99.9, 100, 100, 100, 100, 100.1, 99.9, 100] },
    BRETT: { appHolders: 3740, appHolderProfitRate: 37, appHolderAvgPnl: -120, volume24h: 2980000, aiSignal: "Hype is fading. Momentum is cooling.", series: [100, 98, 97, 95, 96, 94, 92, 90, 89, 88, 87, 85] }
  },
  tokenNotes: {
    ETH: [{ user: "@moontrace", text: "Breakout + strong inflow. I added.", ts: "9m" }],
    AERO: [],
    DEGEN: [],
    USDC: [],
    BRETT: []
  },  notifications: [
    { id: "n1", text: "@dexsniper closed AERO", ts: "2m ago" },
    { id: "n2", text: "ETH app-holder win rate hit 62%", ts: "7m ago" }
  ],
  userFollowers: [
    { id: "f1", handle: "@malky", trades: 82, copied: true },
    { id: "f2", handle: "@rayflow", trades: 39, copied: false },
    { id: "f3", handle: "@solspirit", trades: 144, copied: true },
    { id: "f4", handle: "@basewizard", trades: 19, copied: false },
    { id: "f5", handle: "@defi_neo", trades: 57, copied: true }
  ],
  premium: { active: false, expiresAt: null, monthlyUsd: 20 },
  copiedTradeCount: 0,
  feeBps: 35,
  live: { mode: "sim", connected: false, transport: "simulator", wsUrl: null },
  tokenBoardFilter: "most_traded",
  tokenCatalog: [
    { symbol: "ETH", name: "Ethereum", verified: true, inApp: true },
    { symbol: "AERO", name: "Aerodrome", verified: true, inApp: true },
    { symbol: "DEGEN", name: "Degen", verified: true, inApp: true },
    { symbol: "BRETT", name: "Brett", verified: false, inApp: true },
    { symbol: "USDC", name: "USD Coin", verified: true, inApp: true },
    { symbol: "MOG", name: "Mog Coin", verified: false, inApp: false },
    { symbol: "PEPE", name: "Pepe", verified: false, inApp: false }
  ]
};

const screens = ["feed", "token", "wallet", "following", "notifications", "profile", "premium"];
const tokenPriceMap = { ETH: 3500, AERO: 1.2, DEGEN: 0.015, BRETT: 0.14, USDC: 1 };
async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || "request_failed");
  return data;
}

async function apiGet(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || "request_failed");
  return data;
}

function hasServerSession() {
  return state.isConnected && !!state.user.userId;
}

function applyWalletSummary(summary) {
  if (!summary) return;

  if (summary.wallet && typeof summary.wallet.usdc === "number") state.wallet.usdc = summary.wallet.usdc;
  if (summary.wallet && typeof summary.wallet.feesPaid === "number") state.wallet.feesPaid = summary.wallet.feesPaid;
  if (summary.wallet && typeof summary.wallet.realizedPnl === "number") state.wallet.realizedPnl = summary.wallet.realizedPnl;
  if (summary.wallet && typeof summary.wallet.unrealizedPnl === "number") state.wallet.unrealizedPnl = summary.wallet.unrealizedPnl;
  if (summary.wallet && typeof summary.wallet.totalPnl === "number") state.wallet.totalPnl = summary.wallet.totalPnl;

  if (summary.positions && typeof summary.positions === "object") {
    const next = Object.entries(summary.positions).map(([symbol, pos]) => ({
      symbol,
      amount: Number(pos.amount || 0),
      pnl: Number(pos.unrealizedPnl || 0),
      avgCost: Number(pos.avgCost || 0),
      markPrice: Number(pos.markPrice || tokenPriceMap[symbol] || 0)
    }));
    state.wallet.holdings = next;
    return;
  }

  if (summary.holdings && typeof summary.holdings === "object") {
    const next = Object.entries(summary.holdings).map(([symbol, amount]) => {
      const existing = state.wallet.holdings.find((h) => h.symbol === symbol);
      return { symbol, amount: Number(amount), pnl: existing ? existing.pnl : 0 };
    });
    state.wallet.holdings = next;
  }
}
async function syncAccountFromServer() {
  if (!hasServerSession()) return;

  const [walletSummary, premiumStatus, copyStatus] = await Promise.all([
    apiGet(`/api/wallet/summary?userId=${encodeURIComponent(state.user.userId)}`),
    apiGet(`/api/premium/status?userId=${encodeURIComponent(state.user.userId)}`),
    apiGet(`/api/copytrade/status?userId=${encodeURIComponent(state.user.userId)}`)
  ]);

  applyWalletSummary(walletSummary);
  if (premiumStatus && premiumStatus.premium) state.premium = { ...state.premium, ...premiumStatus.premium };
  if (copyStatus && copyStatus.copyTrade) {
    state.user.copyTradeEnabled = state.user.copyTradeEnabled && copyStatus.copyTrade.allowed;
  }
}

function money(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function setTab(tab) {
  state.activeTab = tab;
  screens.forEach((id) => {
    document.getElementById(`screen-${id}`).classList.toggle("hidden", id !== tab);
    document.getElementById(`tab-${id}`)?.classList.toggle("active", id === tab);
  });
}

function openToken(symbol) {
  state.selectedToken = symbol;
  renderTokenDetail();
  setTab("token");
}

function toSparklinePoints(series, width, height, pad) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const safeRange = max - min || 1;
  return series.map((v, i) => {
    const x = pad + (i * (width - pad * 2)) / (series.length - 1);
    const y = height - pad - ((v - min) * (height - pad * 2)) / safeRange;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function renderHomeProfile() {
  const totalHoldingsPnl = state.wallet.holdings.reduce((acc, h) => acc + h.pnl, 0);
  state.user.portfolio = state.wallet.usdc + totalHoldingsPnl + 4200;
  state.user.pnl24h = totalHoldingsPnl;

  document.getElementById("homeProfile").innerHTML = `
    <div class="row">
      <div>
        <strong style="font-size:18px;">${state.user.handle}</strong>
        <p class="muted tiny">${state.user.bio}</p>
      </div>
      <button class="ghost" id="editBioBtn">Edit Bio</button>
    </div>
    <div class="row" style="margin-top:10px;">
      <div>
        <p class="muted tiny">Portfolio</p>
        <strong style="font-size:30px;">${money(state.user.portfolio)}</strong>
      </div>
      <div style="text-align:right;">
        <p class="muted tiny">24h</p>
        <strong class="${state.user.pnl24h >= 0 ? "profit" : "loss"}">${money(state.user.pnl24h)}</strong>
      </div>
    </div>
    <div class="profile-metrics" style="margin-top:10px;">
      <span class="mini-pill">${state.user.followers} followers</span>
      <span class="mini-pill">${state.user.copiers} copiers</span>
      <span class="mini-pill">${state.user.scans} scans</span>
      <span class="mini-pill ${state.user.copyTradeEnabled ? "on" : "off"}">${state.user.copyTradeEnabled ? "Copy ON" : "Copy OFF"}</span>
    </div>
  `;

  document.getElementById("editBioBtn").addEventListener("click", () => {
    const next = prompt("Update your bio", state.user.bio);
    if (next !== null) {
      state.user.bio = next.trim() || state.user.bio;
      renderHomeProfile();
      renderProfile();
    }
  });
}

function renderGlobalPulse() {
  const list = document.getElementById("globalPulseList");
  list.innerHTML = state.notifications.slice(0, 3).map((n) => `
    <article class="pulse-item">
      <div>${n.text}</div>
      <div class="muted tiny">${n.ts}</div>
    </article>
  `).join("");
}

function renderTokenBoard() {
  const marketMap = new Map(state.market.map((m) => [m.symbol, m.change]));
  const tradeStats = new Map();

  state.traders.forEach((t) => {
    if (!tradeStats.has(t.token)) tradeStats.set(t.token, { count: 0, volume: 0 });
    const s = tradeStats.get(t.token);
    s.count += 1;
    s.volume += t.size;
  });

  let rows = state.tokenCatalog.map((t) => {
    const stats = tradeStats.get(t.symbol) || { count: 0, volume: 0 };
    const insight = state.tokenInsights[t.symbol] || { appHolderProfitRate: 0 };
    return {
      ...t,
      trades: stats.count,
      volume: stats.volume,
      change: marketMap.get(t.symbol) ?? 0,
      appWinRate: insight.appHolderProfitRate || 0
    };
  });

  if (state.tokenBoardFilter === "verified") rows = rows.filter((r) => r.verified);
  if (state.tokenBoardFilter === "in_app") rows = rows.filter((r) => r.inApp);

  if (state.tokenBoardFilter === "most_traded") {
    rows.sort((a, b) => (b.trades - a.trades) || (b.volume - a.volume));
  } else {
    rows.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  const list = document.getElementById("tokenBoardList");
  list.innerHTML = rows.map((r) => `
    <article class="board-row" data-open-token="${r.symbol}">
      <div class="board-left">
        <div class="board-title">
          <strong>${r.symbol}</strong>
          ${r.verified ? '<span class="tag verified">Verified</span>' : ''}
          ${r.inApp ? '<span class="tag inapp">In-App</span>' : ''}
        </div>
        <div class="muted tiny board-desc">${r.name} - ${r.trades} trades - Win ${r.appWinRate}%</div>
      </div>
      <div class="board-right">
        <div class="${r.change >= 0 ? 'profit' : 'loss'}">${r.change >= 0 ? '+' : ''}${r.change.toFixed(2)}%</div>
        <div class="muted tiny">${money(r.volume)}</div>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-open-token]").forEach((el) => {
    el.addEventListener("click", () => openToken(el.dataset.openToken));
  });
}
function renderTopStats() {
  const totalPnl = state.traders.reduce((acc, t) => acc + t.pnl, 0);
  const active = state.traders.length;
  const following = state.traders.filter((t) => t.following).length;
  document.getElementById("topStats").innerHTML = `
    <div class="stat"><small>Live Traders</small><strong>${active}</strong></div>
    <div class="stat"><small>Watching</small><strong>${following}</strong></div>
    <div class="stat"><small>Arena PnL</small><strong class="${totalPnl >= 0 ? "profit" : "loss"}">${money(totalPnl)}</strong></div>
  `;
}

function renderMarketTicker() {
  const el = document.getElementById("marketTicker");
  el.innerHTML = state.market.map((m) => `
    <button class="ticker-chip" data-open-token="${m.symbol}">
      <strong>${m.symbol}</strong>
      <span class="${m.change >= 0 ? "profit" : "loss"}">${m.change >= 0 ? "+" : ""}${m.change.toFixed(1)}%</span>
    </button>
  `).join("");

  el.querySelectorAll("[data-open-token]").forEach((btn) => {
    btn.addEventListener("click", () => openToken(btn.dataset.openToken));
  });
}

function renderFeed() {
  const feed = document.getElementById("feedList");
  feed.innerHTML = state.traders.map((t) => `
    <article class="feed-card">
      <div class="row">
        <div class="inline-left">
          <button class="token-avatar" data-open-token="${t.token}">${t.token.slice(0, 2)}</button>
          <strong>${t.handle}</strong>
        </div>
        <button class="action-badge" data-open-token="${t.token}">${t.action} ${t.token}</button>
      </div>
      <div class="row muted" style="margin-top:6px;">
        <span>Size: ${money(t.size)}</span>
        <span>${t.followers} followers</span>
      </div>
      <div class="row" style="margin-top:10px;">
        <strong class="${t.pnl >= 0 ? "profit" : "loss"}">${money(t.pnl)}</strong>
        <div style="display:flex; gap:6px;">
          <button class="ghost" data-follow="${t.id}">${t.following ? "Unwatch" : "Watch"}</button>
          <button class="warn" data-copy="${t.id}">Copy</button>
        </div>
      </div>
    </article>
  `).join("");

  feed.querySelectorAll("[data-open-token]").forEach((btn) => {
    btn.addEventListener("click", () => openToken(btn.dataset.openToken));
  });

  feed.querySelectorAll("[data-follow]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const trader = state.traders.find((x) => x.id === btn.dataset.follow);
      trader.following = !trader.following;
      state.notifications.unshift({
        id: `n${Date.now()}`,
        text: `${trader.handle} ${trader.following ? "added to watchlist" : "removed from watchlist"}`,
        ts: "now"
      });
      renderAll();
    });
  });

  feed.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        if (hasServerSession()) {
          const status = await apiGet(`/api/copytrade/status?userId=${encodeURIComponent(state.user.userId)}`);
          if (status.copyTrade && !status.copyTrade.allowed) {
            state.premium.active = false;
          }
        }

        if (!state.premium.active) {
          setTab("premium");
          return;
        }

        state.copiedTradeCount += 1;
        const amount = state.user.copyTradeAmount;
        state.notifications.unshift({ id: `n${Date.now()}`, text: `Copy fired with ${money(amount)}`, ts: "now" });
        renderAll();
        setTab("notifications");
      } catch (err) {
        alert(`Copy trade check failed: ${err.message}`);
      }
    });
  });
}

function renderTokenDetail() {
  const symbol = state.selectedToken;
  const insight = state.tokenInsights[symbol] || {
    appHolders: 0,
    appHolderProfitRate: 0,
    appHolderAvgPnl: 0,
    volume24h: 0,
    aiSignal: "No pulse yet for this token.",
    series: [100, 100, 100, 100]
  };

  document.getElementById("tokenTitle").textContent = `${symbol} Room`;
  document.getElementById("tokenSubTitle").textContent = "Onchain + social momentum";
  document.getElementById("proInsightText").textContent = insight.aiSignal;

  document.getElementById("tokenHero").innerHTML = `
    <div class="stat-grid">
      <div class="stat"><small>App Holders</small><strong>${insight.appHolders.toLocaleString("en-US")}</strong></div>
      <div class="stat"><small>In Profit</small><strong class="profit">%${insight.appHolderProfitRate}</strong></div>
      <div class="stat"><small>Avg Holder PnL</small><strong class="${insight.appHolderAvgPnl >= 0 ? "profit" : "loss"}">${money(insight.appHolderAvgPnl)}</strong></div>
    </div>
  `;

  const first = insight.series[0];
  const last = insight.series[insight.series.length - 1];
  const deltaPct = ((last - first) / first) * 100;
  document.getElementById("sparklineDelta").textContent = `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(2)}%`;
  document.getElementById("sparklineDelta").className = `muted tiny ${deltaPct >= 0 ? "profit" : "loss"}`;

  const points = toSparklinePoints(insight.series, 320, 92, 8);
  document.getElementById("sparklineWrap").innerHTML = `
    <svg viewBox="0 0 320 92" class="sparkline" aria-label="${symbol} pulse">
      <polyline points="${points}" fill="none" stroke="${deltaPct >= 0 ? "#1ad57a" : "#ff596f"}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
  `;

  const tokenTraders = state.traders.filter((t) => t.token === symbol);
  document.getElementById("tokenTraderList").innerHTML = tokenTraders.length
    ? tokenTraders.map((t) => `
      <article class="feed-card">
        <div class="row"><strong>${t.handle}</strong><span class="action-badge">${t.action}</span></div>
        <div class="row muted"><span>Trade Size</span><span>${money(t.size)}</span></div>
        <div class="row"><span class="muted">Total PnL</span><strong class="${t.pnl >= 0 ? "profit" : "loss"}">${money(t.pnl)}</strong></div>
      </article>
    `).join("")
    : "<p class=\"muted\">No live traders here yet.</p>";

  const topBuyers = tokenTraders.filter((t) => t.action === "BUY").sort((a, b) => b.size - a.size).slice(0, 5);
  document.getElementById("topBuyerList").innerHTML = topBuyers.length
    ? topBuyers.map((t, idx) => `
      <article class="buyer-row">
        <div class="inline-left"><span class="rank">#${idx + 1}</span><strong>${t.handle}</strong></div>
        <div style="text-align:right;">
          <div>${money(t.size)}</div>
          <div class="muted tiny ${t.pnl >= 0 ? "profit" : "loss"}">${money(t.pnl)}</div>
        </div>
      </article>
    `).join("")
    : "<p class=\"muted\">No buyers found.</p>";

  const myHolding = state.wallet.holdings.find((h) => h.symbol === symbol && h.amount > 0);
  document.getElementById("tokenHolderList").innerHTML = `
    <article class="feed-card">
      <div class="row"><strong>App Holder Win Rate</strong><strong class="profit">%${insight.appHolderProfitRate}</strong></div>
      <p class="muted">Only holders inside this app are counted.</p>
    </article>
    <article class="feed-card">
      <div class="row"><strong>24h App Volume</strong><strong>${money(insight.volume24h)}</strong></div>
      <p class="muted">Based on app trades and copied actions.</p>
    </article>
    <article class="feed-card">
      <div class="row">
        <strong>${myHolding ? `You hold ${symbol}` : `Become ${symbol} Holder`}</strong>
        <span class="pill">${myHolding ? "Holder" : "Entry"}</span>
      </div>
      <p class="muted tiny">${myHolding ? "You can post, buy or sell from this holder module." : "Buy with USDC, then post your holder note."}</p>
      ${myHolding ? `<div class="row"><span class="muted">Unrealized PnL</span><strong class="${myHolding.pnl >= 0 ? "profit" : "loss"}">${money(myHolding.pnl)}</strong></div>` : ""}
      <textarea id="holderQuickNoteInput" placeholder="${myHolding ? "Write a holder note..." : "Write your note to post right after buy..."}"></textarea>
      <div style="display:grid; gap:8px; margin-top:8px;">
        <button class="${myHolding ? "primary" : "warn"} wide" id="${myHolding ? "holderPostNoteBtn" : "buyAndPostNoteBtn"}">
          ${myHolding ? "Post Note as Holder" : "Buy + Post Note"}
        </button>
        ${myHolding ? `
          <div class="sell-grid">
            <button class="ghost" data-sell-pct="10">Sell 10%</button>
            <button class="ghost" data-sell-pct="25">Sell 25%</button>
            <button class="ghost" data-sell-pct="50">Sell 50%</button>
            <button class="ghost" data-sell-pct="100">Sell 100%</button>
          </div>
          <div class="row">
            <input id="sellCustomInput" type="number" min="0.000001" step="0.000001" placeholder="Custom amount" />
            <button class="ghost" id="sellCustomBtn">Sell Custom</button>
          </div>
        ` : ""}
      </div>
    </article>
  `;

  const notes = state.tokenNotes[symbol] || [];
  document.getElementById("tokenNoteList").innerHTML = notes.length ? notes.map((n) => `
    <article class="pulse-item">
      <div><strong>${n.user}</strong></div>
      <div>${n.text}</div>
      <div class="muted tiny">${n.ts}</div>
    </article>
  `).join("") : "<p class=\"muted\">No notes yet. Be first.</p>";

  const holderPostBtn = document.getElementById("holderPostNoteBtn");
  if (holderPostBtn) {
    holderPostBtn.addEventListener("click", () => {
      const quickInput = document.getElementById("holderQuickNoteInput");
      const quickText = quickInput ? quickInput.value.trim() : "";
      if (quickText) {
        if (!state.tokenNotes[symbol]) state.tokenNotes[symbol] = [];
        state.tokenNotes[symbol].unshift({ user: state.user.handle, text: quickText, ts: "now" });
        state.notifications.unshift({ id: `n${Date.now()}`, text: `${state.user.handle} posted a holder note on ${symbol}`, ts: "now" });
        renderAll();
        setTab("token");
        return;
      }

      const input = document.getElementById("tokenNoteInput");
      if (!input.value.trim()) input.value = `I am holding ${symbol}. Watching momentum and app-holder flow.`;
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  const buyAndPostBtn = document.getElementById("buyAndPostNoteBtn");
  if (buyAndPostBtn) {
    buyAndPostBtn.addEventListener("click", async () => {
      const quickInput = document.getElementById("holderQuickNoteInput");
      const quickText = quickInput ? quickInput.value.trim() : "";
      const spend = 50;

      try {
        if (hasServerSession()) {
          const out = await apiPost("/api/trade/execute", {
            userId: state.user.userId,
            token: symbol,
            side: "BUY",
            amountUsdc: spend,
            idempotencyKey: `trade_${symbol}_${Date.now()}`
          });

          state.wallet.usdc = out.balance;
          if (typeof out.feesPaid === "number") state.wallet.feesPaid = out.feesPaid;
          if (typeof out.realizedPnl === "number") state.wallet.realizedPnl = out.realizedPnl;
          if (typeof out.unrealizedPnl === "number") state.wallet.unrealizedPnl = out.unrealizedPnl;
          if (typeof out.totalPnl === "number") state.wallet.totalPnl = out.totalPnl;

          if (out.positions && out.positions[symbol]) {
            const pos = out.positions[symbol];
            const current = state.wallet.holdings.find((h) => h.symbol === symbol);
            if (current) {
              current.amount = Number(pos.amount || 0);
              current.pnl = Number(pos.unrealizedPnl || 0);
              current.avgCost = Number(pos.avgCost || 0);
              current.markPrice = Number(pos.markPrice || tokenPriceMap[symbol] || 0);
            } else {
              state.wallet.holdings.push({
                symbol,
                amount: Number(pos.amount || 0),
                pnl: Number(pos.unrealizedPnl || 0),
                avgCost: Number(pos.avgCost || 0),
                markPrice: Number(pos.markPrice || tokenPriceMap[symbol] || 0)
              });
            }
          }
        } else {
          if (state.wallet.usdc < spend) {
            alert("Not enough USDC");
            return;
          }

          const fee = Number((spend * state.feeBps / 10000).toFixed(2));
          const net = spend - fee;
          state.wallet.usdc = Number((state.wallet.usdc - spend).toFixed(2));
          state.wallet.feesPaid = Number(((state.wallet.feesPaid || 0) + fee).toFixed(2));

          const current = state.wallet.holdings.find((h) => h.symbol === symbol);
          if (current) {
            current.amount = Number((current.amount + net / 100).toFixed(4));
          } else {
            state.wallet.holdings.push({ symbol, amount: Number((net / 100).toFixed(4)), pnl: 0 });
          }
        }

        state.notifications.unshift({ id: `n${Date.now()}`, text: `${state.user.handle} bought ${symbol} (${money(spend)})`, ts: "now" });
        if (!state.tokenNotes[symbol]) state.tokenNotes[symbol] = [];
        state.tokenNotes[symbol].unshift({
          user: state.user.handle,
          text: quickText || `Just bought ${symbol} with ${money(spend)}. My quick thesis:`,
          ts: "now"
        });
        state.notifications.unshift({ id: `n${Date.now()}1`, text: `${state.user.handle} posted a note on ${symbol}`, ts: "now" });
        renderAll();
        setTab("token");

        const input = document.getElementById("tokenNoteInput");
        if (input && !quickText) {
          input.value = `Just bought ${symbol} with ${money(spend)}. My quick thesis:`;
          input.focus();
          input.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } catch (err) {
        alert(`Buy failed: ${err.message}`);
      }
    });
  }

  const executeSell = async (qty) => {
    try {
      if (!myHolding || myHolding.amount <= 0) return;
      if (!qty || qty <= 0) return;
      if (qty > myHolding.amount) {
        alert("Not enough token amount");
        return;
      }

      if (!hasServerSession()) {
        alert("Connect mini app to execute SELL with real PnL");
        return;
      }

      const out = await apiPost("/api/trade/execute", {
        userId: state.user.userId,
        token: symbol,
        side: "SELL",
        tokenAmount: qty,
        idempotencyKey: `sell_${symbol}_${Date.now()}`
      });

      state.wallet.usdc = out.balance;
      if (typeof out.feesPaid === "number") state.wallet.feesPaid = out.feesPaid;
      if (typeof out.realizedPnl === "number") state.wallet.realizedPnl = out.realizedPnl;
      if (typeof out.unrealizedPnl === "number") state.wallet.unrealizedPnl = out.unrealizedPnl;
      if (typeof out.totalPnl === "number") state.wallet.totalPnl = out.totalPnl;

      if (out.positions && out.positions[symbol]) {
        const pos = out.positions[symbol];
        const current = state.wallet.holdings.find((h) => h.symbol === symbol);
        if (current) {
          current.amount = Number(pos.amount || 0);
          current.pnl = Number(pos.unrealizedPnl || 0);
          current.avgCost = Number(pos.avgCost || 0);
          current.markPrice = Number(pos.markPrice || tokenPriceMap[symbol] || 0);
        } else {
          state.wallet.holdings.push({
            symbol,
            amount: Number(pos.amount || 0),
            pnl: Number(pos.unrealizedPnl || 0),
            avgCost: Number(pos.avgCost || 0),
            markPrice: Number(pos.markPrice || tokenPriceMap[symbol] || 0)
          });
        }
      } else {
        state.wallet.holdings = state.wallet.holdings.filter((h) => h.symbol !== symbol);
      }

      state.notifications.unshift({ id: `n${Date.now()}`, text: `${state.user.handle} sold ${qty} ${symbol}`, ts: "now" });
      if (!state.tokenNotes[symbol]) state.tokenNotes[symbol] = [];
      state.tokenNotes[symbol].unshift({
        user: state.user.handle,
        text: `Sold ${qty} ${symbol}. Realized PnL: ${money(out.trade?.realizedPnl || 0)}`,
        ts: "now"
      });

      renderAll();
      setTab("token");
    } catch (err) {
      alert(`Sell failed: ${err.message}`);
    }
  };

  document.querySelectorAll("[data-sell-pct]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pct = Number(btn.dataset.sellPct || 0);
      if (!myHolding || !pct) return;
      const qty = Number((myHolding.amount * (pct / 100)).toFixed(6));
      executeSell(qty);
    });
  });

  const sellCustomBtn = document.getElementById("sellCustomBtn");
  if (sellCustomBtn) {
    sellCustomBtn.addEventListener("click", () => {
      const input = document.getElementById("sellCustomInput");
      const qty = Number(input?.value || 0);
      if (!qty || qty <= 0) {
        alert("Enter a valid amount");
        return;
      }
      executeSell(Number(qty.toFixed(6)));
    });
  }
}
function renderWallet() {
  document.getElementById("walletBalance").textContent = `${money(state.wallet.usdc)} USDC | Fees ${money(state.wallet.feesPaid || 0)} | Total PnL ${money(state.wallet.totalPnl || 0)}`;
  const list = document.getElementById("holdingList");
  list.innerHTML = state.wallet.holdings.map((h) => `
    <article class="feed-card">
      <div class="row"><strong>${h.symbol}</strong><button class="ghost" data-open-token="${h.symbol}">Room</button></div>
      <div class="row muted"><span>Amount</span><span>${h.amount}</span></div>
      ${typeof h.avgCost === "number" ? `<div class="row muted"><span>Avg Cost</span><span>${money(h.avgCost)}</span></div>` : ""}
      <div class="row"><span class="muted">PnL</span><strong class="${h.pnl >= 0 ? "profit" : "loss"}">${money(h.pnl)}</strong></div>
    </article>
  `).join("");

  list.querySelectorAll("[data-open-token]").forEach((btn) => btn.addEventListener("click", () => openToken(btn.dataset.openToken)));
}

function renderFollowing() {
  const list = document.getElementById("followingList");
  const following = state.traders.filter((t) => t.following);
  list.innerHTML = following.length ? following.map((t) => `
    <article class="feed-card">
      <div class="row"><strong>${t.handle}</strong><button class="ghost" data-open-token="${t.token}">${t.token}</button></div>
      <div class="row"><span class="muted">Last trade: ${t.action}</span><strong class="${t.pnl >= 0 ? "profit" : "loss"}">${money(t.pnl)}</strong></div>
    </article>
  `).join("") : "<p class=\"muted\">No one in watchlist yet.</p>";

  list.querySelectorAll("[data-open-token]").forEach((btn) => btn.addEventListener("click", () => openToken(btn.dataset.openToken)));
}

function renderNotifications() {
  const list = document.getElementById("notificationList");
  list.innerHTML = state.notifications.map((n) => `
    <article class="feed-card">
      <div>${n.text}</div>
      <div class="muted">${n.ts}</div>
    </article>
  `).join("");
}

function renderProfile() {
  document.getElementById("profileCard").innerHTML = `
    <div class="row">
      <strong style="font-size:20px;">${state.user.handle}</strong>
      <span class="pill">${state.isConnected ? "Connected" : "Guest"}</span>
    </div>
    <p class="muted" style="margin-top:8px;">${state.user.bio}</p>
    <div class="row"><span class="muted">Provider</span><strong>${state.user.provider.toUpperCase()}</strong></div>

    <div class="social-stats" style="margin-top:10px;">
      <article class="social-stat"><small>Followers</small><strong>${state.user.followers.toLocaleString("en-US")}</strong></article>
      <article class="social-stat"><small>Following</small><strong>${state.user.followingCount.toLocaleString("en-US")}</strong></article>
      <article class="social-stat"><small>Copiers</small><strong>${state.user.copiers.toLocaleString("en-US")}</strong></article>
      <article class="social-stat"><small>Scans</small><strong>${state.user.scans.toLocaleString("en-US")}</strong></article>
    </div>

    <div class="followers-block">
      <div class="row">
        <strong>Followers</strong>
        <span class="muted tiny">Social layer</span>
      </div>
      <div class="followers-list">
        ${state.userFollowers.map((f) => `
          <article class="follower-row">
            <div>
              <strong>${f.handle}</strong>
              <div class="muted tiny">${f.trades} trades</div>
            </div>
            <button class="${f.copied ? "primary" : "ghost"}" data-toggle-copy-follower="${f.id}">
              ${f.copied ? "Copying" : "Enable Copy"}
            </button>
          </article>
        `).join("")}
      </div>
    </div>

    <div class="copy-settings" style="margin-top:12px;">
      <div class="row">
        <strong>Copy Trade</strong>
        <button id="toggleCopyTrade" class="${state.user.copyTradeEnabled ? "primary" : "ghost"}">${state.user.copyTradeEnabled ? "Enabled" : "Disabled"}</button>
      </div>
      <label class="muted tiny" for="copyAmountInput">Default copy amount (USDC)</label>
      <input id="copyAmountInput" type="number" min="10" step="10" value="${state.user.copyTradeAmount}" ${state.user.copyTradeEnabled ? "" : "disabled"} />
      <button id="saveCopySettings" class="primary wide" ${state.user.copyTradeEnabled ? "" : "disabled"}>Save Copy Settings</button>
      <div class="muted tiny" style="margin-top:6px;">Your copy amount will be used when you tap Copy in feed.</div>
    </div>

    <div class="row" style="margin-top:12px;"><span class="muted">Fee</span><strong>${state.feeBps} bps</strong></div>
    <div class="row"><span class="muted">Fees Paid</span><strong>${money(state.wallet.feesPaid || 0)}</strong></div>
    <div class="row"><span class="muted">Copy Count</span><strong>${state.copiedTradeCount}</strong></div>

    <button id="openPremiumFromProfile" class="warn wide">Go Pro</button>
  `;

  document.getElementById("openPremiumFromProfile").addEventListener("click", () => setTab("premium"));

  document.getElementById("toggleCopyTrade").addEventListener("click", () => {
    state.user.copyTradeEnabled = !state.user.copyTradeEnabled;
    if (state.user.copyTradeEnabled) {
      state.notifications.unshift({ id: `n${Date.now()}`, text: "Your profile is now copy-enabled", ts: "now" });
    } else {
      state.notifications.unshift({ id: `n${Date.now()}`, text: "Copy on your profile is now disabled", ts: "now" });
    }
    renderAll();
    setTab("profile");
  });

  const saveBtn = document.getElementById("saveCopySettings");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const value = Number(document.getElementById("copyAmountInput").value);
      if (!value || value < 10) {
        alert("Copy amount must be at least 10 USDC");
        return;
      }
      state.user.copyTradeAmount = Math.round(value);
      state.notifications.unshift({ id: `n${Date.now()}`, text: `Default copy amount set to ${money(state.user.copyTradeAmount)}`, ts: "now" });
      renderAll();
      setTab("profile");
    });
  }

  document.querySelectorAll("[data-toggle-copy-follower]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = state.userFollowers.find((f) => f.id === btn.dataset.toggleCopyFollower);
      if (!target) return;
      target.copied = !target.copied;
      state.notifications.unshift({
        id: `n${Date.now()}`,
        text: `${target.handle} ${target.copied ? "copy enabled" : "copy disabled"}`,
        ts: "now"
      });
      renderAll();
      setTab("profile");
    });
  });
}

function renderPremium() {
  const box = document.getElementById("premiumBox");
  if (state.premium.active) {
    box.innerHTML = `
      <h3>Pro Active</h3>
      <p>Pro copy is live.</p>
      <p class="muted">Renewal: ${new Date(state.premium.expiresAt).toLocaleString()}</p>
      <button class="ghost">Manage Plan</button>
    `;
    return;
  }

  box.innerHTML = `
    <h3>Pro Copy Locked</h3>
    <p class="muted">Go Pro to unlock one-tap copy.</p>
    <p><strong>$20/mo</strong> via USDC (Base)</p>
    <button class="primary" id="activatePremium">Go Pro with USDC</button>
  `;

  document.getElementById("activatePremium").addEventListener("click", async () => {
    try {
      if (hasServerSession()) {
        const out = await apiPost("/api/premium/activate", {
          userId: state.user.userId,
          idempotencyKey: `premium_${Date.now()}`
        });
        state.wallet.usdc = out.balance;
        state.premium = { ...state.premium, ...out.premium };
      } else {
        if (state.wallet.usdc < state.premium.monthlyUsd) {
          alert("Not enough USDC");
          return;
        }
        state.wallet.usdc -= state.premium.monthlyUsd;
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        state.premium.active = true;
        state.premium.expiresAt = nextMonth.toISOString();
      }

      state.notifications.unshift({ id: `n${Date.now()}`, text: "Pro activated ($20/month)", ts: "now" });
      renderAll();
    } catch (err) {
      alert(`Premium failed: ${err.message}`);
    }
  });
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function randomBetween(min, max) { return min + Math.random() * (max - min); }

function updateLiveModeLabel() {
  const el = document.getElementById("liveModeLabel");
  if (!el) return;
  el.textContent = state.live.connected && state.live.transport === "websocket" ? "WS LIVE" : "SIM MODE";
}

function buildSimulatedUpdate() {
  const market = state.market.map((m) => {
    const drift = m.symbol === "USDC" ? randomBetween(-0.05, 0.05) : randomBetween(-0.9, 0.9);
    return { symbol: m.symbol, change: clamp(m.change + drift, -15, 15) };
  });

  const tokenUpdates = {};
  Object.entries(state.tokenInsights).forEach(([symbol, insight]) => {
    const isStable = symbol === "USDC";
    const driftPct = isStable ? randomBetween(-0.03, 0.03) : randomBetween(-1.0, 1.0);
    const last = insight.series[insight.series.length - 1] || 100;
    const next = clamp(last * (1 + driftPct / 100), 60, 220);
    tokenUpdates[symbol] = {
      series: [...insight.series, Number(next.toFixed(2))].slice(-20),
      appHolderProfitRate: Number(clamp(insight.appHolderProfitRate + randomBetween(-0.6, 0.6), 5, 100).toFixed(1)),
      volume24h: Math.max(10000, Math.round(insight.volume24h + randomBetween(-60000, 70000))),
      appHolderAvgPnl: Math.round(insight.appHolderAvgPnl + randomBetween(-80, 100))
    };
  });

  const traders = state.traders.map((t) => {
    const m = market.find((x) => x.symbol === t.token);
    const tokenDrift = m ? m.change / 100 : 0;
    return {
      id: t.id,
      pnl: Number((t.pnl + randomBetween(-120, 120) + t.size * tokenDrift * 0.02).toFixed(2)),
      size: Math.max(120, Number((t.size + randomBetween(-90, 140)).toFixed(2)))
    };
  });

  let notification = null;
  if (Math.random() > 0.82) {
    const spotlight = state.traders[Math.floor(Math.random() * state.traders.length)];
    notification = { id: `n${Date.now()}`, text: `${spotlight.handle} made a fresh move on ${spotlight.token}`, ts: "now" };
    state.user.scans += Math.floor(randomBetween(1, 5));
  }

  return { market, tokenUpdates, traders, notification };
}

function applyLiveUpdate(payload) {
  if (!payload) return;

  if (Array.isArray(payload.market)) state.market = payload.market.map((m) => ({ symbol: m.symbol, change: Number(m.change) }));

  if (payload.tokenUpdates && typeof payload.tokenUpdates === "object") {
    Object.entries(payload.tokenUpdates).forEach(([symbol, patch]) => {
      const target = state.tokenInsights[symbol];
      if (!target) return;
      if (Array.isArray(patch.series)) target.series = patch.series.map((x) => Number(x));
      if (typeof patch.appHolderProfitRate === "number") target.appHolderProfitRate = patch.appHolderProfitRate;
      if (typeof patch.volume24h === "number") target.volume24h = Math.round(patch.volume24h);
      if (typeof patch.appHolderAvgPnl === "number") target.appHolderAvgPnl = Math.round(patch.appHolderAvgPnl);
    });
  }

  if (Array.isArray(payload.traders)) {
    payload.traders.forEach((patch) => {
      const target = state.traders.find((t) => t.id === patch.id);
      if (!target) return;
      if (typeof patch.pnl === "number") target.pnl = patch.pnl;
      if (typeof patch.size === "number") target.size = patch.size;
    });
  }

  if (payload.notification) {
    state.notifications.unshift(payload.notification);
    state.notifications = state.notifications.slice(0, 30);
  }

  renderAll();
}

function startSimulatedLive() {
  state.live.transport = "simulator";
  state.live.mode = "sim";
  state.live.connected = true;
  updateLiveModeLabel();
  setInterval(() => applyLiveUpdate(buildSimulatedUpdate()), 7000);
}

function tryStartWebSocket() {
  const params = new URLSearchParams(window.location.search);
  const wsUrl = params.get("ws") || window.__LIVE_WS_URL || null;
  if (!wsUrl) return false;

  try {
    const ws = new WebSocket(wsUrl);
    state.live.wsUrl = wsUrl;
    state.live.transport = "websocket";
    state.live.mode = "ws";

    ws.onopen = () => {
      state.live.connected = true;
      updateLiveModeLabel();
      state.notifications.unshift({ id: `n${Date.now()}`, text: "Live stream connected", ts: "now" });
      state.notifications = state.notifications.slice(0, 30);
      renderGlobalPulse();
      renderNotifications();
    };

    ws.onmessage = (event) => {
      try { applyLiveUpdate(JSON.parse(event.data)); } catch { }
    };

    ws.onerror = () => {
      state.live.connected = false;
      updateLiveModeLabel();
    };

    ws.onclose = () => {
      state.live.connected = false;
      updateLiveModeLabel();
      startSimulatedLive();
    };

    return true;
  } catch {
    return false;
  }
}

function bindUI() {
  document.getElementById("connectApp").addEventListener("click", async () => {
    try {
      const rawProvider = prompt("Login provider (farcaster/base)", "farcaster");
      if (!rawProvider) return;

      const provider = rawProvider.trim().toLowerCase() === "base" ? "base" : "farcaster";
      const userId = state.user.userId || `${provider}_local_${Date.now()}`;
      const login = await apiPost("/api/auth/login", {
        provider,
        userId,
        username: state.user.handle.replace("@", "")
      });

      state.user.userId = login.session.userId;
      state.user.provider = login.session.provider;
      state.isConnected = true;
      document.getElementById("loginBadge").textContent = `Connected • ${provider.toUpperCase()}`;

      const inbox = await apiGet(`/api/notifications/inbox?userId=${encodeURIComponent(state.user.userId)}`);
      const merged = (inbox.items || []).map((n) => ({ id: n.id, text: n.text, ts: "now" }));
      state.notifications = [...merged, ...state.notifications].slice(0, 30);

      await syncAccountFromServer();
      renderAll();
    } catch (err) {
      alert(`Connect failed: ${err.message}`);
    }
  });

  document.getElementById("depositBtn").addEventListener("click", async () => {
    const amount = Number(document.getElementById("depositInput").value);
    if (!amount || amount <= 0) return;

    try {
      if (hasServerSession()) {
        const out = await apiPost("/api/balance/deposit-usdc", { userId: state.user.userId, amount });
        state.wallet.usdc = out.balance;
      } else {
        state.wallet.usdc = Number((state.wallet.usdc + amount).toFixed(2));
      }

      state.notifications.unshift({ id: `n${Date.now()}`, text: `${money(amount)} USDC deposited`, ts: "now" });
      document.getElementById("depositInput").value = "";
      renderAll();
    } catch (err) {
      alert(`Deposit failed: ${err.message}`);
    }
  });

  document.getElementById("openPremiumFromHero").addEventListener("click", () => setTab("premium"));
  document.getElementById("openPremiumFromToken").addEventListener("click", () => setTab("premium"));
  document.getElementById("backToFeed").addEventListener("click", () => setTab("feed"));

  document.getElementById("sendTokenNote").addEventListener("click", () => {
    const symbol = state.selectedToken;
    const input = document.getElementById("tokenNoteInput");
    const text = input.value.trim();
    if (!text) return;
    if (!state.tokenNotes[symbol]) state.tokenNotes[symbol] = [];
    state.tokenNotes[symbol].unshift({ user: state.user.handle, text, ts: "now" });
    state.notifications.unshift({ id: `n${Date.now()}`, text: `${state.user.handle} posted a note on ${symbol}`, ts: "now" });
    input.value = "";
    renderAll();
    setTab("token");
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setTab(tab.dataset.tab));
  });

  document.querySelectorAll(".token-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tokenBoardFilter = btn.dataset.filter;
      document.querySelectorAll(".token-filter").forEach((b) => b.classList.toggle("active", b === btn));
      renderTokenBoard();
    });
  });
}

function renderAll() {
  renderHomeProfile();
  renderGlobalPulse();
  renderTopStats();
  renderMarketTicker();
  renderTokenBoard();
  renderFeed();
  renderTokenDetail();
  renderWallet();
  renderFollowing();
  renderNotifications();
  renderProfile();
  renderPremium();
}

function initLiveTransport() {
  const wsStarted = tryStartWebSocket();
  if (!wsStarted) startSimulatedLive();
}

bindUI();
renderAll();
setTab("feed");
initLiveTransport();







































