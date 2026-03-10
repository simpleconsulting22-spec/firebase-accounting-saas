export const moduleService = {
    isEnabled(modulesEnabled, moduleName) {
        return Boolean(modulesEnabled[moduleName]);
    }
};
