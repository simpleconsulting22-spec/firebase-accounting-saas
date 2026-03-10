import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
export function ModuleGate({ enabled, children, fallback = null }) {
    if (!enabled)
        return _jsx(_Fragment, { children: fallback });
    return _jsx(_Fragment, { children: children });
}
