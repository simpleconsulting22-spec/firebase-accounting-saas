import { onCall } from "firebase-functions/v2/https";
import { vendorsController } from "./controller";

export const updateCategory = onCall(async (request) => {
  return vendorsController.updateCategory(request);
});
