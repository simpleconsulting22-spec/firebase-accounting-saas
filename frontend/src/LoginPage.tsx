import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "./firebase";

export default function LoginPage() {
  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Check the console for details.");
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f3f4f6", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "white", padding: "48px 40px", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.1)", width: 360, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#111827" }}>Expense Workflow</h2>
        <p style={{ color: "#6b7280", marginBottom: 32, fontSize: 14 }}>CityLight &amp; Glow Church Finance</p>
        <button
          onClick={login}
          style={{ width: "100%", padding: "12px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
