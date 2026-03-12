import { Routes, Route, Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useUserContext } from "../contexts/UserContext";
import Sidebar from "../components/Sidebar";
import Dashboard from "../pages/Dashboard";
import RequestsListPage from "../pages/RequestsListPage";
import CreateRequestPage from "../pages/CreateRequestPage";
import RequestDetailPage from "../pages/RequestDetailPage";
import Expenses from "../pages/Expenses";
import Vendors from "../pages/Vendors";
import Categories from "../pages/Categories";
import ChartOfAccounts from "../pages/ChartOfAccounts";
import JournalEntries from "../pages/JournalEntries";
import GeneralLedger from "../pages/GeneralLedger";
import Export from "../pages/Export";

export default function AppLayout() {
  const { loading, error, profile } = useUserContext();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }}>
        Loading profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 16, fontFamily: "sans-serif" }}>
        <p style={{ color: "#dc2626", fontSize: 16 }}>{error || "Profile not found."}</p>
        <button
          onClick={() => signOut(auth)}
          style={{ padding: "8px 20px", background: "#374151", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: "auto", background: "#f9fafb" }}>
        <Routes>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="requests" element={<RequestsListPage />} />
          <Route path="requests/new" element={<CreateRequestPage />} />
          <Route path="requests/:id" element={<RequestDetailPage />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="categories" element={<Categories />} />
          <Route path="chart-of-accounts" element={<ChartOfAccounts />} />
          <Route path="journal-entries" element={<JournalEntries />} />
          <Route path="general-ledger" element={<GeneralLedger />} />
          <Route path="export" element={<Export />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
