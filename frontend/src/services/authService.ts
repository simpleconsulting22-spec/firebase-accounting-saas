import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase";

export const frontendAuthService = {
  signIn(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  },
  signOut() {
    return signOut(auth);
  }
};
