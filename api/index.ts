import { createHash, createSign, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type CatalogItem = {
  id: string;
  name: string;
  defaultName: string;
  order: number;
  status: "green" | "yellow" | "red";
  available: boolean;
  archived: boolean;
  version: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
};

const fallbackItems: CatalogItem[] = Array.from({ length: 6 }, (_, index) => ({
  id: `initial-item-${String(index + 1).padStart(2, "0")}`,
  name: `Recurso inicial ${index + 1}`,
  defaultName: `Recurso inicial ${index + 1}`,
  order: index + 1,
  status: "green" as const,
  available: true,
  archived: false,
  version: "1.0.0",
  fileName: `initial-item-${String(index + 1).padStart(2, "0")}.package`,
  createdAt: 0,
  updatedAt: 0,
}));

let accessToken: { value: string; expiresAt: number } | undefined;

function ownerKeyMatches(provided: unknown) {
  const configured = process.env.OWNER_PANEL_KEY;
  if (typeof provided !== "string" || !configured) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requestBody(req: VercelRequest): Record<string, unknown> {
  if (typeof req.body === "object" && req.body !== null) return req.body as Record<string, unknown>;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

function serviceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("firebase_service_account_missing");
  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) throw new Error("firebase_service_account_invalid");
  return {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

async function tokenFor(account: ServiceAccount) {
  if (accessToken && accessToken.expiresAt > Date.now() + 60_000) return accessToken.value;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64Url(signature)}`,
    }),
  });
  if (!response.ok) throw new Error(`firebase_token_${response.status}`);
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("firebase_token_missing");
  accessToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

async function firestoreGet(path: string, account: ServiceAccount) {
  const token = await tokenFor(account);
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents/${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`firestore_get_${response.status}`);
  return await response.json() as Record<string, unknown>;
}

function firestoreValue(value: Record<string, unknown>): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return Date.parse(String(value.timestampValue));
  if ("mapValue" in value) {
    const fields = (value.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([key, child]) => [key, firestoreValue(child)]));
  }
  if ("arrayValue" in value) return ((value.arrayValue as { values?: Record<string, unknown>[] }).values ?? []).map(firestoreValue);
  return null;
}

function itemFromDocument(document: { name: string; fields?: Record<string, Record<string, unknown>> }): CatalogItem {
  const fields = Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, firestoreValue(value)]));
  const id = String(fields.id ?? document.name.split("/").pop() ?? "");
  return {
    id,
    name: String(fields.name ?? id),
    defaultName: String(fields.defaultName ?? fields.name ?? id),
    order: Number(fields.order ?? 0),
    status: fields.status === "yellow" || fields.status === "red" ? fields.status : "green",
    available: Boolean(fields.available),
    archived: Boolean(fields.archived),
    version: String(fields.version ?? "1.0.0"),
    fileName: String(fields.fileName ?? ""),
    createdAt: Number(fields.createdAt ?? 0),
    updatedAt: Number(fields.updatedAt ?? 0),
  };
}

async function getManifest() {
  const account = serviceAccount();
  const [itemsDocument, metaDocument] = await Promise.all([
    firestoreGet("catalogItems?pageSize=100", account),
    firestoreGet("catalogMeta/current", account),
  ]);
  const documents = Array.isArray(itemsDocument?.documents) ? itemsDocument.documents as { name: string; fields?: Record<string, Record<string, unknown>> }[] : [];
  const items = (documents.length ? documents.map(itemFromDocument) : fallbackItems).sort((a, b) => a.order - b.order);
  const metaFields = metaDocument?.fields as Record<string, Record<string, unknown>> | undefined;
  const meta = metaFields ? Object.fromEntries(Object.entries(metaFields).map(([key, value]) => [key, firestoreValue(value)])) : {};
  const notification = meta.notification && typeof meta.notification === "object" ? meta.notification as { title?: unknown; body?: unknown; updatedAt?: unknown } : null;
  const unsigned = {
    schemaVersion: 1 as const,
    catalogVersion: Number(meta.catalogVersion ?? 0),
    publishedAt: meta.publishedAt ? Number(meta.publishedAt) : null,
    items: items.filter(item => !item.archived),
    notification: notification ? {
      title: String(notification.title ?? ""),
      body: String(notification.body ?? ""),
      updatedAt: Number(notification.updatedAt ?? 0),
    } : null,
  };
  return { ...unsigned, contentHash: createHash("sha256").update(JSON.stringify(unsigned)).digest("hex") };
}

function errorKind(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("token_401") || message.includes("token_403")) return "firebase_token_rejected";
  if (message.includes("firestore_get_403")) return "firestore_permission";
  if (message.includes("firestore_get_404")) return "firestore_database_missing";
  if (message.includes("firebase_service_account")) return "credential_invalid";
  return "firestore_request_failed";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url ?? "/";
  if (url.startsWith("/api/owner/verify")) {
    const body = requestBody(req);
    return res.status(200).json({ authorized: ownerKeyMatches(body.key) });
  }
  if (url.startsWith("/api/health")) {
    let validJson = false;
    let projectMatches = false;
    try {
      const account = serviceAccount();
      validJson = true;
      projectMatches = account.project_id === "proxy-5f82e";
    } catch {
      // Intentionally return only booleans; never expose credential contents.
    }
    return res.status(200).json({ ok: true, runtime: process.env.VERCEL ? "vercel" : "local", firebaseAdminConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON), firebaseAdminJsonValid: validJson, firebaseProjectMatches: projectMatches });
  }
  if (url.startsWith("/api/catalog/manifest")) {
    try {
      return res.status(200).json(await getManifest());
    } catch (error) {
      const diagnostic = req.query?.diagnostic === "1" || url.includes("diagnostic=1");
      return res.status(503).json(diagnostic ? { error: "manifest_unavailable", errorKind: errorKind(error) } : { error: "manifest_unavailable" });
    }
  }
  return res.status(404).json({ error: "not_found" });
}
