import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "./firebase";
export default function LoginPage() {
    const login = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        }
        catch (error) {
            console.error("Login failed:", error);
            alert("Login failed. Check the console for details.");
        }
    };
    return (_jsx("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f3f4f6", fontFamily: "system-ui, sans-serif" }, children: _jsxs("div", { style: { background: "white", padding: "48px 40px", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.1)", width: 360, textAlign: "center" }, children: [_jsx("div", { style: { fontSize: 40, marginBottom: 12 }, children: "\uD83D\uDCBC" }), _jsx("h2", { style: { margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#111827" }, children: "Expense Workflow" }), _jsx("p", { style: { color: "#6b7280", marginBottom: 32, fontSize: 14 }, children: "CityLight & Glow Church Finance" }), _jsx("button", { onClick: login, style: { width: "100%", padding: "12px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }, children: "Sign in with Google" })] }) }));
}
