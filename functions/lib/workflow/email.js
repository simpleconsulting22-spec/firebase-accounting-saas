"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPreApprovalEmail = sendPreApprovalEmail;
exports.sendApprovedEmail = sendApprovedEmail;
exports.sendNeedsEditsEmail = sendNeedsEditsEmail;
exports.sendReceiptsReviewEmail = sendReceiptsReviewEmail;
exports.sendFinalApprovedEmail = sendFinalApprovedEmail;
exports.sendRejectedEmail = sendRejectedEmail;
exports.sendOverageEmail = sendOverageEmail;
exports.sendVendorIntakeEmail = sendVendorIntakeEmail;
exports.sendVendorApprovedEmail = sendVendorApprovedEmail;
exports.sendVendorRejectedEmail = sendVendorRejectedEmail;
exports.sendQBSentEmail = sendQBSentEmail;
exports.sendPaymentConfirmationEmail = sendPaymentConfirmationEmail;
const admin = __importStar(require("firebase-admin"));
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
// ─── HTML Email Template ──────────────────────────────────────────────────────
function buildEmailHtml(orgName, bodyHtml) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${orgName}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a56db; color: #ffffff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 4px 0 0; font-size: 14px; opacity: 0.85; }
    .body { padding: 32px; color: #333; }
    .body h2 { margin-top: 0; font-size: 18px; color: #1a56db; }
    .detail-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .detail-table td { padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    .detail-table td:first-child { font-weight: bold; width: 40%; color: #555; }
    .btn { display: inline-block; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px; margin: 8px 8px 8px 0; }
    .btn-approve { background: #16a34a; color: #fff; }
    .btn-reject { background: #dc2626; color: #fff; }
    .btn-review { background: #1a56db; color: #fff; }
    .btn-needs-edits { background: #d97706; color: #fff; }
    .footer { padding: 16px 32px; background: #f9f9f9; color: #888; font-size: 12px; text-align: center; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${orgName}</h1>
      <p>Expense Approval Workflow</p>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      This is an automated message from ${orgName}'s expense workflow system. Please do not reply to this email.
    </div>
  </div>
</body>
</html>
  `.trim();
}
function requestDetailRows(request) {
    return `
    <table class="detail-table">
      <tr><td>Request ID</td><td>${request.id}</td></tr>
      <tr><td>Requestor</td><td>${request.requestorName} (${request.requestorEmail})</td></tr>
      <tr><td>Ministry / Dept</td><td>${request.ministryDepartment}</td></tr>
      <tr><td>Vendor</td><td>${request.vendorName}</td></tr>
      <tr><td>Category</td><td>${request.category}</td></tr>
      <tr><td>Purpose</td><td>${request.purpose}</td></tr>
      <tr><td>Estimated Amount</td><td>${formatUSD(request.estimatedAmount)}</td></tr>
      <tr><td>Requested Date</td><td>${request.requestedExpenseDate}</td></tr>
    </table>
  `;
}
function formatUSD(amount) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(amount);
}
async function sendMail(to, subject, html) {
    const db = admin.firestore();
    await db.collection(constants_1.COLLECTION.MAIL).add({
        to,
        message: { subject, html },
    });
}
function getOrgName(orgId) {
    return constants_1.ORG_CONFIG[orgId]?.name ?? orgId;
}
// ─── Email Functions ──────────────────────────────────────────────────────────
/**
 * Sends the pre-approval email to the designated approver with approve/reject/needs-edits links.
 */
async function sendPreApprovalEmail(request, token) {
    const orgName = getOrgName(request.orgId);
    const approveUrl = `${constants_1.BASE_URL}/review?token=${token}&decision=approve`;
    const rejectUrl = `${constants_1.BASE_URL}/review?token=${token}&decision=reject`;
    const needsEditsUrl = `${constants_1.BASE_URL}/review?token=${token}&decision=needs_edits`;
    const reviewUrl = `${constants_1.BASE_URL}/review?token=${token}`;
    const body = `
    <h2>Pre-Approval Request</h2>
    <p>Hi ${request.approverName},</p>
    <p>A new expense request has been submitted and requires your pre-approval.</p>
    ${requestDetailRows(request)}
    <p><strong>Description:</strong> ${request.description}</p>
    <p>Please review and take action using the buttons below or click the full review link:</p>
    <p>
      <a href="${approveUrl}" class="btn btn-approve">Approve</a>
      <a href="${needsEditsUrl}" class="btn btn-needs-edits">Needs Edits</a>
      <a href="${rejectUrl}" class="btn btn-reject">Reject</a>
    </p>
    <p>Or <a href="${reviewUrl}">click here to view the full request and enter an approved amount</a>.</p>
    <p style="font-size:12px;color:#888;">This link will expire in 7 days.</p>
  `;
    await sendMail([request.approverEmail], `[${orgName}] Pre-Approval Request: ${request.id} — ${request.purpose}`, buildEmailHtml(orgName, body));
}
/**
 * Sends an approval notification to the requestor after pre-approval is granted.
 */
async function sendApprovedEmail(request) {
    const orgName = getOrgName(request.orgId);
    const dashboardUrl = `${constants_1.BASE_URL}/dashboard`;
    const body = `
    <h2>Your Request Has Been Pre-Approved</h2>
    <p>Hi ${request.requestorName},</p>
    <p>Great news! Your expense request has been pre-approved.</p>
    ${requestDetailRows(request)}
    <p><strong>Approved Amount:</strong> ${formatUSD(request.approvedAmount)}</p>
    ${request.preApprovalNotes ? `<p><strong>Approver Notes:</strong> ${request.preApprovalNotes}</p>` : ""}
    <p>Next step: Please complete your expense report and attach receipts once you have made the purchase.</p>
    <p><a href="${dashboardUrl}" class="btn btn-review">Go to My Dashboard</a></p>
  `;
    await sendMail([request.requestorEmail], `[${orgName}] Pre-Approved: ${request.id} — ${request.purpose}`, buildEmailHtml(orgName, body));
}
/**
 * Sends a needs-edits notification to the requestor (step 1).
 */
async function sendNeedsEditsEmail(request) {
    const orgName = getOrgName(request.orgId);
    const dashboardUrl = `${constants_1.BASE_URL}/dashboard`;
    const body = `
    <h2>Your Request Needs Edits</h2>
    <p>Hi ${request.requestorName},</p>
    <p>Your expense request has been reviewed and requires some edits before it can be approved.</p>
    ${requestDetailRows(request)}
    ${request.preApprovalNotes ? `<p><strong>Reviewer Notes:</strong> ${request.preApprovalNotes}</p>` : ""}
    <p>Please log in to your dashboard, update the request, and resubmit it.</p>
    <p><a href="${dashboardUrl}" class="btn btn-review">Go to My Dashboard</a></p>
  `;
    await sendMail([request.requestorEmail], `[${orgName}] Edits Required: ${request.id} — ${request.purpose}`, buildEmailHtml(orgName, body));
}
/**
 * Sends the receipts review email to all FINANCE_RECEIPTS_REVIEWER users with a review link.
 */
async function sendReceiptsReviewEmail(request, token) {
    const orgName = getOrgName(request.orgId);
    const reviewUrl = `${constants_1.BASE_URL}/review?token=${token}`;
    const reviewers = await (0, helpers_1.getUsersByRole)(request.orgId, constants_1.ROLE.FINANCE_RECEIPTS_REVIEWER);
    const reviewerEmails = reviewers.map((r) => r.email).filter(Boolean);
    if (reviewerEmails.length === 0) {
        // Fall back to admin emails if no reviewers configured
        const admins = await (0, helpers_1.getUsersByRole)(request.orgId, constants_1.ROLE.ADMIN);
        reviewerEmails.push(...admins.map((a) => a.email).filter(Boolean));
    }
    if (reviewerEmails.length === 0)
        return;
    const body = `
    <h2>Receipts Review Required</h2>
    <p>An expense report has been submitted and requires receipts review.</p>
    ${requestDetailRows(request)}
    <p><strong>Approved Amount:</strong> ${formatUSD(request.approvedAmount)}</p>
    <p><strong>Actual Amount:</strong> ${formatUSD(request.actualAmount)}</p>
    <p>Please review the receipts and supporting documents and approve or reject this expense.</p>
    <p><a href="${reviewUrl}" class="btn btn-review">Review Receipts</a></p>
    <p style="font-size:12px;color:#888;">This link will expire in 14 days.</p>
  `;
    await sendMail(reviewerEmails, `[${orgName}] Receipts Review: ${request.id} — ${request.purpose}`, buildEmailHtml(orgName, body));
}
/**
 * Sends final approval notification to requestor and FINANCE_NOTIFY users.
 */
async function sendFinalApprovedEmail(request) {
    const orgName = getOrgName(request.orgId);
    const dashboardUrl = `${constants_1.BASE_URL}/dashboard`;
    const body = `
    <h2>Expense Request Final Approved</h2>
    <p>Hi ${request.requestorName},</p>
    <p>Your expense request has been fully approved and is now in the payment queue.</p>
    ${requestDetailRows(request)}
    <p><strong>Approved Amount:</strong> ${formatUSD(request.approvedAmount)}</p>
    <p><strong>Actual Amount:</strong> ${formatUSD(request.actualAmount)}</p>
    ${request.receiptsReviewNotes ? `<p><strong>Reviewer Notes:</strong> ${request.receiptsReviewNotes}</p>` : ""}
    <p>Your payment will be processed by the finance team. You will receive a confirmation when payment is sent.</p>
    <p><a href="${dashboardUrl}" class="btn btn-review">View Request</a></p>
  `;
    // Collect recipients: requestor + FINANCE_NOTIFY users
    const notifyUsers = await (0, helpers_1.getUsersByRole)(request.orgId, constants_1.ROLE.FINANCE_NOTIFY);
    const notifyEmails = notifyUsers.map((u) => u.email).filter(Boolean);
    const allRecipients = Array.from(new Set([request.requestorEmail, ...notifyEmails]));
    await sendMail(allRecipients, `[${orgName}] Final Approved: ${request.id} — ${request.purpose}`, buildEmailHtml(orgName, body));
}
/**
 * Sends a rejection notification to the requestor.
 */
async function sendRejectedEmail(request) {
    const orgName = getOrgName(request.orgId);
    const dashboardUrl = `${constants_1.BASE_URL}/dashboard`;
    const body = `
    <h2>Expense Request Rejected</h2>
    <p>Hi ${request.requestorName},</p>
    <p>Unfortunately, your expense request has been rejected.</p>
    ${requestDetailRows(request)}
    ${request.rejectionReason ? `<p><strong>Reason:</strong> ${request.rejectionReason}</p>` : ""}
    <p>If you have questions, please reach out to your approver or the finance team.</p>
    <p><a href="${dashboardUrl}" class="btn btn-review">View Request</a></p>
  `;
    await sendMail([request.requestorEmail], `[${orgName}] Rejected: ${request.id} — ${request.purpose}`, buildEmailHtml(orgName, body));
}
/**
 * Sends an overage notification to FINANCE_RECEIPTS_REVIEWER users when
 * actual amount exceeds approved amount + buffer.
 */
async function sendOverageEmail(request) {
    const orgName = getOrgName(request.orgId);
    const bufferAmount = constants_1.ORG_CONFIG[request.orgId]?.escalationBufferAmount ?? 50;
    const overage = request.actualAmount - request.approvedAmount;
    const dashboardUrl = `${constants_1.BASE_URL}/dashboard`;
    const reviewers = await (0, helpers_1.getUsersByRole)(request.orgId, constants_1.ROLE.FINANCE_RECEIPTS_REVIEWER);
    const reviewerEmails = reviewers.map((r) => r.email).filter(Boolean);
    if (reviewerEmails.length === 0) {
        const admins = await (0, helpers_1.getUsersByRole)(request.orgId, constants_1.ROLE.ADMIN);
        reviewerEmails.push(...admins.map((a) => a.email).filter(Boolean));
    }
    if (reviewerEmails.length === 0)
        return;
    const body = `
    <h2>Expense Overage Alert</h2>
    <p>An expense request has exceeded the approved amount by more than the allowed buffer of ${formatUSD(bufferAmount)}.</p>
    ${requestDetailRows(request)}
    <p><strong>Approved Amount:</strong> ${formatUSD(request.approvedAmount)}</p>
    <p><strong>Actual Amount:</strong> ${formatUSD(request.actualAmount)}</p>
    <p><strong>Overage:</strong> ${formatUSD(overage)}</p>
    <p>This request requires manual review and approval before it can proceed. An admin or finance manager must either adjust the approved amount or reject the request.</p>
    <p><a href="${dashboardUrl}" class="btn btn-review">Review in Dashboard</a></p>
  `;
    await sendMail(reviewerEmails, `[${orgName}] Overage Alert: ${request.id} — ${request.purpose}`, buildEmailHtml(orgName, body));
}
/**
 * Sends vendor intake form link to the vendor's email.
 */
async function sendVendorIntakeEmail(vendorSetupRequest, token, intakeUrl) {
    const orgName = getOrgName(vendorSetupRequest.orgId);
    const body = `
    <h2>Vendor Information Request</h2>
    <p>Hi ${vendorSetupRequest.contactName || vendorSetupRequest.vendorName},</p>
    <p>${orgName} would like to add you as an approved vendor in their system. To complete the setup, please fill out the vendor intake form using the link below.</p>
    <table class="detail-table">
      <tr><td>Organization</td><td>${orgName}</td></tr>
      <tr><td>Vendor Name</td><td>${vendorSetupRequest.vendorName}</td></tr>
    </table>
    ${vendorSetupRequest.notes ? `<p><strong>Note from requestor:</strong> ${vendorSetupRequest.notes}</p>` : ""}
    <p>Please complete the form at your earliest convenience:</p>
    <p><a href="${intakeUrl}" class="btn btn-review">Complete Vendor Intake Form</a></p>
    <p style="font-size:12px;color:#888;">This link will expire in 30 days. If you have questions, please contact ${orgName} directly.</p>
  `;
    await sendMail([vendorSetupRequest.vendorEmail], `[${orgName}] Vendor Intake Form — ${vendorSetupRequest.vendorName}`, buildEmailHtml(orgName, body));
}
/**
 * Sends vendor approval notification to the requestor.
 */
async function sendVendorApprovedEmail(vendorSetupRequest) {
    const orgName = getOrgName(vendorSetupRequest.orgId);
    const dashboardUrl = `${constants_1.BASE_URL}/dashboard`;
    const body = `
    <h2>Vendor Setup Approved</h2>
    <p>Hi ${vendorSetupRequest.requestorName},</p>
    <p>The vendor setup request you submitted has been approved. The vendor is now active in the system.</p>
    <table class="detail-table">
      <tr><td>Vendor Name</td><td>${vendorSetupRequest.vendorName}</td></tr>
      <tr><td>Vendor Email</td><td>${vendorSetupRequest.vendorEmail}</td></tr>
      <tr><td>Contact</td><td>${vendorSetupRequest.contactName}</td></tr>
    </table>
    <p>You can now use this vendor when creating expense requests.</p>
    <p><a href="${dashboardUrl}" class="btn btn-approve">Go to Dashboard</a></p>
  `;
    await sendMail([vendorSetupRequest.requestorEmail], `[${orgName}] Vendor Approved: ${vendorSetupRequest.vendorName}`, buildEmailHtml(orgName, body));
}
/**
 * Sends vendor rejection notification to the requestor.
 */
async function sendVendorRejectedEmail(vendorSetupRequest) {
    const orgName = getOrgName(vendorSetupRequest.orgId);
    const dashboardUrl = `${constants_1.BASE_URL}/dashboard`;
    const body = `
    <h2>Vendor Setup Rejected</h2>
    <p>Hi ${vendorSetupRequest.requestorName},</p>
    <p>The vendor setup request you submitted has been rejected.</p>
    <table class="detail-table">
      <tr><td>Vendor Name</td><td>${vendorSetupRequest.vendorName}</td></tr>
      <tr><td>Vendor Email</td><td>${vendorSetupRequest.vendorEmail}</td></tr>
    </table>
    ${vendorSetupRequest.rejectionReason ? `<p><strong>Reason:</strong> ${vendorSetupRequest.rejectionReason}</p>` : ""}
    <p>If you have questions, please contact your organization's admin.</p>
    <p><a href="${dashboardUrl}" class="btn btn-review">Go to Dashboard</a></p>
  `;
    await sendMail([vendorSetupRequest.requestorEmail], `[${orgName}] Vendor Request Rejected: ${vendorSetupRequest.vendorName}`, buildEmailHtml(orgName, body));
}
/**
 * Sends a QuickBooks export notification to QB assist emails.
 */
async function sendQBSentEmail(request) {
    const orgName = getOrgName(request.orgId);
    const qbAssistEmails = constants_1.ORG_CONFIG[request.orgId]?.qbAssistEmails ?? [];
    const dashboardUrl = `${constants_1.BASE_URL}/dashboard`;
    if (qbAssistEmails.length === 0)
        return;
    const body = `
    <h2>Expense Ready for QuickBooks Entry</h2>
    <p>An approved and paid expense has been sent to QuickBooks for entry.</p>
    ${requestDetailRows(request)}
    <p><strong>Approved Amount:</strong> ${formatUSD(request.approvedAmount)}</p>
    <p><strong>Actual Amount:</strong> ${formatUSD(request.actualAmount)}</p>
    <p><strong>Payment Method:</strong> ${request.paymentMethod}</p>
    ${request.paymentReference ? `<p><strong>Payment Reference:</strong> ${request.paymentReference}</p>` : ""}
    <p>Please log in to enter this transaction in QuickBooks.</p>
    <p><a href="${dashboardUrl}" class="btn btn-review">View in Dashboard</a></p>
  `;
    await sendMail(qbAssistEmails, `[${orgName}] QB Entry Needed: ${request.id} — ${request.purpose}`, buildEmailHtml(orgName, body));
}
/**
 * Sends a payment confirmation email to the requestor.
 */
async function sendPaymentConfirmationEmail(request) {
    const orgName = getOrgName(request.orgId);
    const dashboardUrl = `${constants_1.BASE_URL}/dashboard`;
    const body = `
    <h2>Payment Confirmation</h2>
    <p>Hi ${request.requestorName},</p>
    <p>Payment for your approved expense request has been processed.</p>
    ${requestDetailRows(request)}
    <p><strong>Amount Paid:</strong> ${formatUSD(request.actualAmount)}</p>
    <p><strong>Payment Method:</strong> ${request.paymentMethod}</p>
    ${request.paymentReference ? `<p><strong>Payment Reference:</strong> ${request.paymentReference}</p>` : ""}
    <p>If you have any questions about this payment, please contact the finance team.</p>
    <p><a href="${dashboardUrl}" class="btn btn-review">View Request</a></p>
  `;
    await sendMail([request.requestorEmail], `[${orgName}] Payment Sent: ${request.id} — ${request.purpose}`, buildEmailHtml(orgName, body));
}
