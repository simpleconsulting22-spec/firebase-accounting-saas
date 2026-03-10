import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { db } from "../../firebase";
import { ChartOfAccountsPanel } from "./components/ChartOfAccountsPanel";
import { ExpensePostingPanel } from "./components/ExpensePostingPanel";
import { JournalEntriesPanel } from "./components/JournalEntriesPanel";
const hasAdminFinanceRole = (orgRoles, organizationId) => {
    if (!organizationId) {
        return false;
    }
    if (Object.prototype.hasOwnProperty.call(orgRoles, "*")) {
        return true;
    }
    const roles = orgRoles[organizationId] || [];
    return roles.includes("admin") || roles.includes("finance");
};
export default function GeneralLedgerPage() {
    const { user, loading: authLoading } = useAuth();
    const [tenantId, setTenantId] = useState("");
    const [organizationId, setOrganizationId] = useState("");
    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState("");
    useEffect(() => {
        let active = true;
        const run = async () => {
            if (!user) {
                if (!active) {
                    return;
                }
                setProfile(null);
                return;
            }
            setProfileLoading(true);
            setProfileError("");
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (!active) {
                    return;
                }
                if (!userDoc.exists()) {
                    setProfile(null);
                    setProfileError("User profile was not found.");
                    return;
                }
                const data = userDoc.data();
                const nextProfile = {
                    tenantId: String(data.tenantId || ""),
                    orgRoles: data.orgRoles || {}
                };
                setProfile(nextProfile);
            }
            catch (err) {
                if (!active) {
                    return;
                }
                setProfile(null);
                setProfileError(err instanceof Error ? err.message : "Failed to load user profile.");
            }
            finally {
                if (active) {
                    setProfileLoading(false);
                }
            }
        };
        void run();
        return () => {
            active = false;
        };
    }, [user]);
    useEffect(() => {
        if (!tenantId && profile?.tenantId) {
            setTenantId(profile.tenantId);
        }
    }, [profile, tenantId]);
    const canManage = useMemo(() => {
        if (!profile || !organizationId) {
            return false;
        }
        return hasAdminFinanceRole(profile.orgRoles || {}, organizationId);
    }, [profile, organizationId]);
    const tenantMismatch = Boolean(profile?.tenantId && tenantId && profile.tenantId !== tenantId);
    return (_jsxs("section", { children: [_jsx("h2", { children: "General Ledger Module - Phase 6" }), _jsx("p", { children: "Manage chart of accounts, review immutable journal entries, and post expense reports with idempotent source-based posting controls." }), _jsxs("section", { style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Organization Context" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Tenant ID", _jsx("input", { style: { display: "block", width: "100%" }, value: tenantId, onChange: (event) => setTenantId(event.target.value), placeholder: "tenant_citylight_group" })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Organization ID", _jsx("input", { style: { display: "block", width: "100%" }, value: organizationId, onChange: (event) => setOrganizationId(event.target.value), placeholder: "org_citylight" })] })] }), authLoading || profileLoading ? _jsx("p", { children: "Loading access profile..." }) : null, profileError ? _jsx("p", { style: { color: "#cf222e" }, children: profileError }) : null, tenantMismatch ? (_jsxs("p", { style: { color: "#cf222e" }, children: ["Tenant ID does not match your signed-in profile tenant (", profile?.tenantId, ")."] })) : null, organizationId && !tenantMismatch && !canManage ? (_jsx("p", { style: { color: "#cf222e" }, children: "General Ledger UI access requires admin or finance role for the selected organization." })) : null, organizationId && !tenantMismatch && canManage ? (_jsxs(_Fragment, { children: [_jsx(ChartOfAccountsPanel, { tenantId: tenantId, organizationId: organizationId }), _jsx(JournalEntriesPanel, { tenantId: tenantId, organizationId: organizationId }), _jsx(ExpensePostingPanel, { tenantId: tenantId, organizationId: organizationId })] })) : null] }));
}
