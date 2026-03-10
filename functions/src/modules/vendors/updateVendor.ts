import { onCall } from "firebase-functions/v2/https";
import { vendorsController } from "./controller";

export const updateVendor = onCall(async (request) => {
  return vendorsController.updateVendor(request);
});
