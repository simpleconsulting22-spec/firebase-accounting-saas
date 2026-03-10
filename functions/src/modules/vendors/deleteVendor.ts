import { onCall } from "firebase-functions/v2/https";
import { vendorsController } from "./controller";

export const deleteVendor = onCall(async (request) => {
  return vendorsController.deleteVendor(request);
});
