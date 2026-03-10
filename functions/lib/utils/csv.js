"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCsv = void 0;
const escapeCsvCell = (value) => {
    const raw = value === null || value === undefined ? "" : String(value);
    const escaped = raw.replace(/"/g, "\"\"");
    return `"${escaped}"`;
};
const buildCsv = (input) => {
    const headerLine = input.headers.map((header) => escapeCsvCell(header)).join(",");
    const rowLines = input.rows.map((row) => input.headers.map((header) => escapeCsvCell(row[header])).join(","));
    return [headerLine, ...rowLines].join("\n");
};
exports.buildCsv = buildCsv;
