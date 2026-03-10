import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase";
export const frontendAuthService = {
    signIn(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    },
    signOut() {
        return signOut(auth);
    }
};
