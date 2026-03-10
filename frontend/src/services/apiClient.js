import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../firebase";
const functions = getFunctions(undefined, "us-central1");
export const apiClient = {
    async call(name, payload) {
        if (!auth.currentUser) {
            throw new Error("Authentication required.");
        }
        const callable = httpsCallable(functions, name);
        const result = await callable(payload);
        return result.data;
    }
};
