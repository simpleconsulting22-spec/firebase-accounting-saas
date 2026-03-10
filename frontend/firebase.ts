import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBSHOlKLA4DQR3jEvyXsvo4LQoyk3ZSSg",
  authDomain: "expense-workflow-platform.firebaseapp.com",
  projectId: "expense-workflow-platform",
  storageBucket: "expense-workflow-platform.firebasestorage.app",
  messagingSenderId: "939707730493",
  appId: "1:939707730493:web:a49536ff1212d253443854"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
