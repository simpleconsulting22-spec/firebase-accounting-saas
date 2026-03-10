import { randomUUID } from "crypto";
import { storage } from "../utils/firestore";

export interface UploadExportCsvInput {
  tenantId: string;
  organizationId: string;
  exportId: string;
  csvContent: string;
}

export interface UploadExportCsvResult {
  storagePath: string;
  fileUrl: string;
}

export const exportStorageService = {
  async uploadCsv(input: UploadExportCsvInput): Promise<UploadExportCsvResult> {
    const bucket = storage.bucket();
    const storagePath = `exports/${input.tenantId}/${input.organizationId}/${input.exportId}.csv`;
    const file = bucket.file(storagePath);
    const downloadToken = randomUUID();

    await file.save(input.csvContent, {
      contentType: "text/csv; charset=utf-8",
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: downloadToken
        }
      }
    });

    const encodedPath = encodeURIComponent(storagePath);
    const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return {
      storagePath,
      fileUrl
    };
  }
};
