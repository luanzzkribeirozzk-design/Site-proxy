import { timingSafeEqual } from "node:crypto";

export function isOwnerPanelKeyValid(provided: string | undefined, configured = process.env.OWNER_PANEL_KEY) {
  if (!provided || !configured) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
}
