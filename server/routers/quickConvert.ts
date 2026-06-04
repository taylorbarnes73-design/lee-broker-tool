import { z } from "zod/v4";
import { publicProcedure, router } from "../_core/trpc";
import { QUICK_CONVERT_KINDS, validateQuickConvertUpload } from "@shared/quickConvert";
import {
  getQuickConvertConverterStatus,
  loadQuickConvertSourceBytes,
  processQuickConvertBinary,
} from "../services/quickConvert";

const kindSchema = z.enum(QUICK_CONVERT_KINDS);

export const quickConvertRouter = router({
  status: publicProcedure.query(async () => {
    const status = await getQuickConvertConverterStatus();
    return {
      ...status,
      maxUploadMb: 25,
      supportedExtensions: [".pdf", ".doc", ".docx"],
    };
  }),

  processUploaded: publicProcedure
    .input(
      z.object({
        kind: kindSchema,
        filename: z.string().min(1).max(260),
        mimeType: z.string().min(1).max(120),
        dataBase64: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const bytes = Buffer.from(input.dataBase64, "base64");
      const validation = validateQuickConvertUpload({
        filename: input.filename,
        mimeType: input.mimeType,
        byteLength: bytes.length,
      });
      if (!validation.ok) {
        return { success: false as const, error: validation.error };
      }

      if (input.kind === "lease_to_voucher" || input.kind === "exclusive_to_sign") {
        return {
          success: false as const,
          error: "Upload the file in the portal, then run AI prefill (lease→voucher / exclusive→sign).",
          code: "USE_PORTAL_WORKFLOW",
        };
      }

      return processQuickConvertBinary({
        kind: input.kind,
        filename: input.filename,
        bytes,
      });
    }),

  processStoredFile: publicProcedure
    .input(
      z.object({
        kind: kindSchema,
        fileUrl: z.string().min(1),
        filename: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.kind === "lease_to_voucher" || input.kind === "exclusive_to_sign") {
        return {
          success: false as const,
          error: "Use portal AI prefill for lease→voucher and exclusive→sign.",
          code: "USE_PORTAL_WORKFLOW",
        };
      }

      try {
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
