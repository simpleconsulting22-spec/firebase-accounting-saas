"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportStorageService = void 0;
const crypto_1 = require("crypto");
const firestore_1 = require("../utils/firestore");
exports.exportStorageService = {
    async uploadCsv(input) {
        const bucket = firestore_1.storage.bucket();
        const storagePath = `exports/${input.tenantId}/${input.organizationId}/${input.exportId}.csv`;
        const file = bucket.file(storagePath);
        const downloadToken = (0, crypto_1.randomUUID)();
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
