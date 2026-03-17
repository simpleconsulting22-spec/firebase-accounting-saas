import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "./firebase";
const googleProvider = new GoogleAuthProvider();
export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError("");
        try {
            await signInWithPopup(auth, googleProvider);
        }
        catch (err) {
            // Ignore user-cancelled popups
            if (err.code !== "auth/popup-closed-by-user" &&
                err.code !== "auth/cancelled-popup-request") {
                setError(err.message || "Sign-in failed. Please try again.");
            }
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-base-200", children: _jsx("div", { className: "card w-96 bg-base-100 shadow-xl", children: _jsxs("div", { className: "card-body", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("div", { className: "text-4xl mb-2", children: "\uD83D\uDCBC" }), _jsx("h2", { className: "text-2xl font-bold", children: "Expense Workflow" }), _jsx("p", { className: "text-base-content/60 text-sm mt-1", children: "CityLight & Glow Church Finance" })] }), error && (_jsx("div", { className: "alert alert-error text-sm mb-4", children: _jsx("span", { children: error }) })), _jsxs("button", { className: "btn btn-primary w-full gap-2", onClick: handleGoogleSignIn, disabled: loading, children: [loading ? (_jsx("span", { className: "loading loading-spinner loading-sm" })) : (_jsxs("svg", { className: "w-5 h-5", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", children: [_jsx("path", { d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z", fill: "#4285F4" }), _jsx("path", { d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z", fill: "#34A853" }), _jsx("path", { d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z", fill: "#FBBC05" }), _jsx("path", { d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z", fill: "#EA4335" })] })), "Sign in with Google"] }), _jsxs("p", { className: "text-center text-xs text-base-content/40 mt-4", children: ["Access is controlled by your administrator.", _jsx("br", {}), "Contact them if you cannot sign in."] })] }) }) }));
}
