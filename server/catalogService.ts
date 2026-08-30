import { getFirebaseFirestore } from "./firebaseAdmin";
import type { DocumentData } from "firebase-admin/firestore";
import { createHash } from "node:crypto";

export type CatalogStatus = "green" | "yellow" | "red";

export type CatalogItem = {
  id: string;
  name: string;
  defaultName: string;
  order: number;
  status: CatalogStatus;
  available: boolean;
  archived: boolean;
  version: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
};

export type CatalogNotification = {
  title: string;
  body: string;
  updatedAt: number;
};

export type CatalogManifest = {
  schemaVersion: 1;
  catalogVersion: number;
  publishedAt: number | null;
  items: CatalogItem[];
  notification: CatalogNotification | null;
  contentHash: string;
};

const ITEMS = "catalogItems";
const META = "catalogMeta";
const CURRENT = "current";
const HISTORY = "catalogHistory";

type UnsignedManifest = Omit<CatalogManifest, "contentHash">;

export function computeManifestHash(manifest: UnsignedManifest): string {
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

function withIntegrity(manifest: UnsignedManifest): CatalogManifest {
  return { ...manifest, contentHash: computeManifestHash(manifest) };
}

const initialItems: Omit<CatalogItem, "createdAt" | "updatedAt">[] = Array.from(
  { length: 6 },
  (_, index) => ({
    id: `initial-item-${String(index + 1).padStart(2, "0")}`,
    name: `Recurso inicial ${index + 1}`,
    defaultName: `Recurso inicial ${index + 1}`,
    order: index + 1,
    status: "green" as const,
    available: true,
    archived: false,
    version: "1.0.0",
    fileName: `initial-item-${String(index + 1).padStart(2, "0")}.package`,
  }),
);

function toItem(data: DocumentData): CatalogItem {
  return {
    id: String(data.id),
    name: String(data.name),
    defaultName: String(data.defaultName),
    order: Number(data.order ?? 0),
    status: data.status === "yellow" || data.status === "red" ? data.status : "green",
    available: Boolean(data.available),
    archived: Boolean(data.archived),
    version: String(data.version ?? "1.0.0"),
    fileName: String(data.fileName ?? ""),
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
  };
}

async function readItems(): Promise<CatalogItem[]> {
  const snapshot = await getFirebaseFirestore().collection(ITEMS).get();
  return snapshot.docs.map(doc => toItem(doc.data())).sort((a, b) => a.order - b.order);
}

export async function bootstrapCatalog() {
  const db = getFirebaseFirestore();
  const existing = await readItems();
  const existingIds = new Set(existing.map(item => item.id));
  const now = Date.now();
  const batch = db.batch();
  let created = 0;

  for (const item of initialItems) {
    if (existingIds.has(item.id)) continue;
    batch.set(db.collection(ITEMS).doc(item.id), { ...item, createdAt: now, updatedAt: now });
    created += 1;
  }

  if (created > 0) await batch.commit();
  return { created, total: existing.length + created };
}

export async function getAdminCatalog() {
  await bootstrapCatalog();
  return readItems();
}

export async function getManifest(): Promise<CatalogManifest> {
  const [items, metaSnapshot] = await Promise.all([
    readItems(),
    getFirebaseFirestore().collection(META).doc(CURRENT).get(),
  ]);
  const meta = metaSnapshot.exists ? metaSnapshot.data() : undefined;
  return withIntegrity({
    schemaVersion: 1,
    catalogVersion: Number(meta?.catalogVersion ?? 0),
    publishedAt: meta?.publishedAt ? Number(meta.publishedAt) : null,
    items: items.filter(item => !item.archived),
    notification: meta?.notification
      ? {
          title: String(meta.notification.title ?? ""),
          body: String(meta.notification.body ?? ""),
          updatedAt: Number(meta.notification.updatedAt ?? 0),
        }
      : null,
  });
}

export async function updateCatalogItem(
  id: string,
  patch: Pick<CatalogItem, "name" | "status" | "available" | "archived" | "order" | "version">,
) {
  const now = Date.now();
  const ref = getFirebaseFirestore().collection(ITEMS).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new Error("Catalog item not found");
  await ref.set({ ...patch, updatedAt: now }, { merge: true });
  return toItem({ ...existing.data(), ...patch, updatedAt: now, id });
}

export async function addCatalogItem(input: {
  id: string;
  name: string;
  version: string;
  fileName: string;
}) {
  const now = Date.now();
  const ref = getFirebaseFirestore().collection(ITEMS).doc(input.id);
  const existing = await ref.get();
  if (existing.exists) throw new Error("Catalog item already exists");
  const items = await readItems();
  const item: CatalogItem = {
    ...input,
    defaultName: input.name,
    order: items.length + 1,
    status: "green",
    available: true,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(item);
  return item;
}

export async function publishCatalog() {
  const db = getFirebaseFirestore();
  const current = await db.collection(META).doc(CURRENT).get();
  const previousVersion = Number(current.data()?.catalogVersion ?? 0);
  const nextVersion = previousVersion + 1;
  const now = Date.now();
  const manifest = await getManifest();
  const next = withIntegrity({
    schemaVersion: manifest.schemaVersion,
    catalogVersion: nextVersion,
    publishedAt: now,
    items: manifest.items,
    notification: manifest.notification,
  });

  await db.collection(META).doc(CURRENT).set(next, { merge: true });
  await db.collection(HISTORY).doc(String(nextVersion)).set(next);
  return next;
}

export async function saveNotification(title: string, body: string) {
  const notification = { title, body, updatedAt: Date.now() };
  await getFirebaseFirestore().collection(META).doc(CURRENT).set({ notification }, { merge: true });
  return notification;
}

export async function getCatalogHistory() {
  const snapshot = await getFirebaseFirestore().collection(HISTORY).get();
  return snapshot.docs
    .map(doc => doc.data() as CatalogManifest)
    .sort((a, b) => b.catalogVersion - a.catalogVersion);
}

export { initialItems };
