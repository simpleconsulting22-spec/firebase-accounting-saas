import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function CSVPreviewTable({ rows, headers, errors, maxRows = 10 }) {
    const errorRowSet = new Set(errors.map(e => e.row));
    const errorCellSet = new Set(errors.filter(e => e.field).map(e => `${e.row}:${e.field}`));
    const shown = rows.slice(0, maxRows);
    const remaining = rows.length - shown.length;
    return (_jsxs("div", { children: [_jsxs("p", { className: "text-sm text-base-content/60 mb-2", children: ["Total rows: ", _jsx("span", { className: "font-semibold text-base-content", children: rows.length }), errors.length > 0 && (_jsxs("span", { className: "text-error ml-2", children: ["(", errors.length, " validation error", errors.length !== 1 ? 's' : '', ")"] }))] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-xs table-bordered", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "text-xs", children: "#" }), headers.map(h => (_jsx("th", { className: "text-xs", children: h }, h)))] }) }), _jsx("tbody", { children: shown.map((row, i) => (_jsxs("tr", { className: errorRowSet.has(i) ? 'bg-error/10' : '', children: [_jsx("td", { className: "text-xs text-base-content/50", children: i + 1 }), headers.map(h => {
                                        const hasErr = errorCellSet.has(`${i}:${h}`);
                                        return (_jsx("td", { className: hasErr ? 'text-error font-semibold ring-1 ring-error/50 rounded' : '', children: row[h] || '' }, h));
                                    })] }, i))) })] }) }), remaining > 0 && (_jsxs("p", { className: "text-xs text-base-content/60 mt-1 italic", children: ["and ", remaining, " more row", remaining !== 1 ? 's' : '', "..."] }))] }));
}
