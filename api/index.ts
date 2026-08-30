import type { VercelRequest, VercelResponse } from "@vercel/node";

function getServiceAccountConfigStatus() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return { configured: false, validJson: false, projectMatches: false };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      configured: true,
      validJson: Boolean(parsed.project_id && parsed.client_email && parsed.private_key),
      projectMatches: parsed.project_id === "proxy-5f82e",
    };
  } catch {
    return { configured: true, validJson: false, projectMatches: false };
  }
}

function classifyManifestError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code).toLowerCase()
    : "";
  const signal = `${code} ${message}`;
  if (signal.includes("not configured")) return "credential_missing";
  if (signal.includes("not valid json") || signal.includes("unexpected token") || signal.includes("json") || signal.includes("invalid-credential")) return "credential_invalid_json";
  if (signal.includes("incomplete") || signal.includes("private key") || signal.includes("invalid-credential")) return "credential_invalid";
  if (signal.includes("permission") || signal.includes("unauthenticated") || signal.includes("forbidden") || signal.includes("permission-denied") || signal.includes("7")) return "firestore_permission";
  if (signal.includes("timeout") || signal.includes("econn") || signal.includes("network") || signal.includes("unavailable") || signal.includes("14")) return "firestore_network";
  if (signal.includes("not-found") || signal.includes("not found") || signal.includes(" 5")) return "firestore_database_missing";
  return "firestore_request_failed";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url ?? "/";

  if (url.startsWith("/api/health")) {
    const serviceAccount = getServiceAccountConfigStatus();
    return res.status(200).json({
      ok: true,
      runtime: process.env.VERCEL ? "vercel" : "local",
      firebaseAdminConfigured: serviceAccount.configured,
      firebaseAdminJsonValid: serviceAccount.validJson,
      firebaseProjectMatches: serviceAccount.projectMatches,
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
