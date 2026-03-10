import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../firebase";

const functions = getFunctions(undefined, "us-central1");

export const apiClient = {
  async call<TInput, TOutput>(name: string, payload: TInput): Promise<TOutput> {
    if (!auth.currentUser) {
      throw new Error("Authentication required.");
    }

    const callable = httpsCallable<TInput, TOutput>(functions, name);
    const result = await callable(payload);
    return result.data;
  }
};
