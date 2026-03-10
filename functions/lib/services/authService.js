"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const firestore_1 = require("../utils/firestore");
const collections_1 = require("../config/collections");
const errors_1 = require("../utils/errors");
exports.authService = {
    async getUserContext(uid) {
        const snap = await firestore_1.db.collection(collections_1.COLLECTIONS.users).doc(uid).get();
        if (!snap.exists) {
            throw new errors_1.AppError("User profile not found", "auth/user-not-found", 403);
        }
        const data = snap.data();
        return {
            uid,
            email: data.email,
            tenantId: data.tenantId,
            orgRoles: data.orgRoles || {}
        };
    }
};
