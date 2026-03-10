"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const https_1 = require("firebase-functions/v2/https");
const authService_1 = require("../services/authService");
const requireAuth = async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Authentication is required.");
    }
    const userContext = await authService_1.authService.getUserContext(request.auth.uid);
    return Object.assign(request, { userContext });
};
exports.requireAuth = requireAuth;
