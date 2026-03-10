"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    code;
    status;
    constructor(message, code = "app/error", status = 400) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
