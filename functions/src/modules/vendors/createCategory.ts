import { onCall } from "firebase-functions/v2/https";
import { vendorsController } from "./controller";

export const createCategory = onCall(async (request) => {
  return vendorsController.createCategory(request);
});
