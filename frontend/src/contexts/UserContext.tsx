import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export interface UserProfile {
  uid: string;
  email: string;
  tenantId: string;
  orgRoles: Record<string, string[]>;
  orgIds: string[];
}

interface UserContextValue {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  activeOrgId: string;
  setActiveOrgId: (id: string) => void;
  hasRole: (role: string) => boolean;
  isAdmin: boolean;
  canApprove: boolean;
  canRequestExpense: boolean;
  canFinanceReview: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ uid, email, children }: { uid: string; email: string; children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (cancelled) return;
        if (!snap.exists()) {
          setError("User profile not found. Contact an administrator.");
          setLoading(false);
          return;
        }
        const data = snap.data() as { tenantId: string; orgRoles: Record<string, string[]> };
        const orgRoles = data.orgRoles || {};
        const orgIds = Object.keys(orgRoles).filter((k) => k !== "*");
        setProfile({ uid, email, tenantId: data.tenantId, orgRoles, orgIds });
        setActiveOrgId(orgIds[0] || "");
      } catch (err) {
        if (!cancelled) setError("Failed to load user profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, email]);

  const getRoles = (): string[] => {
    if (!profile || !activeOrgId) return [];
    return [
      ...(profile.orgRoles[activeOrgId] || []),
      ...(profile.orgRoles["*"] || []),
    ];
  };

  const hasRole = (role: string): boolean => {
    const roles = getRoles();
    return roles.includes(role) || roles.includes("admin");
  };

  const isAdmin = hasRole("admin");
  const canApprove = isAdmin || hasRole("approver");
  const canRequestExpense = isAdmin || hasRole("requestor");
  const canFinanceReview = isAdmin || hasRole("finance");

  return (
    <UserContext.Provider value={{ profile, loading, error, activeOrgId, setActiveOrgId, hasRole, isAdmin, canApprove, canRequestExpense, canFinanceReview }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserContext must be used inside UserProvider");
  return ctx;
}
