import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Loader2, Wallet } from "lucide-react";
import { sdk } from "@farcaster/miniapp-sdk";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { useAccount, useConnect } from "wagmi";
import { encodeFunctionData, parseUnits } from "viem";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";

const ETH_SYMBOL = "ETH";
const ETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const USDC_FALLBACK = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

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
  }
];

function shortAddr(addr) {
  if (!addr) return "-";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function getJson(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok || data?.ok === false) throw new Error(data?.error || "request_failed");
  return data;
}

async function waitForReceipt(provider, txHash, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash]
    });
    if (receipt && receipt.blockNumber) return receipt;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("tx_receipt_timeout");
}

export default function App() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { connectAsync } = useConnect();

  const [miniAppDetected, setMiniAppDetected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [trading, setTrading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [connectedAddress, setConnectedAddress] = useState("");

  const [onchainConfig, setOnchainConfig] = useState(null);

  const [side, setSide] = useState("BUY");
  const [amount, setAmount] = useState("25");
  const [slippageBps, setSlippageBps] = useState("100");
  const [quote, setQuote] = useState(null);
  const [lastApproveTx, setLastApproveTx] = useState("");
  const [lastSwapTx, setLastSwapTx] = useState("");

  const walletAddress = connectedAddress || wagmiAddress || "";
  const walletConnected = Boolean(walletAddress) || wagmiConnected;

  const usdcAddress = useMemo(() => {
    return String(onchainConfig?.usdcDeposit?.tokenAddress || USDC_FALLBACK);
  }, [onchainConfig]);

  const routerAddress = useMemo(() => {
    return String(onchainConfig?.userRouterAddress || "").trim();
  }, [onchainConfig]);

  function getProvider() {
    return (
      sdk?.wallet?.ethProvider ||
      (typeof window !== "undefined" ? window?.miniapp?.sdk?.wallet?.ethProvider : null) ||
      null
    );
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        const inMini = await sdk.isInMiniApp();
        if (active) setMiniAppDetected(!!inMini);
      } catch {
        const fallback = typeof window !== "undefined" && !!(window.miniapp?.sdk || window.farcaster);
        if (active) setMiniAppDetected(fallback);
      }

      try {
        const out = await getJson("/api/onchain/config");
        if (active) setOnchainConfig(out.onchain || null);
      } catch {
        if (active) setOnchainConfig(null);
      }
    }

    boot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      const n = Number(amount || 0);
      const slip = Math.max(10, Math.min(2000, Number(slippageBps || 100)));
      if (!(n > 0)) {
        setQuote(null);
        return;
      }

      const params = new URLSearchParams({
        token: ETH_SYMBOL,
        side,
        userId: "guest",
        slippageBps: String(slip)
      });

      if (side === "BUY") params.set("amountUsdc", String(n));
      else params.set("tokenAmount", String(n));

      try {
        const out = await getJson(`/api/trade/quote?${params.toString()}`);
        if (!cancelled) setQuote(out.quote || null);
      } catch {
        if (!cancelled) setQuote(null);
      }
    }

    loadQuote();
    return () => {
      cancelled = true;
    };
  }, [side, amount, slippageBps]);

  async function handleConnectWallet() {
    setConnecting(true);
    setError("");
    setStatus("Connecting wallet...");
    try {
      const result = await connectAsync({ connector: farcasterMiniApp(), chainId: 8453 });
      const account = result?.accounts?.[0] || "";
      if (account) {
        setConnectedAddress(String(account));
        setStatus(`Connected: ${shortAddr(String(account))}`);
        return;
      }

      const provider = getProvider();
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

  async function handleTrade() {
    setTrading(true);
    setError("");
    setLastApproveTx("");
    setLastSwapTx("");

    try {
      if (!walletAddress) throw new Error("wallet_not_connected");
      if (!routerAddress) throw new Error("user_router_not_configured");

      const provider = getProvider();
      if (!provider?.request) throw new Error("wallet_provider_unavailable");

      const n = Number(amount || 0);
      if (!(n > 0)) throw new Error("invalid_amount");

      const slip = Math.max(10, Math.min(2000, Number(slippageBps || 100)));

      let tokenIn;
      let tokenOut;
      let amountInRaw;
      let minOutRaw = 0n;

      if (side === "BUY") {
        tokenIn = usdcAddress;
        tokenOut = ETH_ADDRESS;
        amountInRaw = parseUnits(n.toFixed(6), 6);

        const outToken = Number(quote?.outTokenAmount || 0);
        const minOutToken = outToken * (1 - slip / 10000);
        minOutRaw = minOutToken > 0 ? parseUnits(minOutToken.toFixed(6), 18) : 0n;
      } else {
        tokenIn = ETH_ADDRESS;
        tokenOut = usdcAddress;
        amountInRaw = parseUnits(n.toFixed(6), 18);

        const outUsdc = Number(quote?.outUsdc || 0);
        const minOutUsdc = outUsdc * (1 - slip / 10000);
        minOutRaw = minOutUsdc > 0 ? parseUnits(minOutUsdc.toFixed(6), 6) : 0n;
      }

      setStatus("Step 1/2: Approve token...");
      const approveData = encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [routerAddress, amountInRaw]
      });

      const approveTx = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: walletAddress, to: tokenIn, data: approveData, value: "0x0" }]
      });
      setLastApproveTx(String(approveTx));
      await waitForReceipt(provider, String(approveTx));

      setStatus("Step 2/2: Swap ETH...");
      const swapData = encodeFunctionData({
        abi: USER_TRADE_ROUTER_ABI,
        functionName: "swapUserTokens",
        args: [tokenIn, tokenOut, amountInRaw, minOutRaw, walletAddress]
      });

      const swapTx = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: walletAddress, to: routerAddress, data: swapData, value: "0x0" }]
      });

      setLastSwapTx(String(swapTx));
      await waitForReceipt(provider, String(swapTx));

      setStatus("Trade completed successfully.");
    } catch (e) {
      setError(String(e?.message || "trade_failed"));
      setStatus("");
    } finally {
      setTrading(false);
    }
  }

  const expectedOutLabel = useMemo(() => {
    if (!quote) return "-";
    if (side === "BUY") return `${Number(quote.outTokenAmount || 0).toFixed(6)} ETH`;
    return `${Number(quote.outUsdc || 0).toFixed(2)} USDC`;
  }, [quote, side]);

  const tradeButtonLabel = useMemo(() => {
    return side === "BUY" ? "Buy ETH" : "Sell ETH";
  }, [side]);

  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-6">
      <Card className="border-white/10 bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <CardDescription className="text-zinc-400">BaseRush Lite</CardDescription>
              <CardTitle className="text-2xl">ETH Quick Trade</CardTitle>
            </div>
            <Badge variant={walletConnected ? "success" : "muted"}>{walletConnected ? "Connected" : "Guest"}</Badge>
          </div>
          <p className="text-xs text-zinc-400">Tek ekran: cuzdan bagla ve ETH buy/sell dene.</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Mini app context</span>
              <span>{miniAppDetected ? "Detected" : "Not detected"}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-zinc-400">Wallet</span>
              <span>{walletConnected ? shortAddr(walletAddress) : "Not connected"}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-zinc-400">Router</span>
              <span>{routerAddress ? shortAddr(routerAddress) : "Missing"}</span>
            </div>
          </div>

          <Button className="w-full" onClick={handleConnectWallet} disabled={connecting}>
            {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
            {connecting ? "Connecting..." : "Connect Wallet"}
          </Button>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={side === "BUY" ? "default" : "outline"} onClick={() => setSide("BUY")} disabled={trading}>
                Buy ETH
              </Button>
              <Button variant={side === "SELL" ? "default" : "outline"} onClick={() => setSide("SELL")} disabled={trading}>
                Sell ETH
              </Button>
            </div>

            <div>
              <p className="mb-1 text-xs text-zinc-400">{side === "BUY" ? "Amount In (USDC)" : "Amount In (ETH)"}</p>
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={side === "BUY" ? "25" : "0.01"}
              />
            </div>

            <div>
              <p className="mb-1 text-xs text-zinc-400">Slippage (bps)</p>
              <Input
                type="number"
                min="10"
                max="2000"
                step="10"
                value={slippageBps}
                onChange={(e) => setSlippageBps(e.target.value)}
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Pair</span>
                <span className="inline-flex items-center gap-1"><ArrowDownUp className="h-3.5 w-3.5" /> {side === "BUY" ? "USDC -> ETH" : "ETH -> USDC"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-zinc-400">Expected out</span>
                <span>{expectedOutLabel}</span>
              </div>
            </div>

            <Button className="w-full" onClick={handleTrade} disabled={!walletConnected || trading || !routerAddress}>
              {trading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {trading ? "Processing..." : tradeButtonLabel}
            </Button>
          </div>

          {status && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">{status}</div>}
          {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs">{error}</div>}

          {lastApproveTx && (
            <a className="block text-xs text-zinc-300 underline" href={`https://basescan.org/tx/${lastApproveTx}`} target="_blank" rel="noreferrer">
              Approve tx: {shortAddr(lastApproveTx)}
            </a>
          )}

          {lastSwapTx && (
            <a className="block text-xs text-zinc-300 underline" href={`https://basescan.org/tx/${lastSwapTx}`} target="_blank" rel="noreferrer">
              Swap tx: {shortAddr(lastSwapTx)}
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
