import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const isDev = import.meta.env.DEV;

const firebaseConfig = {
  apiKey: "AIzaSyBSuH6oKlA4DQR3jEvyXsvo4LQoyk3ZSSg",
  authDomain: "expense-workflow-platform.firebaseapp.com",
  projectId: isDev ? "demo-project" : "expense-workflow-platform",
  storageBucket: "expense-workflow-platform.firebasestorage.app",
  messagingSenderId: "939707730493",
  appId: "1:939707730493:web:a49536ff1212d253443854",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// In dev, route all emulator traffic through Vite's proxy so the browser
// never needs to reach localhost:8080/9099/etc. directly — those ports are
// only reachable server-side (on the workstation), not from the user's browser.
export const db = isDev
  ? initializeFirestore(app, {
      host: window.location.host,          // Vite dev server (proxies to :8080)
      ssl: location.protocol === "https:",  // match page protocol
      experimentalAutoDetectLongPolling: true,
    })
  : initializeFirestore(app, {});

if (isDev) {
  const origin = window.location.origin;

  // Auth — proxied via /identitytoolkit.googleapis.com
  connectAuthEmulator(auth, origin, { disableWarnings: true });

  // Functions — patch emulatorOrigin so callables go to /demo-project/...
  // which Vite proxies to localhost:5001
  (functions as any).emulatorOrigin = origin;

  // Storage — patch host + protocol so upload/download go through Vite proxy
  const s = storage as any;
  s.host = window.location.host;
  s.protocol = location.protocol.replace(":", "");
}
