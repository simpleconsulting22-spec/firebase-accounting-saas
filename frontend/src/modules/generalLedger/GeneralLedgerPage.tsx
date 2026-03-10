import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { db } from "../../firebase";
import { ChartOfAccountsPanel } from "./components/ChartOfAccountsPanel";
import { ExpensePostingPanel } from "./components/ExpensePostingPanel";
import { JournalEntriesPanel } from "./components/JournalEntriesPanel";

interface UserProfile {
  tenantId: string;
  orgRoles: Record<string, string[]>;
}

const hasAdminFinanceRole = (orgRoles: Record<string, string[]>, organizationId: string): boolean => {
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
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

        const data = userDoc.data() as Record<string, unknown>;
        const nextProfile: UserProfile = {
          tenantId: String(data.tenantId || ""),
          orgRoles: (data.orgRoles as Record<string, string[]>) || {}
        };
        setProfile(nextProfile);
      } catch (err) {
        if (!active) {
          return;
        }
        setProfile(null);
        setProfileError(err instanceof Error ? err.message : "Failed to load user profile.");
      } finally {
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

  return (
    <section>
      <h2>General Ledger Module - Phase 6</h2>
      <p>
        Manage chart of accounts, review immutable journal entries, and post expense reports with idempotent
        source-based posting controls.
      </p>

      <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Organization Context</h3>
        <label style={{ display: "block", marginBottom: 8 }}>
          Tenant ID
          <input
            style={{ display: "block", width: "100%" }}
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            placeholder="tenant_citylight_group"
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Organization ID
          <input
            style={{ display: "block", width: "100%" }}
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            placeholder="org_citylight"
          />
        </label>
      </section>

      {authLoading || profileLoading ? <p>Loading access profile...</p> : null}
      {profileError ? <p style={{ color: "#cf222e" }}>{profileError}</p> : null}
      {tenantMismatch ? (
        <p style={{ color: "#cf222e" }}>
          Tenant ID does not match your signed-in profile tenant ({profile?.tenantId}).
        </p>
      ) : null}
      {organizationId && !tenantMismatch && !canManage ? (
        <p style={{ color: "#cf222e" }}>
          General Ledger UI access requires admin or finance role for the selected organization.
        </p>
      ) : null}

      {organizationId && !tenantMismatch && canManage ? (
        <>
          <ChartOfAccountsPanel tenantId={tenantId} organizationId={organizationId} />
          <JournalEntriesPanel tenantId={tenantId} organizationId={organizationId} />
          <ExpensePostingPanel tenantId={tenantId} organizationId={organizationId} />
        </>
      ) : null}
    </section>
  );
}
