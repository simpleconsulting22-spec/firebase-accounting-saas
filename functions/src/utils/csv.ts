export interface CsvBuildInput {
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

const escapeCsvCell = (value: unknown): string => {
  const raw = value === null || value === undefined ? "" : String(value);
  const escaped = raw.replace(/"/g, "\"\"");
  return `"${escaped}"`;
};

export const buildCsv = (input: CsvBuildInput): string => {
  const headerLine = input.headers.map((header) => escapeCsvCell(header)).join(",");
  const rowLines = input.rows.map((row) =>
    input.headers.map((header) => escapeCsvCell(row[header])).join(",")
  );

  return [headerLine, ...rowLines].join("\n");
};
