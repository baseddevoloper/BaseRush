const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
const userId = process.env.SMOKE_USER_ID || "u2";
const leaderId = process.env.SMOKE_LEADER_ID || "u1";
const token = process.env.SMOKE_TOKEN || "AERO";
const side = process.env.SMOKE_SIDE || "buy";
const usdc = Number(process.env.SMOKE_USDC || "10");

async function main() {
  const res = await fetch(`${baseUrl}/api/onchain/smoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, leaderId, token, side, usdc })
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    console.error("Smoke failed:", body);
    process.exit(1);
  }

  const mode = body?.mode || "unknown";
  const tx = body?.result?.onchain?.txHash || body?.result?.onchain?.status;
  console.log(`Smoke success (${mode}) -> ${tx}`);
}

main().catch((err) => {
  console.error("Smoke error:", err?.message || err);
  process.exit(1);
});
