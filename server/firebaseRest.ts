import { createHash, createSign } from "node:crypto";

export type RestCatalogItem = {
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

export type RestManifest = {
  schemaVersion: 1;
  catalogVersion: number;
  publishedAt: number | null;
  items: RestCatalogItem[];
  notification: { title: string; body: string; updatedAt: number } | null;
  contentHash: string;
};

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const initialItems: RestCatalogItem[] = Array.from({ length: 6 }, (_, index) => ({
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

function account(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("firebase_service_account_missing");
  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("firebase_service_account_invalid");
  }
  return {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

let accessToken: { value: string; expiresAt: number } | undefined;

async function getAccessToken(serviceAccount: ServiceAccount) {
  if (accessToken && accessToken.expiresAt > Date.now() + 60_000) return accessToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(serviceAccount.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`firebase_token_${response.status}`);
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("firebase_token_missing");
  accessToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

function valueOf(value: Record<string, unknown>): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return Date.parse(String(value.timestampValue));
  if ("mapValue" in value) {
    const fields = (value.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([key, child]) => [key, valueOf(child)]));
  }
  if ("arrayValue" in value) {
    const values = (value.arrayValue as { values?: Record<string, unknown>[] }).values ?? [];
    return values.map(valueOf);
  }
  return null;
}

function itemFromDocument(document: { name: string; fields?: Record<string, Record<string, unknown>> }): RestCatalogItem {
  const fields = Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, valueOf(value)]));
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

async function firestoreGet(path: string, serviceAccount: ServiceAccount) {
  const token = await getAccessToken(serviceAccount);
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents/${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`firestore_get_${response.status}`);
  return await response.json() as Record<string, unknown>;
}

export async function getRestManifest(): Promise<RestManifest> {
  const serviceAccount = account();
  const [itemsDocument, metaDocument] = await Promise.all([
    firestoreGet("catalogItems?pageSize=100", serviceAccount),
    firestoreGet("catalogMeta/current", serviceAccount),
  ]);
  const documents = Array.isArray(itemsDocument?.documents) ? itemsDocument.documents as { name: string; fields?: Record<string, Record<string, unknown>> }[] : [];
  const items = (documents.length > 0 ? documents.map(itemFromDocument) : initialItems).sort((a, b) => a.order - b.order);
  const metaFields = metaDocument?.fields as Record<string, Record<string, unknown>> | undefined;
  const meta = metaFields ? Object.fromEntries(Object.entries(metaFields).map(([key, value]) => [key, valueOf(value)])) : {};
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

export { initialItems, valueOf };
