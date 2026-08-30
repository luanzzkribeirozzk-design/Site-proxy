import type { VercelRequest, VercelResponse } from "@vercel/node";

function classifyManifestError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("not configured")) return "credential_missing";
  if (message.includes("not valid json") || message.includes("unexpected token")) return "credential_invalid_json";
  if (message.includes("incomplete") || message.includes("private key")) return "credential_invalid";
  if (message.includes("permission") || message.includes("unauthenticated") || message.includes("forbidden")) return "firestore_permission";
  if (message.includes("timeout") || message.includes("econn") || message.includes("network")) return "firestore_network";
  return "firestore_request_failed";
}

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
      const errorKind = classifyManifestError(error);
      console.error("[Catalog] Manifest read failed", errorKind);
      if (req.query?.diagnostic === "1" || url.includes("diagnostic=1")) {
        return res.status(503).json({ error: "manifest_unavailable", errorKind });
      }
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
