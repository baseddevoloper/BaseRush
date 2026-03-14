import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowDownUp,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Home,
  Loader2,
  Settings,
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

async function getJson(path) {
  const res = await fetch(path);
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
  { bufferBps = 3000, minGas = 21000n, maxGas = 2500000n } = {}
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

export default function App() {
  const { address: wagmiAddress, isConnected: wagmiConnected, connector } = useAccount();

  const [miniAppDetected, setMiniAppDetected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [trading, setTrading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [connectedAddress, setConnectedAddress] = useState("");

  const [onchainConfig, setOnchainConfig] = useState(null);

  const [side, setSide] = useState("BUY");
  const [venue, setVenue] = useState("v3");
  const [ethAmount, setEthAmount] = useState("0.01");
  const [slippageMode, setSlippageMode] = useState("1");
  const [customSlippage, setCustomSlippage] = useState("1");

  const [quoteSell, setQuoteSell] = useState(null);
  const [lastApproveTx, setLastApproveTx] = useState("");
  const [lastSwapTx, setLastSwapTx] = useState("");
  const [activeTab, setActiveTab] = useState("trade");

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
    const amountEth = Number(ethAmount || 0);
    const price = Number(quoteSell?.price || 0);
    const feeBps = Number(quoteSell?.feeBps || 0);
    if (!(amountEth > 0) || !(price > 0)) return null;

    const feeFactor = 1 - feeBps / 10000;
    if (feeFactor <= 0) return null;

    const requiredUsdc = (amountEth * price) / feeFactor;
    const minOutEth = amountEth * (1 - slippagePct / 100);

    return {
      amountEth,
      requiredUsdc,
      minOutEth
    };
  }, [ethAmount, quoteSell, slippagePct]);

  const sellModel = useMemo(() => {
    const amountEth = Number(ethAmount || 0);
    const outUsdc = Number(quoteSell?.outUsdc || 0);
    if (!(amountEth > 0) || !(outUsdc > 0)) return null;

    const minOutUsdc = outUsdc * (1 - slippagePct / 100);
    return {
      amountEth,
      expectedUsdc: outUsdc,
      minOutUsdc
    };
  }, [ethAmount, quoteSell, slippagePct]);

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
        const out = await getJson("/api/onchain/config");
        if (!active) return;
        setOnchainConfig(out.onchain || null);
        if (out?.onchain?.uniswapV4?.enabled) setVenue("v4");
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
      const n = Number(ethAmount || 0);
      if (!(n > 0)) {
        setQuoteSell(null);
        return;
      }

      const params = new URLSearchParams({
        token: "ETH",
        side: "SELL",
        tokenAmount: String(n),
        userId: "guest",
        slippageBps: String(slippageBps)
      });

      try {
        const out = await getJson(`/api/trade/quote?${params.toString()}`);
        if (!cancelled) setQuoteSell(out.quote || null);
      } catch {
        if (!cancelled) setQuoteSell(null);
      }
    }

    loadQuoteSell();
    return () => {
      cancelled = true;
    };
  }, [ethAmount, slippageBps]);

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

      const provider = await getProvider();
      if (!provider?.request) throw new Error("wallet_provider_unavailable");

      const nEth = Number(ethAmount || 0);
      if (!(nEth > 0)) throw new Error("invalid_eth_amount");

      let tokenIn;
      let tokenOut;
      let amountInRaw;
      let minOutRaw;

      if (side === "BUY") {
        if (!buyModel) throw new Error("quote_missing_for_buy");
        tokenIn = usdcAddress;
        tokenOut = ETH_ADDRESS;
        amountInRaw = parseUnits(buyModel.requiredUsdc.toFixed(6), 6);
        minOutRaw = parseUnits(buyModel.minOutEth.toFixed(6), 18);
      } else {
        if (!sellModel) throw new Error("quote_missing_for_sell");
        tokenIn = ETH_ADDRESS;
        tokenOut = usdcAddress;
        amountInRaw = parseUnits(nEth.toFixed(6), 18);
        minOutRaw = parseUnits(sellModel.minOutUsdc.toFixed(6), 6);
      }

      if (venue === "v3") {
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

      let needsApprove = false;
      if (side === "BUY") {
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
          const approveGas = await estimateGasWithBuffer(provider, approveReq, {
            bufferBps: 2000,
            minGas: 65000n,
            maxGas: 350000n
          });
          if (approveGas) approveReq.gas = approveGas;

          const approveTx = await provider.request({
            method: "eth_sendTransaction",
            params: [approveReq]
          });
          setLastApproveTx(String(approveTx));
          setStatus("Approve submitted. Waiting confirmation...");

          let approveConfirmed = false;
          try {
            await waitForReceipt(provider, String(approveTx), 45000);
            approveConfirmed = true;
          } catch (approveErr) {
            const msg = String(approveErr?.message || "").toLowerCase();
            if (!msg.includes("does not support the requested method")) throw approveErr;
          }

          if (!approveConfirmed) {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      }

      setStatus(
        needsApprove
          ? "Step 2/2: Swap to ETH..."
          : side === "BUY"
            ? "Step 1/1: Swap to ETH..."
            : "Step 1/1: Sell ETH..."
      );

      let swapData;
      let txValue = "0x0";

      if (side === "SELL") {
        txValue = `0x${amountInRaw.toString(16)}`;
        if (venue === "v4") {
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
      } else if (venue === "v4") {
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
      const minSwapGas = venue === "v4" ? 280000n : side === "SELL" ? 200000n : 180000n;
      const swapGas = await estimateGasWithBuffer(provider, swapReq, {
        bufferBps: 3000,
        minGas: minSwapGas,
        maxGas: 1200000n
      });
      if (swapGas) swapReq.gas = swapGas;

      const swapTx = await provider.request({
        method: "eth_sendTransaction",
        params: [swapReq]
      });

      setLastSwapTx(String(swapTx));
      setStatus("Swap submitted. Check status on Basescan.");
      try {
        await waitForReceipt(provider, String(swapTx), 45000);
        setStatus("Trade completed successfully.");
      } catch (receiptErr) {
        const msg = String(receiptErr?.message || "").toLowerCase();
        if (!msg.includes("does not support the requested method")) throw receiptErr;
      }
    } catch (e) {
      setError(String(e?.message || "trade_failed"));
      setStatus("");
    } finally {
      setTrading(false);
    }
  }

  const tradeButtonLabel = useMemo(() => (side === "BUY" ? "Buy ETH" : "Sell ETH"), [side]);
  const quoteReady = side === "BUY" ? !!buyModel : !!sellModel;
  const canTrade = walletConnected && !trading && !!routerAddress && quoteReady;

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,#27272a_0%,#0a0a0a_46%,#000000_100%)]" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-24 pt-4">
        <Card className="border-white/10 bg-zinc-900/70 backdrop-blur">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardDescription className="text-zinc-400">BaseRush Mobile</CardDescription>
                <CardTitle className="text-2xl">Test Trade</CardTitle>
              </div>
              <Badge variant={walletConnected ? "success" : "muted"}>{walletConnected ? "Connected" : "Guest"}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                <p className="text-zinc-500">Wallet</p>
                <p className="truncate">{walletConnected ? shortAddr(walletAddress) : "Not connected"}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                <p className="text-zinc-500">Wallet provider</p>
                <p>{miniAppDetected ? "Injected" : "Not detected"}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="mt-3 flex-1">
          {activeTab === "trade" && (
            <div className="space-y-3">
              {!walletConnected && (
                <Card className="border-white/10 bg-zinc-900/80">
                  <CardContent className="pt-5">
                    <Button className="w-full" onClick={handleConnectWallet} disabled={connecting}>
                      {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WalletIcon className="mr-2 h-4 w-4" />}
                      {connecting ? "Connecting..." : "Connect Wallet"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card className="border-white/10 bg-zinc-900/80">
                <CardContent className="space-y-4 pt-5">
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={side === "BUY" ? "default" : "outline"} onClick={() => setSide("BUY")} disabled={trading}>
                      Buy ETH
                    </Button>
                    <Button variant={side === "SELL" ? "default" : "outline"} onClick={() => setSide("SELL")} disabled={trading}>
                      Sell ETH
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={venue === "v3" ? "default" : "outline"} onClick={() => setVenue("v3")} disabled={trading}>
                      Route V3
                    </Button>
                    <Button
                      variant={venue === "v4" ? "default" : "outline"}
                      onClick={() => setVenue("v4")}
                      disabled={trading || !onchainConfig?.uniswapV4?.enabled}
                    >
                      Route V4
                    </Button>
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-zinc-400">ETH Amount</p>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={ethAmount}
                      onChange={(e) => setEthAmount(e.target.value)}
                      placeholder="0.01"
                    />
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {["0.0001", "0.001", "0.01", "0.1"].map((amount) => (
                        <Button
                          key={amount}
                          variant={ethAmount === amount ? "default" : "outline"}
                          onClick={() => setEthAmount(amount)}
                          disabled={trading}
                        >
                          {amount}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
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
                        className="mt-2"
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

                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Pair</span>
                      <span className="inline-flex items-center gap-1">
                        <ArrowDownUp className="h-3.5 w-3.5" />
                        {side === "BUY" ? "USDC -> ETH" : "ETH -> USDC"}
                      </span>
                    </div>
                    {side === "BUY" ? (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-zinc-400">Estimated cost</span>
                        <span>{buyModel ? `${buyModel.requiredUsdc.toFixed(2)} USDC` : "-"}</span>
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
                            ? `${buyModel.minOutEth.toFixed(6)} ETH`
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
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-3">
              <Card className="border-white/10 bg-zinc-900/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Trade Activity</CardTitle>
                  <CardDescription>Latest execution state and transaction links.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center gap-2">
                      {error ? <CircleAlert className="h-4 w-4 text-rose-400" /> : <CircleCheck className="h-4 w-4 text-emerald-400" />}
                      <span>{error ? "Last action failed" : "System ready"}</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">{error || status || "No trade action yet."}</p>
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

          {activeTab === "wallet" && (
            <div className="space-y-3">
              <Card className="border-white/10 bg-zinc-900/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Wallet Session</CardTitle>
                  <CardDescription>Connection and Base network trade config.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Wallet</span>
                      <span>{walletConnected ? shortAddr(walletAddress) : "Not connected"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Wallet provider</span>
                      <span>{miniAppDetected ? "Injected" : "Not detected"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">USDC</span>
                      <span>{shortAddr(usdcAddress)}</span>
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
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-zinc-900/95 p-2 backdrop-blur">
            <Button variant={activeTab === "trade" ? "default" : "ghost"} className="h-10" onClick={() => setActiveTab("trade")}>
              <Home className="mr-1.5 h-4 w-4" />
              Trade
            </Button>
            <Button variant={activeTab === "activity" ? "default" : "ghost"} className="h-10" onClick={() => setActiveTab("activity")}>
              <ActivityIcon className="mr-1.5 h-4 w-4" />
              Activity
            </Button>
            <Button variant={activeTab === "wallet" ? "default" : "ghost"} className="h-10" onClick={() => setActiveTab("wallet")}>
              <Settings className="mr-1.5 h-4 w-4" />
              Wallet
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}




