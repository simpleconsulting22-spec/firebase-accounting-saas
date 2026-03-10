import { apiClient } from "../../services/apiClient";
export const vendorsApi = {
    listVendors(payload) {
        return apiClient.call("listVendors", payload);
    },
    createVendor(payload) {
        return apiClient.call("createVendor", payload);
    },
    updateVendor(payload) {
        return apiClient.call("updateVendor", payload);
    },
    deleteVendor(payload) {
        return apiClient.call("deleteVendor", payload);
    },
    listCategories(payload) {
        return apiClient.call("listCategories", payload);
    },
    createCategory(payload) {
        return apiClient.call("createCategory", payload);
    },
    updateCategory(payload) {
        return apiClient.call("updateCategory", payload);
    },
    deleteCategory(payload) {
        return apiClient.call("deleteCategory", payload);
    }
};
