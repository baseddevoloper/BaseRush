export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const userId = String(body.userId || "guest");
  const profile = body.profile && typeof body.profile === "object" ? body.profile : {};

  res.status(200).json({
    ok: true,
    userId,
    profile: {
      bio: String(profile.bio || "").trim() || null
    }
  });
}

