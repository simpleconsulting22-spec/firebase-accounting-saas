"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPurchaseRequestStatusChange = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const collections_1 = require("../../config/collections");
const firestore_2 = require("../../utils/firestore");
const emailService_1 = require("../../services/emailService");
/**
 * Firestore trigger that fires whenever a purchase request document is written.
 * Sends email notifications on status transitions.
 *
 * This function compares the before/after status and sends the appropriate email.
 */
exports.onPurchaseRequestStatusChange = (0, firestore_1.onDocumentWritten)(`${collections_1.COLLECTIONS.purchaseRequests}/{requestId}`, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after)
        return; // document deleted — nothing to do
    const prevStatus = String(before?.status || "");
    const nextStatus = String(after.status || "");
    if (prevStatus === nextStatus)
        return; // no status change
    const requestId = event.params.requestId;
    const purpose = String(after.purpose || "");
    const estimatedAmount = Number(after.estimatedAmount || 0);
    const actualAmount = Number(after.actualAmount || 0);
    const requestorId = String(after.requestorId || "");
    const approverId = String(after.approverId || "");
    const tenantId = String(after.tenantId || "");
    // Resolve email addresses from user profiles
    const [requestorSnap, approverSnap] = await Promise.all([
        requestorId ? firestore_2.db.collection(collections_1.COLLECTIONS.users).doc(requestorId).get() : Promise.resolve(null),
        approverId ? firestore_2.db.collection(collections_1.COLLECTIONS.users).doc(approverId).get() : Promise.resolve(null),
    ]);
    const requestorEmail = String(requestorSnap?.data()?.email || "");
    const requestorName = String(requestorSnap?.data()?.name || requestorEmail || requestorId);
    const approverEmail = String(approverSnap?.data()?.email || "");
    // Resolve a finance user to notify when expense report is submitted
    const getFinanceEmail = async () => {
        const financeUsersSnap = await firestore_2.db
            .collection(collections_1.COLLECTIONS.users)
            .where("tenantId", "==", tenantId)
            .limit(10)
            .get();
        for (const doc of financeUsersSnap.docs) {
            const orgRoles = (doc.data().orgRoles || {});
            const allRoles = Object.values(orgRoles).flat();
            if (allRoles.includes("finance") || allRoles.includes("admin")) {
                return String(doc.data().email || "");
            }
        }
        return "";
    };
    try {
        switch (nextStatus) {
            case "AWAITING_PREAPPROVAL":
                if (approverEmail) {
                    await emailService_1.emailService.send(emailService_1.emailTemplates.purchaseRequestSubmitted({ requestorName, purpose, amount: estimatedAmount, approverEmail, requestId }));
                }
                break;
            case "APPROVE":
                if (requestorEmail) {
                    await emailService_1.emailService.send(emailService_1.emailTemplates.purchaseRequestApproved({ purpose, amount: estimatedAmount, requestorEmail, requestId }));
                }
                break;
            case "REJECT":
                if (requestorEmail && prevStatus !== "DRAFT") {
                    await emailService_1.emailService.send(emailService_1.emailTemplates.purchaseRequestRejected({ purpose, requestorEmail, requestId }));
                }
                break;
            case "REQUEST_REVISIONS_NEEDED":
                if (requestorEmail) {
                    await emailService_1.emailService.send(emailService_1.emailTemplates.purchaseRequestRevisionsNeeded({ purpose, requestorEmail, requestId }));
                }
                break;
            case "AWAITING_FINANCE_REVIEW": {
                const financeEmail = await getFinanceEmail();
                if (financeEmail) {
                    await emailService_1.emailService.send(emailService_1.emailTemplates.expenseSubmitted({ purpose, amount: actualAmount, financeEmail, requestId }));
                }
                break;
            }
            default:
                break;
        }
    }
    catch (err) {
        // Never let email failures break the main workflow
        console.error("Email notification failed for request", requestId, err);
    }
});
