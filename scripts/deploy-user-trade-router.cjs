const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const owner = process.env.USER_TRADE_ROUTER_OWNER || deployer.address;
  const feeTreasury = process.env.FEE_TREASURY_ADDRESS || deployer.address;
  const feeBps = Number(process.env.TRADE_FEE_BPS || "100");

  const uniswapRouter = process.env.UNISWAP_V3_ROUTER || "0x2626664c2603336E57B271c5C0b26F421741e481";
  const aerodromeRouter = process.env.AERODROME_ROUTER || "0xcf77a3ba9a5ca399b7c97c74d54e5be8d5e8f9f3";
  const aerodromeFactory = process.env.AERODROME_FACTORY || "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";
  const defaultUniPoolFee = Number(process.env.DEFAULT_UNI_POOL_FEE || "500");
  const universalRouterV2 = process.env.UNISWAP_V4_UNIVERSAL_ROUTER || "0x6ff5693b99212da76ad316178a184ab56d299b43";
  const permit2 = process.env.UNISWAP_PERMIT2 || "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  const wrappedNativeToken = process.env.WRAPPED_NATIVE_TOKEN || "0x4200000000000000000000000000000000000006";
  const autoUnwrapNativeOut = String(process.env.AUTO_UNWRAP_NATIVE_OUT || "true").toLowerCase() === "true";

  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("FeeTreasury:", feeTreasury);
  console.log("FeeBps:", feeBps);
  console.log("UniswapV3Router:", uniswapRouter);
  console.log("AerodromeRouter:", aerodromeRouter);
  console.log("AerodromeFactory:", aerodromeFactory);
  console.log("DefaultUniPoolFee:", defaultUniPoolFee);
  console.log("UniversalRouterV2:", universalRouterV2);
  console.log("Permit2:", permit2);
  console.log("WrappedNativeToken:", wrappedNativeToken);
  console.log("AutoUnwrapNativeOut:", autoUnwrapNativeOut);

  const bal = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer ETH:", hre.ethers.formatEther(bal));

  const Factory = await hre.ethers.getContractFactory("UserTradeRouter");
  const contract = await Factory.deploy(
    owner,
    feeTreasury,
    feeBps,
    uniswapRouter,
    aerodromeRouter,
    aerodromeFactory,
    defaultUniPoolFee,
    universalRouterV2,
    permit2,
    wrappedNativeToken,
    autoUnwrapNativeOut
  );
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("UserTradeRouter deployed:", addr);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
