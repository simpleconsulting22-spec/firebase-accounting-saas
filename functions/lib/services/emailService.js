"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailTemplates = exports.emailService = void 0;
const firestore_1 = require("../utils/firestore");
exports.emailService = {
    async send(payload) {
        const to = Array.isArray(payload.to) ? payload.to : [payload.to];
        const filtered = to.filter(Boolean);
        if (filtered.length === 0)
            return;
        await firestore_1.db.collection("mail").add({
            to: filtered,
            message: {
                subject: payload.subject,
                text: payload.text || "",
                html: payload.html || payload.text || "",
            },
            createdAt: new Date(),
        });
    },
};
// ─── Email Templates ───────────────────────────────────────────────────────────
exports.emailTemplates = {
    purchaseRequestSubmitted(data) {
        return {
            to: data.approverEmail,
            subject: `[Action Required] Purchase Request: ${data.purpose}`,
            html: `
        <h2>Purchase Request Submitted</h2>
        <p><strong>${data.requestorName}</strong> has submitted a purchase request for your approval.</p>
        <table>
          <tr><td><strong>Purpose:</strong></td><td>${data.purpose}</td></tr>
          <tr><td><strong>Amount:</strong></td><td>$${data.amount.toFixed(2)}</td></tr>
          <tr><td><strong>Request ID:</strong></td><td>${data.requestId}</td></tr>
        </table>
        <p>Please review and approve or reject this request in the Expense Workflow system.</p>
      `,
        };
    },
    purchaseRequestApproved(data) {
        return {
            to: data.requestorEmail,
            subject: `[Approved] Purchase Request: ${data.purpose}`,
            html: `
        <h2>Your Purchase Request Was Approved</h2>
        <p>Your purchase request has been approved and you may now create an expense report.</p>
        <table>
          <tr><td><strong>Purpose:</strong></td><td>${data.purpose}</td></tr>
          <tr><td><strong>Amount:</strong></td><td>$${data.amount.toFixed(2)}</td></tr>
          <tr><td><strong>Request ID:</strong></td><td>${data.requestId}</td></tr>
          ${data.comments ? `<tr><td><strong>Comments:</strong></td><td>${data.comments}</td></tr>` : ""}
        </table>
      `,
        };
    },
    purchaseRequestRejected(data) {
        return {
            to: data.requestorEmail,
            subject: `[Rejected] Purchase Request: ${data.purpose}`,
            html: `
        <h2>Your Purchase Request Was Rejected</h2>
        <p>Your purchase request has been rejected.</p>
        <table>
          <tr><td><strong>Purpose:</strong></td><td>${data.purpose}</td></tr>
          <tr><td><strong>Request ID:</strong></td><td>${data.requestId}</td></tr>
          ${data.comments ? `<tr><td><strong>Comments:</strong></td><td>${data.comments}</td></tr>` : ""}
        </table>
      `,
        };
    },
    purchaseRequestRevisionsNeeded(data) {
        return {
            to: data.requestorEmail,
            subject: `[Revisions Needed] Purchase Request: ${data.purpose}`,
            html: `
        <h2>Revisions Requested for Your Purchase Request</h2>
        <p>Your approver has requested revisions to your purchase request.</p>
        <table>
          <tr><td><strong>Purpose:</strong></td><td>${data.purpose}</td></tr>
          <tr><td><strong>Request ID:</strong></td><td>${data.requestId}</td></tr>
          ${data.comments ? `<tr><td><strong>Feedback:</strong></td><td>${data.comments}</td></tr>` : ""}
        </table>
        <p>Please update your request and resubmit.</p>
      `,
        };
    },
    expenseSubmitted(data) {
        return {
            to: data.financeEmail,
            subject: `[Action Required] Expense Report Submitted: ${data.purpose}`,
            html: `
        <h2>Expense Report Submitted for Review</h2>
        <p>An expense report is ready for your finance review.</p>
        <table>
          <tr><td><strong>Purpose:</strong></td><td>${data.purpose}</td></tr>
          <tr><td><strong>Actual Amount:</strong></td><td>$${data.amount.toFixed(2)}</td></tr>
          <tr><td><strong>Request ID:</strong></td><td>${data.requestId}</td></tr>
        </table>
      `,
        };
    },
};
