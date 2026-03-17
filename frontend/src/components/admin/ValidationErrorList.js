import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export default function ValidationErrorList({ errors, maxShow = 5 }) {
    if (errors.length === 0)
        return null;
    const shown = errors.slice(0, maxShow);
    const remaining = errors.length - shown.length;
    return (_jsxs("div", { className: "mt-2", children: [_jsx("ul", { className: "text-sm text-error space-y-1", children: shown.map((err, i) => (_jsxs("li", { className: "flex gap-1", children: [err.row >= 0 && _jsxs("span", { className: "font-semibold", children: ["Row ", err.row + 2, ":"] }), _jsxs("span", { children: [err.field && err.field !== 'general' ? `${err.field} — ` : "", err.message] })] }, i))) }), remaining > 0 && (_jsxs("p", { className: "text-xs text-base-content/60 mt-1", children: ["and ", remaining, " more error", remaining !== 1 ? 's' : '', "..."] }))] }));
}
