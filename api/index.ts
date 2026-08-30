import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url ?? "/";

  if (url.startsWith("/api/health")) {
    return res.status(200).json({
      ok: true,
      runtime: process.env.VERCEL ? "vercel" : "local",
      firebaseAdminConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    });
  }

  if (url.startsWith("/api/catalog/manifest")) {
    try {
      const { getManifest } = await import("../server/catalogService");
      return res.status(200).json(await getManifest());
    } catch (error) {
      console.error("[Catalog] Manifest read failed", error);
      return res.status(503).json({ error: "manifest_unavailable" });
    }
  }

  try {
    const { createApp } = await import("../server/_core/index");
    const app = await createApp();
    return app(req, res);
  } catch (error) {
    console.error("[API] App initialization failed", error);
    return res.status(500).json({ error: "api_unavailable" });
  }
}
