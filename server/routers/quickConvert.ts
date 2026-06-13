import { z } from "zod/v4";
import { protectedProcedure, router } from "../_core/trpc";
import {
  QUICK_CONVERT_KINDS,
  toolTabForQuickConvertKind,
  validateQuickConvertUpload,
} from "@shared/quickConvert";
import {
  getQuickConvertConverterStatus,
  loadQuickConvertSourceBytes,
  processQuickConvertBinary,
} from "../services/quickConvert";
import { assertCanReadStoredFile } from "../fileAccess";

const kindSchema = z.enum(QUICK_CONVERT_KINDS);

export const quickConvertRouter = router({
  status: protectedProcedure.query(async () => {
    const status = await getQuickConvertConverterStatus();
    return {
      ...status,
      maxUploadMb: 25,
      supportedExtensions: [".pdf", ".doc", ".docx"],
    };
  }),

  processUploaded: protectedProcedure
    .input(
      z.object({
        kind: kindSchema,
        filename: z.string().min(1).max(260),
        mimeType: z.string().min(1).max(120),
        dataBase64: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bytes = Buffer.from(input.dataBase64, "base64");
      const validation = validateQuickConvertUpload({
        filename: input.filename,
        mimeType: input.mimeType,
        byteLength: bytes.length,
      });
      if (!validation.ok) {
        return { success: false as const, error: validation.error };
      }

      if (toolTabForQuickConvertKind(input.kind)) {
        return {
          success: false as const,
          error: "Upload the file in the portal, then run AI prefill for this workflow.",
          code: "USE_PORTAL_WORKFLOW",
        };
      }

      return processQuickConvertBinary({
        kind: input.kind,
        filename: input.filename,
        bytes,
      });
    }),

  processStoredFile: protectedProcedure
    .input(
      z.object({
        kind: kindSchema,
        fileUrl: z.string().min(1),
        filename: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (toolTabForQuickConvertKind(input.kind)) {
        return {
          success: false as const,
          error: "Use portal AI prefill for document extraction workflows.",
          code: "USE_PORTAL_WORKFLOW",
        };
      }

      try {
        await assertCanReadStoredFile(ctx.user, input.fileUrl);
        const { bytes, filename: inferred } = await loadQuickConvertSourceBytes(input.fileUrl);
        const filename = input.filename || inferred;
        const validation = validateQuickConvertUpload({
          filename,
          mimeType: "",
          byteLength: bytes.length,
        });
        if (!validation.ok) {
          return { success: false as const, error: validation.error };
        }
        return processQuickConvertBinary({ kind: input.kind, filename, bytes });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false as const, error: msg };
      }
    }),
});
