import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <div style={{
      width: "220px",
      background: "#1f2937",
      color: "white",
      height: "100vh",
      padding: "20px"
    }}>
      <h3>Accounting</h3>

      <div style={{display:"flex", flexDirection:"column", gap:"10px"}}>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/expenses">Expenses</Link>
        <Link to="/vendors">Vendors</Link>
        <Link to="/categories">Categories</Link>
        <Link to="/chart-of-accounts">Chart of Accounts</Link>
        <Link to="/journal-entries">Journal Entries</Link>
        <Link to="/general-ledger">General Ledger</Link>
        <Link to="/export">Export</Link>
      </div>
    </div>
  );
}