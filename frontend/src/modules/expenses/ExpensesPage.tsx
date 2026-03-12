import { Navigate } from "react-router-dom";

/**
 * The Expense Workflow is now at /requests (RequestsListPage) and /requests/:id (RequestDetailPage).
 * This page redirects there to preserve any existing /expenses links.
 */
export default function ExpensesPage() {
  return <Navigate to="/requests" replace />;
}
