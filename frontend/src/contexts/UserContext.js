import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { api } from "../workflow/api";
import { ORG_NAMES } from "../workflow/constants";
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
                let snap = await getDoc(doc(db, "users", uid));
                if (cancelled)
                    return;
                if (!snap.exists()) {
                    // First Google login — provision the UID-keyed doc via backend
                    try {
                        await api.resolveGoogleLogin();
                    }
                    catch (err) {
                        if (!cancelled) {
                            // Firebase Functions errors: prefer err.message, fall back to err.details
                            const msg = err?.message ||
                                err?.details ||
                                "Access not granted. Please contact your administrator.";
                            setError(msg);
                            setLoading(false);
                        }
                        return;
                    }
                    if (cancelled)
                        return;
                    // Retry now that the doc should exist
                    snap = await getDoc(doc(db, "users", uid));
                    if (!snap.exists()) {
                        if (!cancelled) {
                            setError("Profile setup failed. Contact an administrator.");
                            setLoading(false);
                        }
                        return;
                    }
                }
                const data = snap.data();
                if (data.active === false) {
                    if (!cancelled) {
                        setError("Your account has been deactivated. Contact your administrator.");
                        setLoading(false);
                    }
                    return;
                }
                let orgId = "";
                let role = "";
                let orgRoles = {};
                let orgIds = [];
                if (data.orgId && data.role) {
                    // New flat schema
                    orgId = data.orgId;
                    role = data.role;
                    orgRoles = { [data.orgId]: [data.role] };
                    orgIds = [data.orgId];
                }
                else if (data.orgRoles) {
                    // Legacy orgRoles map
                    orgRoles = data.orgRoles || {};
                    orgIds = Object.keys(orgRoles).filter(k => k !== "*");
                    orgId = orgIds[0] || "";
                    role = (orgRoles[orgId] || [])[0] || "";
                }
                setProfile({
                    uid,
                    userId: data.userId || uid,
                    name: data.name || data.displayName || "",
                    email: data.email || email,
                    orgId,
                    role,
                    ministryDepartment: data.ministryDepartment || "",
                    active: data.active !== false, // default true
                    tenantId: data.tenantId || "tenant_main",
                    orgRoles,
                    orgIds,
                });
                setActiveOrgId(orgId);
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
        return roles.includes(role) || roles.includes("ADMIN") || roles.includes("admin");
    };
    const isAdmin = hasRole("ADMIN") || hasRole("admin");
    const canApprove = isAdmin || hasRole("approver");
    const canRequestExpense = isAdmin || hasRole("requestor");
    const canFinanceReview = isAdmin || hasRole("finance") || hasRole("FINANCE_RECEIPTS_REVIEWER") || hasRole("FINANCE_PAYOR") || hasRole("FINANCE_QB_ENTRY") || hasRole("FINANCE_NOTIFY");
    const isFinancePayor = isAdmin || hasRole("FINANCE_PAYOR");
    const isReceiptsReviewer = isAdmin || hasRole("FINANCE_RECEIPTS_REVIEWER");
    const isQBEntry = isAdmin || hasRole("FINANCE_QB_ENTRY");
    const isFinanceNotify = isAdmin || hasRole("FINANCE_NOTIFY");
    const activeOrgName = ORG_NAMES[activeOrgId] || activeOrgId;
    const userRole = profile?.role || "";
    const userName = profile?.name || "";
    const userMinistryDept = profile?.ministryDepartment || "";
    return (_jsx(UserContext.Provider, { value: {
            profile, loading, error, activeOrgId, setActiveOrgId, hasRole,
            isAdmin, canApprove, canRequestExpense, canFinanceReview,
            isFinancePayor, isReceiptsReviewer, isQBEntry, isFinanceNotify, activeOrgName,
            userRole, userName, userMinistryDept,
        }, children: children }));
}
export function useUserContext() {
    const ctx = useContext(UserContext);
    if (!ctx)
        throw new Error("useUserContext must be used inside UserProvider");
    return ctx;
}
