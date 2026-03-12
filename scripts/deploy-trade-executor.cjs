const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const owner = process.env.TRADE_EXECUTOR_OWNER || deployer.address;
  const feeTreasury = process.env.FEE_TREASURY_ADDRESS || deployer.address;
  const feeBps = Number(process.env.TRADE_FEE_BPS || "100");

  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("FeeTreasury:", feeTreasury);
  console.log("FeeBps:", feeBps);

  const bal = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer ETH:", hre.ethers.formatEther(bal));

  const Factory = await hre.ethers.getContractFactory("TradeExecutor");
  const contract = await Factory.deploy(owner, feeTreasury, feeBps);
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("TradeExecutor deployed:", addr);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
