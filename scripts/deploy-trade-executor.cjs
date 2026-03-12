const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const owner = process.env.TRADE_EXECUTOR_OWNER || deployer.address;
  const feeTreasury = process.env.FEE_TREASURY_ADDRESS || deployer.address;
  const feeBps = Number(process.env.TRADE_FEE_BPS || "100");

  const usdc = process.env.USDC_BASE_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const uniswapRouter = process.env.UNISWAP_V3_ROUTER || "0x2626664c2603336E57B271c5C0b26F421741e481";
  const aerodromeRouter = process.env.AERODROME_ROUTER || "0xcF77a3Ba9A5CA399B7c97c74d54e5bE8D5e8f9F3";
  const aerodromeFactory = process.env.AERODROME_FACTORY || "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";
  const defaultUniPoolFee = Number(process.env.DEFAULT_UNI_POOL_FEE || "500");

  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("FeeTreasury:", feeTreasury);
  console.log("FeeBps:", feeBps);
  console.log("USDC:", usdc);
  console.log("UniswapV3Router:", uniswapRouter);
  console.log("AerodromeRouter:", aerodromeRouter);
  console.log("AerodromeFactory:", aerodromeFactory);
  console.log("DefaultUniPoolFee:", defaultUniPoolFee);

  const bal = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer ETH:", hre.ethers.formatEther(bal));

  const Factory = await hre.ethers.getContractFactory("TradeExecutor");
  const contract = await Factory.deploy(
    owner,
    feeTreasury,
    feeBps,
    usdc,
    uniswapRouter,
    aerodromeRouter,
    aerodromeFactory,
    defaultUniPoolFee
  );
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("TradeExecutor deployed:", addr);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
