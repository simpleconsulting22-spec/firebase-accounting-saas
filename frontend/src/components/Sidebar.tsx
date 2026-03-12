import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useUserContext } from "../contexts/UserContext";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: "📊" },
  { path: "/requests", label: "Purchase Requests", icon: "📋" },
  { path: "/requests/new", label: "New Request", icon: "➕" },
  { divider: true },
  { path: "/expenses", label: "Expenses", icon: "💰" },
  { path: "/vendors", label: "Vendors", icon: "🏪" },
  { path: "/categories", label: "Categories", icon: "🏷️" },
  { divider: true },
  { path: "/chart-of-accounts", label: "Chart of Accounts", icon: "📑" },
  { path: "/journal-entries", label: "Journal Entries", icon: "📒" },
  { path: "/general-ledger", label: "General Ledger", icon: "📚" },
  { path: "/export", label: "Export", icon: "📤" },
] as const;

export default function Sidebar() {
  const location = useLocation();
  const { profile, activeOrgId, setActiveOrgId } = useUserContext();

  const isActive = (path: string) => {
    if (path === "/requests/new") return location.pathname === "/requests/new";
    if (path === "/requests") return location.pathname.startsWith("/requests") && location.pathname !== "/requests/new";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <div style={{ width: 220, background: "#1e293b", color: "white", display: "flex", flexDirection: "column", height: "100vh", flexShrink: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #334155" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.01em" }}>Expense Workflow</div>
        {profile && (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile.email}
          </div>
        )}
      </div>

      {/* Org selector (only when user has multiple orgs) */}
      {profile && profile.orgIds.length > 1 && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #334155" }}>
          <select
            value={activeOrgId}
            onChange={(e) => setActiveOrgId(e.target.value)}
            style={{ width: "100%", background: "#334155", color: "#e2e8f0", border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 12, cursor: "pointer" }}
          >
            {profile.orgIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
        {navItems.map((item, i) => {
          if ("divider" in item) {
            return <div key={i} style={{ height: 1, background: "#334155", margin: "8px 8px" }} />;
          }
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                marginBottom: 2,
                borderRadius: 6,
                color: active ? "#f8fafc" : "#94a3b8",
                background: active ? "#334155" : "transparent",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                transition: "background 0.1s, color 0.1s",
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "12px", borderTop: "1px solid #334155" }}>
        {profile && (
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeOrgId}
          </div>
        )}
        <button
          onClick={() => signOut(auth)}
          style={{ width: "100%", padding: "8px", background: "#334155", color: "#94a3b8", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500 }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
