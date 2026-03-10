import { AccountingExportHistoryItem } from "../types";

interface ExportHistoryTableProps {
  rows: AccountingExportHistoryItem[];
  loading: boolean;
  onRefresh: () => void;
}

export function ExportHistoryTable({ rows, loading, onRefresh }: ExportHistoryTableProps) {
  return (
    <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>Export History</h3>
      <button type="button" onClick={onRefresh} disabled={loading}>
        {loading ? "Refreshing..." : "Refresh History"}
      </button>
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #d0d7de" }}>Generated At</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #d0d7de" }}>Export Type</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #d0d7de" }}>Status</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #d0d7de" }}>Date Range</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #d0d7de" }}>Rows</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #d0d7de" }}>Download</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ borderBottom: "1px solid #f0f2f4", padding: "6px 0" }}>{row.generatedAt}</td>
                <td style={{ borderBottom: "1px solid #f0f2f4", padding: "6px 0" }}>{row.exportType}</td>
                <td style={{ borderBottom: "1px solid #f0f2f4", padding: "6px 0" }}>{row.status}</td>
                <td style={{ borderBottom: "1px solid #f0f2f4", padding: "6px 0" }}>
                  {row.dateFrom} to {row.dateTo}
                </td>
                <td style={{ borderBottom: "1px solid #f0f2f4", padding: "6px 0" }}>{row.rowCount}</td>
                <td style={{ borderBottom: "1px solid #f0f2f4", padding: "6px 0" }}>
                  {row.fileUrl ? (
                    <a href={row.fileUrl} target="_blank" rel="noreferrer">
                      Download CSV
                    </a>
                  ) : (
                    "N/A"
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ paddingTop: 8 }}>
                  No exports found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
