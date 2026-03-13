function asBool(v) {
  return String(v || "").toLowerCase() === "true";
}

function isLocalSignerAllowed() {
  const env = String(process.env.NODE_ENV || "").toLowerCase();
  const isProd = env === "production" || !!process.env.VERCEL_ENV;
  if (!isProd) return true;
  return asBool(process.env.ALLOW_LOCAL_SIGNER_IN_PROD);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const ENABLE_REAL_ONCHAIN = asBool(process.env.ENABLE_REAL_ONCHAIN);
  const BASE_RPC_URL = process.env.BASE_RPC_URL || "";
  const TRADE_EXECUTOR_ADDRESS = process.env.TRADE_EXECUTOR_ADDRESS || "";
  const SERVER_SIGNER_PRIVATE_KEY = process.env.SERVER_SIGNER_PRIVATE_KEY || "";
  const TRADE_EXECUTOR_FUNCTION = process.env.TRADE_EXECUTOR_FUNCTION || "executeTrade";
  const USDC_BASE_ADDRESS = (process.env.USDC_BASE_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913").trim();
  const USDC_DEPOSIT_RECEIVER = (process.env.USDC_DEPOSIT_RECEIVER || process.env.FEE_TREASURY_ADDRESS || "").trim();
  const BUILDER_CODE = process.env.BUILDER_CODE || "bc_g19kvpy7";

  let abiEntries = 1;
  try {
    const parsed = JSON.parse(process.env.TRADE_EXECUTOR_ABI_JSON || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) abiEntries = parsed.length;
  } catch {
    abiEntries = 1;
  }

  let argsTemplate = ["$tokenAddress", "$sideInt", "$usdcAmount", "$minOut", "$recipient", "$orderId"];
  try {
    const parsed = JSON.parse(process.env.TRADE_EXECUTOR_ARGS_TEMPLATE_JSON || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) argsTemplate = parsed;
  } catch {
    // keep default
  }

  const builderSuffixConfigured = !!String(process.env.BUILDER_DATA_SUFFIX || "").trim() || !!BUILDER_CODE;

  res.status(200).json({
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
      abiEntries,
      argsTemplate,
      builderCode: BUILDER_CODE || null,
      builderSuffixConfigured,
      usdcDeposit: {
        tokenAddress: USDC_BASE_ADDRESS || null,
        receiverAddress: USDC_DEPOSIT_RECEIVER || null,
        configured: !!(BASE_RPC_URL && USDC_BASE_ADDRESS && USDC_DEPOSIT_RECEIVER)
      }
    }
  });
}
