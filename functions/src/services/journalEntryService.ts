import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "../config/collections";
import { ChartOfAccount, JournalEntry, JournalEntryLine, JournalEntryStatus } from "../models";
import { AppError } from "../utils/errors";
import { db } from "../utils/firestore";

export interface JournalEntryLineInput {
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
  className?: string;
  tagName?: string;
}

export interface CreateJournalEntryInput {
  tenantId: string;
  organizationId: string;
  journalEntryId?: string;
  date: string;
  reference: string;
  sourceModule: string;
  sourceId: string;
  memo?: string;
  lines: JournalEntryLineInput[];
  createdBy: string;
  status?: JournalEntryStatus;
}

export interface CreatePostedJournalEntryInput {
  tenantId: string;
  organizationId: string;
  journalEntryId?: string;
  date: string;
  reference: string;
  sourceModule: string;
  sourceId: string;
  memo?: string;
  lines: JournalEntryLineInput[];
  createdBy: string;
}

export interface ListJournalEntriesInput {
  tenantId: string;
  organizationId: string;
  status?: JournalEntryStatus;
  limit?: number;
}

export interface GetJournalEntryDetailInput {
  tenantId: string;
  organizationId: string;
  journalEntryId: string;
}

export interface JournalEntryListItem {
  id: string;
  date: string;
  periodKey: string;
  reference: string;
  sourceModule: string;
  sourceId: string;
  status: JournalEntryStatus;
  memo: string;
  lineCount: number;
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
  createdBy: string;
}

export interface JournalEntryDetailLine {
  accountId: string;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  memo: string;
  className: string;
  tagName: string;
}

export interface JournalEntryDetail {
  id: string;
  tenantId: string;
  organizationId: string;
  date: string;
  periodKey: string;
  reference: string;
  sourceModule: string;
  sourceId: string;
  status: JournalEntryStatus;
  memo: string;
  createdAt: string;
  createdBy: string;
  totalDebit: number;
  totalCredit: number;
  lines: JournalEntryDetailLine[];
}

const normalizeRequired = (value: string, fieldName: string): string => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new AppError(`'${fieldName}' is required.`, `${fieldName}/required`, 400);
  }
  return normalized;
};

const roundAmount = (value: number): number => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const derivePeriodKeyFromDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const parseDateToTimestamp = (rawDate: string): Timestamp => {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("Invalid journal entry date.", "journal-entry/invalid-date", 400);
  }
  return Timestamp.fromDate(parsed);
};

const chunkIds = (ids: string[], size: number): string[][] => {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
};

const fetchAccountsByIds = async (
  tenantId: string,
  organizationId: string,
  accountIds: string[]
): Promise<Map<string, ChartOfAccount>> => {
  const idSet = Array.from(new Set(accountIds.filter((value) => String(value || "").trim().length > 0)));
  const out = new Map<string, ChartOfAccount>();
  if (idSet.length === 0) {
    return out;
  }

  for (const idChunk of chunkIds(idSet, 30)) {
    const snap = await db
      .collection(COLLECTIONS.chartOfAccounts)
      .where(FieldPath.documentId(), "in", idChunk)
      .get();
    snap.docs.forEach((doc) => {
      const account = doc.data() as ChartOfAccount;
      if (account.tenantId === tenantId && account.organizationId === organizationId) {
        out.set(doc.id, account);
      }
    });
  }

  return out;
};

const normalizeLines = (lines: JournalEntryLineInput[]): JournalEntryLine[] => {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError("At least one journal line is required.", "journal-entry/lines-required", 400);
  }

  return lines.map((line, index) => {
    const accountId = normalizeRequired(line.accountId, `lines[${index}].accountId`);
    const debit = roundAmount(line.debit);
    const credit = roundAmount(line.credit);

    if (debit < 0 || credit < 0) {
      throw new AppError(
        `Line ${index + 1} has negative debit/credit.`,
        "journal-entry/negative-line-value",
        400
      );
    }
    if (debit === 0 && credit === 0) {
      throw new AppError(
        `Line ${index + 1} must include a debit or credit value.`,
        "journal-entry/empty-line",
        400
      );
    }
    if (debit > 0 && credit > 0) {
      throw new AppError(
        `Line ${index + 1} cannot contain both debit and credit values.`,
        "journal-entry/invalid-line",
        400
      );
    }

    return {
      accountId,
      debit,
      credit,
      memo: String(line.memo || "").trim() || undefined,
      className: String(line.className || "").trim() || undefined,
      tagName: String(line.tagName || "").trim() || undefined
    };
  });
};

const validateBalancedLines = (lines: JournalEntryLine[]): { totalDebit: number; totalCredit: number } => {
  const totalDebit = roundAmount(lines.reduce((sum, line) => sum + Number(line.debit || 0), 0));
  const totalCredit = roundAmount(lines.reduce((sum, line) => sum + Number(line.credit || 0), 0));

  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    throw new AppError(
      "Journal entry is not balanced. Total debit must equal total credit.",
      "journal-entry/unbalanced",
      400
    );
  }

  return { totalDebit, totalCredit };
};

const assertAllAccountsValid = async (
  tenantId: string,
  organizationId: string,
  lines: JournalEntryLine[]
): Promise<Map<string, ChartOfAccount>> => {
  const accountIds = lines.map((line) => line.accountId);
  const accountMap = await fetchAccountsByIds(tenantId, organizationId, accountIds);

  const missing = accountIds.filter((accountId) => !accountMap.has(accountId));
  if (missing.length > 0) {
    throw new AppError(
      `Invalid account reference(s): ${Array.from(new Set(missing)).join(", ")}`,
      "journal-entry/account-not-found",
      404
    );
  }

  const inactive = Array.from(new Set(accountIds)).filter((accountId) => {
    const account = accountMap.get(accountId);
    return !account || !account.active;
  });
  if (inactive.length > 0) {
    throw new AppError(
      `Inactive account(s) cannot be posted: ${inactive.join(", ")}`,
      "journal-entry/inactive-account",
      400
    );
  }

  return accountMap;
};

const serializeTimestamp = (value: Timestamp): string => value.toDate().toISOString();

const toListItem = (id: string, entry: JournalEntry): JournalEntryListItem => {
  const totalDebit = roundAmount(entry.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0));
  const totalCredit = roundAmount(entry.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0));
  return {
    id,
    date: entry.date.toDate().toISOString().slice(0, 10),
    periodKey: entry.periodKey,
    reference: entry.reference,
    sourceModule: entry.sourceModule,
    sourceId: entry.sourceId,
    status: entry.status,
    memo: entry.memo || "",
    lineCount: entry.lines.length,
    totalDebit,
    totalCredit,
    createdAt: serializeTimestamp(entry.createdAt),
    createdBy: entry.createdBy
  };
};

export const journalEntryService = {
  derivePeriodKeyFromDate,
  validateBalancedLines,

  async createJournalEntry(input: CreateJournalEntryInput): Promise<{
    journalEntryId: string;
    status: JournalEntryStatus;
    periodKey: string;
  }> {
    const date = parseDateToTimestamp(input.date);
    const reference = normalizeRequired(input.reference, "reference");
    const sourceModule = normalizeRequired(input.sourceModule, "sourceModule");
    const sourceId = normalizeRequired(input.sourceId, "sourceId");
    const lines = normalizeLines(input.lines);

    validateBalancedLines(lines);
    await assertAllAccountsValid(input.tenantId, input.organizationId, lines);

    const status: JournalEntryStatus = input.status || "POSTED";
    const periodKey = derivePeriodKeyFromDate(date.toDate());
    const entry: JournalEntry = {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      date,
      periodKey,
      reference,
      sourceModule,
      sourceId,
      status,
      memo: String(input.memo || "").trim() || undefined,
      lines,
      createdAt: Timestamp.now(),
      createdBy: input.createdBy
    };

    let journalEntryId = "";
    if (input.journalEntryId) {
      try {
        await db.collection(COLLECTIONS.journalEntries).doc(input.journalEntryId).create(entry);
        journalEntryId = input.journalEntryId;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown create failure";
        if (errorMessage.toLowerCase().includes("already exists")) {
          throw new AppError(
            "Journal entry already exists for this identifier.",
            "journal-entry/already-exists",
            409
          );
        }
        throw error;
      }
    } else {
      const ref = await db.collection(COLLECTIONS.journalEntries).add(entry);
      journalEntryId = ref.id;
    }

    return {
      journalEntryId,
      status,
      periodKey
    };
  },

  async createPostedJournalEntry(input: CreatePostedJournalEntryInput): Promise<{
    journalEntryId: string;
    status: JournalEntryStatus;
    periodKey: string;
  }> {
    return this.createJournalEntry({
      ...input,
      status: "POSTED"
    });
  },

  async listJournalEntries(input: ListJournalEntriesInput): Promise<JournalEntryListItem[]> {
    const limit = Math.min(Math.max(Number(input.limit || 50), 1), 200);
    let query = db
      .collection(COLLECTIONS.journalEntries)
      .where("tenantId", "==", input.tenantId)
      .where("organizationId", "==", input.organizationId);

    if (input.status) {
      query = query.where("status", "==", input.status);
    }

    const snap = await query.orderBy("date", "desc").limit(limit).get();
    return snap.docs.map((doc) => toListItem(doc.id, doc.data() as JournalEntry));
  },

  async getJournalEntryDetail(input: GetJournalEntryDetailInput): Promise<JournalEntryDetail> {
    const snap = await db.collection(COLLECTIONS.journalEntries).doc(input.journalEntryId).get();
    if (!snap.exists) {
      throw new AppError("Journal entry not found.", "journal-entry/not-found", 404);
    }

    const entry = snap.data() as JournalEntry;
    if (entry.tenantId !== input.tenantId || entry.organizationId !== input.organizationId) {
      throw new AppError("Journal entry does not belong to tenant/organization.", "journal-entry/forbidden", 403);
    }

    const accountMap = await fetchAccountsByIds(
      input.tenantId,
      input.organizationId,
      entry.lines.map((line) => line.accountId)
    );
    const totalDebit = roundAmount(entry.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0));
    const totalCredit = roundAmount(entry.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0));

    return {
      id: snap.id,
      tenantId: entry.tenantId,
      organizationId: entry.organizationId,
      date: entry.date.toDate().toISOString().slice(0, 10),
      periodKey: entry.periodKey,
      reference: entry.reference,
      sourceModule: entry.sourceModule,
      sourceId: entry.sourceId,
      status: entry.status,
      memo: entry.memo || "",
      createdAt: serializeTimestamp(entry.createdAt),
      createdBy: entry.createdBy,
      totalDebit,
      totalCredit,
      lines: entry.lines.map((line) => {
        const account = accountMap.get(line.accountId);
        return {
          accountId: line.accountId,
          accountNumber: account?.accountNumber || "",
          accountName: account?.accountName || "",
          debit: roundAmount(line.debit),
          credit: roundAmount(line.credit),
          memo: line.memo || "",
          className: line.className || "",
          tagName: line.tagName || ""
        };
      })
    };
  }
};
