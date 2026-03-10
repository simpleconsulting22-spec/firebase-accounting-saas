import { Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "../config/collections";
import { ExpenseReport, JournalEntry } from "../models";
import { AppError } from "../utils/errors";
import { db } from "../utils/firestore";
import { expensePostingMapper } from "./expensePostingMapper";
import { JournalEntryLineInput, journalEntryService } from "./journalEntryService";

export interface PostJournalEntryWithIdempotencyInput {
  tenantId: string;
  organizationId: string;
  sourceModule: string;
  sourceId: string;
  date: string;
  reference: string;
  memo?: string;
  lines: JournalEntryLineInput[];
  postedBy: string;
}

export interface PostingResult {
  journalEntryId: string;
  existed: boolean;
  status: "POSTED";
  periodKey: string;
}

export interface PostExpenseReportToLedgerInput {
  tenantId: string;
  organizationId: string;
  reportId: string;
  postedBy: string;
  date?: string;
  reference?: string;
  memo?: string;
}

const sanitizeIdFragment = (value: string): string =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_");

const buildIdempotentJournalEntryId = (input: {
  tenantId: string;
  organizationId: string;
  sourceModule: string;
  sourceId: string;
}): string =>
  [
    sanitizeIdFragment(input.tenantId),
    sanitizeIdFragment(input.organizationId),
    sanitizeIdFragment(input.sourceModule),
    sanitizeIdFragment(input.sourceId)
  ].join("__");

const findPostedEntryBySource = async (
  tenantId: string,
  organizationId: string,
  sourceModule: string,
  sourceId: string
): Promise<{ id: string; data: JournalEntry } | null> => {
  const snap = await db
    .collection(COLLECTIONS.journalEntries)
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
    data: snap.docs[0].data() as JournalEntry
  };
};

const getExpenseReportOrThrow = async (
  tenantId: string,
  organizationId: string,
  reportId: string
): Promise<ExpenseReport> => {
  const snap = await db.collection(COLLECTIONS.expenseReports).doc(reportId).get();
  if (!snap.exists) {
    throw new AppError("Expense report not found.", "expense-report/not-found", 404);
  }

  const report = snap.data() as ExpenseReport;
  if (report.tenantId !== tenantId || report.organizationId !== organizationId) {
    throw new AppError("Expense report does not belong to tenant/organization.", "expense-report/forbidden", 403);
  }
  return report;
};

const setExpenseReportPostingState = async (
  reportId: string,
  updates: Record<string, unknown>
): Promise<void> => {
  await db.collection(COLLECTIONS.expenseReports).doc(reportId).update({
    ...updates,
    updatedAt: Timestamp.now()
  });
};

export const glPostingService = {
  async postJournalEntryWithIdempotency(input: PostJournalEntryWithIdempotencyInput): Promise<PostingResult> {
    const existing = await findPostedEntryBySource(
      input.tenantId,
      input.organizationId,
      input.sourceModule,
      input.sourceId
    );
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
      const created = await journalEntryService.createPostedJournalEntry({
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
    } catch (error) {
      if (error instanceof AppError && error.code === "journal-entry/already-exists") {
        const raceExisting = await findPostedEntryBySource(
          input.tenantId,
          input.organizationId,
          input.sourceModule,
          input.sourceId
        );
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

  async postExpenseReportToLedger(input: PostExpenseReportToLedgerInput): Promise<{
    reportId: string;
    postingStatus: "POSTED";
    journalEntryId: string;
    existed: boolean;
    periodKey: string;
  }> {
    await getExpenseReportOrThrow(input.tenantId, input.organizationId, input.reportId);
    try {
      const mapped = await expensePostingMapper.mapExpenseReportToJournal({
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
        postedAt: Timestamp.now(),
        postingError: null
      });

      return {
        reportId: input.reportId,
        postingStatus: "POSTED",
        journalEntryId: posting.journalEntryId,
        existed: posting.existed,
        periodKey: posting.periodKey
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to post expense report.";
      await setExpenseReportPostingState(input.reportId, {
        postingStatus: "FAILED",
        postingError: message
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to post expense report to ledger.", "general-ledger/posting-failed", 500);
    }
  }
};
