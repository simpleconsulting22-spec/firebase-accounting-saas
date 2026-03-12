import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
const UserContext = createContext(null);
export function UserProvider({ uid, email, children }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeOrgId, setActiveOrgId] = useState("");
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const snap = await getDoc(doc(db, "users", uid));
                if (cancelled)
                    return;
                if (!snap.exists()) {
                    setError("User profile not found. Contact an administrator.");
                    setLoading(false);
                    return;
                }
                const data = snap.data();
                const orgRoles = data.orgRoles || {};
                const orgIds = Object.keys(orgRoles).filter((k) => k !== "*");
                setProfile({ uid, email, tenantId: data.tenantId, orgRoles, orgIds });
                setActiveOrgId(orgIds[0] || "");
            }
            catch (err) {
                if (!cancelled)
                    setError("Failed to load user profile.");
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [uid, email]);
    const getRoles = () => {
        if (!profile || !activeOrgId)
            return [];
        return [
            ...(profile.orgRoles[activeOrgId] || []),
            ...(profile.orgRoles["*"] || []),
        ];
    };
    const hasRole = (role) => {
        const roles = getRoles();
        return roles.includes(role) || roles.includes("admin");
    };
    const isAdmin = hasRole("admin");
    const canApprove = isAdmin || hasRole("approver");
    const canRequestExpense = isAdmin || hasRole("requestor");
    const canFinanceReview = isAdmin || hasRole("finance");
    return (_jsx(UserContext.Provider, { value: { profile, loading, error, activeOrgId, setActiveOrgId, hasRole, isAdmin, canApprove, canRequestExpense, canFinanceReview }, children: children }));
}
export function useUserContext() {
    const ctx = useContext(UserContext);
    if (!ctx)
        throw new Error("useUserContext must be used inside UserProvider");
    return ctx;
}
