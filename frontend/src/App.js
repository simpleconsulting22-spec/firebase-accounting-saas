import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import LoginPage from "./LoginPage";
import AppLayout from "./layouts/AppLayout";
import { UserProvider } from "./contexts/UserContext";
export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        return onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
    }, []);
    if (loading) {
        return (_jsx("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }, children: "Loading..." }));
    }
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: user ? _jsx(Navigate, { to: "/dashboard", replace: true }) : _jsx(LoginPage, {}) }), _jsx(Route, { path: "/*", element: user ? (_jsx(UserProvider, { uid: user.uid, email: user.email ?? "", children: _jsx(AppLayout, {}) })) : (_jsx(Navigate, { to: "/login", replace: true })) })] }) }));
}
