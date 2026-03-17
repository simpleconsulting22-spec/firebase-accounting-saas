import { Routes, Route, Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useUserContext } from "../contexts/UserContext";
import Sidebar from "../components/Sidebar";
import Dashboard from "../pages/Dashboard";
import CreateRequestPage from "../pages/CreateRequestPage";
import RequestDetailPage from "../pages/RequestDetailPage";
import ExpenseReportPage from "../pages/ExpenseReportPage";
import AdminPage from "../pages/AdminPage";
import VendorPage from "../pages/VendorPage";
import Expenses from "../pages/Expenses";
import Categories from "../pages/Categories";
import ChartOfAccounts from "../pages/ChartOfAccounts";
import JournalEntries from "../pages/JournalEntries";
import GeneralLedger from "../pages/GeneralLedger";
import Export from "../pages/Export";

export default function AppLayout() {
  const { loading, error, profile } = useUserContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-error text-base">{error || "Profile not found."}</p>
        <button
          onClick={() => signOut(auth)}
          className="btn btn-neutral btn-sm"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-base-200">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Workflow routes */}
          <Route path="requests/new" element={<CreateRequestPage />} />
          <Route path="requests/:id/edit" element={<CreateRequestPage />} />
          <Route path="requests/:id/expense" element={<ExpenseReportPage />} />
          <Route path="requests/:id" element={<RequestDetailPage />} />
          <Route path="requests" element={<Dashboard />} />

          {/* Admin and vendor */}
          <Route path="admin" element={<AdminPage />} />
          <Route path="vendors" element={<VendorPage />} />

          {/* Legacy/other pages */}
          <Route path="expenses" element={<Expenses />} />
          <Route path="categories" element={<Categories />} />
          <Route path="chart-of-accounts" element={<ChartOfAccounts />} />
          <Route path="journal-entries" element={<JournalEntries />} />
          <Route path="general-ledger" element={<GeneralLedger />} />
          <Route path="export" element={<Export />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
