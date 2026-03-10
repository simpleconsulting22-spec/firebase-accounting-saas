import { onCall } from "firebase-functions/v2/https";
import { vendorsController } from "./controller";

export const listCategories = onCall(async (request) => {
  return vendorsController.listCategories(request);
});
