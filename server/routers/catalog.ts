import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import {
  addCatalogItem,
  bootstrapCatalog,
  getAdminCatalog,
  getCatalogHistory,
  getManifest,
  publishCatalog,
  saveNotification,
  updateCatalogItem,
} from "../catalogService";

const status = z.enum(["green", "yellow", "red"]);

export const catalogRouter = router({
  manifest: publicProcedure.query(() => getManifest()),
  list: adminProcedure.query(() => getAdminCatalog()),
  bootstrap: adminProcedure.mutation(() => bootstrapCatalog()),
  update: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(120),
        status,
        available: z.boolean(),
        archived: z.boolean(),
        order: z.number().int().min(1),
        version: z.string().trim().min(1).max(40),
      }),
    )
    .mutation(({ input }) => updateCatalogItem(input.id, input)),
  add: adminProcedure
    .input(
      z.object({
        id: z.string().trim().regex(/^[a-z0-9-]+$/),
        name: z.string().trim().min(1).max(120),
        version: z.string().trim().min(1).max(40),
        fileName: z.string().trim().min(1).max(255),
      }),
    )
    .mutation(({ input }) => addCatalogItem(input)),
  publish: adminProcedure.mutation(() => publishCatalog()),
  history: adminProcedure.query(() => getCatalogHistory()),
  notify: adminProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(100),
        body: z.string().trim().min(1).max(500),
      }),
    )
    .mutation(({ input }) => saveNotification(input.title, input.body)),
});
