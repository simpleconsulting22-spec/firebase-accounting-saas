import { onCall } from "firebase-functions/v2/https";
import { vendorsController } from "./controller";

export const deleteCategory = onCall(async (request) => {
  return vendorsController.deleteCategory(request);
});
