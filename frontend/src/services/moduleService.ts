interface ModuleFlags {
  expenses: boolean;
  generalLedger: boolean;
  fixedAssets: boolean;
  financialReports: boolean;
  payroll: boolean;
  donations: boolean;
}

export const moduleService = {
  isEnabled(modulesEnabled: ModuleFlags, moduleName: keyof ModuleFlags): boolean {
    return Boolean(modulesEnabled[moduleName]);
  }
};
