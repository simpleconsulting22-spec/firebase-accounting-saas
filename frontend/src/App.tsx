import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Vendors from "./pages/Vendors";
import Categories from "./pages/Categories";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import JournalEntries from "./pages/JournalEntries";
import GeneralLedger from "./pages/GeneralLedger";
import Export from "./pages/Export";

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex" }}>
        
        <Sidebar />

        <div style={{ flex: 1, padding: "30px" }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/expenses" element={<Expenses />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/categories" element={<Categories />} />

            <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
            <Route path="/journal-entries" element={<JournalEntries />} />
            <Route path="/general-ledger" element={<GeneralLedger />} />

            <Route path="/export" element={<Export />} />
          </Routes>
        </div>

      </div>
    </BrowserRouter>
  );
}
