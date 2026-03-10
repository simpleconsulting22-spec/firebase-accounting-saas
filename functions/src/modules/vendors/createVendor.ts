import { onCall } from "firebase-functions/v2/https";
import { vendorsController } from "./controller";

export const createVendor = onCall(async (request) => {
  return vendorsController.createVendor(request);
});
