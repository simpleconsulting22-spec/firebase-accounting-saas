import { accountingExportService } from "../../services/accountingExportService";

export const accountingExportsModuleService = {
  generateQuickbooksExpenseExport: accountingExportService.generateQuickbooksExpenseExport,
  listAccountingExports: accountingExportService.listAccountingExports
};
