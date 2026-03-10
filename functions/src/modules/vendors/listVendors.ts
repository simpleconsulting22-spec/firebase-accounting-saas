import { onCall } from "firebase-functions/v2/https";
import { vendorsController } from "./controller";

export const listVendors = onCall(async (request) => {
  return vendorsController.listVendors(request);
});
