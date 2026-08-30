import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { getManifest } from "../server/catalogService";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    runtime: process.env.VERCEL ? "vercel" : "local",
    firebaseAdminConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
  });
});

app.get("/api/catalog/manifest", async (_req, res) => {
  try {
    res.json(await getManifest());
  } catch (error) {
    console.error("[Catalog] Manifest read failed", error);
    res.status(503).json({ error: "manifest_unavailable" });
  }
});

let fullAppPromise: Promise<express.Express> | undefined;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.url?.startsWith("/api/health") || req.url?.startsWith("/api/catalog/manifest")) {
    return app(req, res);
  }

  fullAppPromise ??= import("../server/_core/index").then(module => module.createApp());
  const fullApp = await fullAppPromise;
  return fullApp(req, res);
}
