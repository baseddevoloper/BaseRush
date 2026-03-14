import { Attribution } from "ox/erc8021";

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
  const USER_TRADE_ROUTER_ADDRESS = process.env.USER_TRADE_ROUTER_ADDRESS || "";
  const UNISWAP_V4_UNIVERSAL_ROUTER = process.env.UNISWAP_V4_UNIVERSAL_ROUTER || "";
  const UNISWAP_PERMIT2 = process.env.UNISWAP_PERMIT2 || "";
  const USER_ROUTER_V4_ENABLED = asBool(process.env.USER_ROUTER_V4_ENABLED || "false");
  const UNISWAP_V4_POOL_FEE = Number(process.env.UNISWAP_V4_POOL_FEE || 500);
  const UNISWAP_V4_POOL_TICK_SPACING = Number(process.env.UNISWAP_V4_POOL_TICK_SPACING || 10);
  const UNISWAP_V4_POOL_HOOKS = process.env.UNISWAP_V4_POOL_HOOKS || "0x0000000000000000000000000000000000000000";
  const UNISWAP_V4_POOL_CURRENCY0 = process.env.UNISWAP_V4_POOL_CURRENCY0 || "0x4200000000000000000000000000000000000006";
  const UNISWAP_V4_POOL_CURRENCY1 = process.env.UNISWAP_V4_POOL_CURRENCY1 || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const WRAPPED_NATIVE_TOKEN = process.env.WRAPPED_NATIVE_TOKEN || "0x4200000000000000000000000000000000000006";
  const AUTO_UNWRAP_NATIVE_OUT = asBool(process.env.AUTO_UNWRAP_NATIVE_OUT || "true");
  const SERVER_SIGNER_PRIVATE_KEY = process.env.SERVER_SIGNER_PRIVATE_KEY || "";
  const TRADE_EXECUTOR_FUNCTION = process.env.TRADE_EXECUTOR_FUNCTION || "executeTrade";
  const USDC_BASE_ADDRESS = (process.env.USDC_BASE_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913").trim();
  const USDC_DEPOSIT_RECEIVER = (process.env.USDC_DEPOSIT_RECEIVER || process.env.FEE_TREASURY_ADDRESS || "").trim();
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

  const builderSuffixConfigured = !!BUILDER_DATA_SUFFIX;

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
      userRouterAddress: USER_TRADE_ROUTER_ADDRESS || null,
      userRouterConfigured: !!USER_TRADE_ROUTER_ADDRESS,
      wrappedNativeToken: WRAPPED_NATIVE_TOKEN || null,
      autoUnwrapNativeOut: AUTO_UNWRAP_NATIVE_OUT,
      uniswapV4: {
        enabled: USER_ROUTER_V4_ENABLED && !!UNISWAP_V4_UNIVERSAL_ROUTER && !!UNISWAP_PERMIT2,
        universalRouter: UNISWAP_V4_UNIVERSAL_ROUTER || null,
        permit2: UNISWAP_PERMIT2 || null,
        poolFee: UNISWAP_V4_POOL_FEE,
        tickSpacing: UNISWAP_V4_POOL_TICK_SPACING,
        hooks: UNISWAP_V4_POOL_HOOKS,
        currency0: UNISWAP_V4_POOL_CURRENCY0,
        currency1: UNISWAP_V4_POOL_CURRENCY1
      },
      functionName: TRADE_EXECUTOR_FUNCTION,
      abiEntries,
      argsTemplate,
      builderCode: BUILDER_CODE || null,
      builderSuffixConfigured,
      builderDataSuffix: BUILDER_DATA_SUFFIX || null,
      usdcDeposit: {
        tokenAddress: USDC_BASE_ADDRESS || null,
        receiverAddress: USDC_DEPOSIT_RECEIVER || null,
        configured: !!(BASE_RPC_URL && USDC_BASE_ADDRESS && USDC_DEPOSIT_RECEIVER)
      }
    }
  });
}



