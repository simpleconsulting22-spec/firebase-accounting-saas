"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.glPostingService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const collections_1 = require("../config/collections");
const errors_1 = require("../utils/errors");
const firestore_2 = require("../utils/firestore");
const expensePostingMapper_1 = require("./expensePostingMapper");
const journalEntryService_1 = require("./journalEntryService");
const sanitizeIdFragment = (value) => String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_");
const buildIdempotentJournalEntryId = (input) => [
    sanitizeIdFragment(input.tenantId),
    sanitizeIdFragment(input.organizationId),
    sanitizeIdFragment(input.sourceModule),
    sanitizeIdFragment(input.sourceId)
].join("__");
const findPostedEntryBySource = async (tenantId, organizationId, sourceModule, sourceId) => {
    const snap = await firestore_2.db
        .collection(collections_1.COLLECTIONS.journalEntries)
        .where("tenantId", "==", tenantId)
        .where("organizationId", "==", organizationId)
        .where("sourceModule", "==", sourceModule)
        .where("sourceId", "==", sourceId)
        .limit(1)
        .get();
    if (snap.empty) {
        return null;
    }
    return {
        id: snap.docs[0].id,
        data: snap.docs[0].data()
    };
};
const getExpenseReportOrThrow = async (tenantId, organizationId, reportId) => {
    const snap = await firestore_2.db.collection(collections_1.COLLECTIONS.expenseReports).doc(reportId).get();
    if (!snap.exists) {
        throw new errors_1.AppError("Expense report not found.", "expense-report/not-found", 404);
    }
    const report = snap.data();
    if (report.tenantId !== tenantId || report.organizationId !== organizationId) {
        throw new errors_1.AppError("Expense report does not belong to tenant/organization.", "expense-report/forbidden", 403);
    }
    return report;
};
const setExpenseReportPostingState = async (reportId, updates) => {
    await firestore_2.db.collection(collections_1.COLLECTIONS.expenseReports).doc(reportId).update({
        ...updates,
        updatedAt: firestore_1.Timestamp.now()
    });
};
exports.glPostingService = {
    async postJournalEntryWithIdempotency(input) {
        const existing = await findPostedEntryBySource(input.tenantId, input.organizationId, input.sourceModule, input.sourceId);
        if (existing) {
            return {
                journalEntryId: existing.id,
                existed: true,
                status: "POSTED",
                periodKey: existing.data.periodKey
            };
        }
        const deterministicId = buildIdempotentJournalEntryId({
            tenantId: input.tenantId,
            organizationId: input.organizationId,
            sourceModule: input.sourceModule,
            sourceId: input.sourceId
        });
        try {
            const created = await journalEntryService_1.journalEntryService.createPostedJournalEntry({
                tenantId: input.tenantId,
                organizationId: input.organizationId,
                journalEntryId: deterministicId,
                date: input.date,
                reference: input.reference,
                sourceModule: input.sourceModule,
                sourceId: input.sourceId,
                memo: input.memo,
                lines: input.lines,
                createdBy: input.postedBy
            });
            return {
                journalEntryId: created.journalEntryId,
                existed: false,
                status: "POSTED",
                periodKey: created.periodKey
            };
        }
        catch (error) {
            if (error instanceof errors_1.AppError && error.code === "journal-entry/already-exists") {
                const raceExisting = await findPostedEntryBySource(input.tenantId, input.organizationId, input.sourceModule, input.sourceId);
                if (raceExisting) {
                    return {
                        journalEntryId: raceExisting.id,
                        existed: true,
                        status: "POSTED",
                        periodKey: raceExisting.data.periodKey
                    };
                }
            }
            throw error;
        }
    },
    async postExpenseReportToLedger(input) {
        await getExpenseReportOrThrow(input.tenantId, input.organizationId, input.reportId);
        try {
            const mapped = await expensePostingMapper_1.expensePostingMapper.mapExpenseReportToJournal({
                tenantId: input.tenantId,
                organizationId: input.organizationId,
                reportId: input.reportId
            });
            const posting = await this.postJournalEntryWithIdempotency({
                tenantId: input.tenantId,
                organizationId: input.organizationId,
                sourceModule: mapped.sourceModule,
                sourceId: mapped.sourceId,
                date: String(input.date || mapped.date),
                reference: String(input.reference || mapped.reference),
                memo: String(input.memo || mapped.memo),
                lines: mapped.lines,
                postedBy: input.postedBy
            });
            await setExpenseReportPostingState(input.reportId, {
                postingStatus: "POSTED",
                journalEntryId: posting.journalEntryId,
                postedAt: firestore_1.Timestamp.now(),
                postingError: null
            });
            return {
                reportId: input.reportId,
                postingStatus: "POSTED",
                journalEntryId: posting.journalEntryId,
                existed: posting.existed,
                periodKey: posting.periodKey
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Failed to post expense report.";
            await setExpenseReportPostingState(input.reportId, {
                postingStatus: "FAILED",
                postingError: message
            });
            if (error instanceof errors_1.AppError) {
                throw error;
            }
            throw new errors_1.AppError("Failed to post expense report to ledger.", "general-ledger/posting-failed", 500);
        }
    }
};
