"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorsModuleService = void 0;
const vendorService_1 = require("../../services/vendorService");
exports.vendorsModuleService = {
    listVendorsForOrganization: vendorService_1.vendorService.listVendorsForOrganization,
    createVendor: vendorService_1.vendorService.createVendor,
    updateVendor: vendorService_1.vendorService.updateVendor,
    deleteVendor: vendorService_1.vendorService.deleteVendor,
    listCategoriesForOrganization: vendorService_1.vendorService.listCategoriesForOrganization,
    createCategory: vendorService_1.vendorService.createCategory,
    updateCategory: vendorService_1.vendorService.updateCategory,
    deleteCategory: vendorService_1.vendorService.deleteCategory
};
