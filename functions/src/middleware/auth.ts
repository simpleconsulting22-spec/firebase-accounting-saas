import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { authService, AuthUserContext } from "../services/authService";

export interface AuthenticatedRequest<T = unknown> extends CallableRequest<T> {
  userContext: AuthUserContext;
}

export const requireAuth = async <T>(request: CallableRequest<T>): Promise<AuthenticatedRequest<T>> => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const userContext = await authService.getUserContext(request.auth.uid);
  return Object.assign(request, { userContext });
};
