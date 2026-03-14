const ETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const USDC_FALLBACK = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_RPC_FALLBACK = "https://mainnet.base.org";

function isAddress(v) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(v || ""));
}

function toHexAddress32(addr) {
  return String(addr || "").toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function formatUnits(raw, decimals) {
  const d = Number(decimals || 0);
  if (!Number.isFinite(d) || d < 0) return "0";
  const n = BigInt(raw || 0n);
  const base = 10n ** BigInt(d);
  const whole = n / base;
  const frac = n % base;
  if (frac === 0n) return whole.toString();
  const fracText = frac.toString().padStart(d, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracText}`;
}

async function rpcCall(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error?.message || "rpc_failed");
  return data?.result;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const walletAddress = String(req.query?.walletAddress || "").trim();
    const usdcAddress = String(req.query?.usdcAddress || USDC_FALLBACK).trim();
    const tokenAddress = String(req.query?.tokenAddress || ETH_ADDRESS).trim();
    const tokenDecimals = Number(req.query?.tokenDecimals || 18);
    const rpcUrl = String(process.env.BASE_RPC_URL || BASE_RPC_FALLBACK).trim();

    if (!isAddress(walletAddress)) {
      res.status(400).json({ ok: false, error: "invalid_wallet_address" });
      return;
    }
    if (!isAddress(usdcAddress) || !isAddress(tokenAddress)) {
      res.status(400).json({ ok: false, error: "invalid_token_address" });
      return;
    }

    const owner32 = toHexAddress32(walletAddress);
    const usdcData = `0x70a08231${owner32}`;
    const usdcRawHex = await rpcCall(rpcUrl, "eth_call", [{ to: usdcAddress, data: usdcData }, "latest"]);
    const usdcRaw = BigInt(String(usdcRawHex || "0x0"));

    let tokenRaw = 0n;
    if (tokenAddress.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
      const nativeRawHex = await rpcCall(rpcUrl, "eth_getBalance", [walletAddress, "latest"]);
      tokenRaw = BigInt(String(nativeRawHex || "0x0"));
    } else {
      const tokenData = `0x70a08231${owner32}`;
      const tokenRawHex = await rpcCall(rpcUrl, "eth_call", [{ to: tokenAddress, data: tokenData }, "latest"]);
      tokenRaw = BigInt(String(tokenRawHex || "0x0"));
    }

    res.status(200).json({
      ok: true,
      balances: {
        usdc: Number(formatUnits(usdcRaw, 6)),
        token: Number(formatUnits(tokenRaw, tokenDecimals)),
        usdcRaw: usdcRaw.toString(),
        tokenRaw: tokenRaw.toString()
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || "live_balance_failed") });
  }
}

