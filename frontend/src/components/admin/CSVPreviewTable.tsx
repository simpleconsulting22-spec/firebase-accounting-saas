interface CSVPreviewTableProps {
  rows: Record<string, string>[];
  headers: string[];
  errors: Array<{ row: number; field?: string; message: string }>;
  maxRows?: number;
}

export default function CSVPreviewTable({ rows, headers, errors, maxRows = 10 }: CSVPreviewTableProps) {
  const errorRowSet = new Set(errors.map(e => e.row));
  const errorCellSet = new Set(errors.filter(e => e.field).map(e => `${e.row}:${e.field}`));

  const shown = rows.slice(0, maxRows);
  const remaining = rows.length - shown.length;

  return (
    <div>
      <p className="text-sm text-base-content/60 mb-2">
        Total rows: <span className="font-semibold text-base-content">{rows.length}</span>
        {errors.length > 0 && (
          <span className="text-error ml-2">({errors.length} validation error{errors.length !== 1 ? 's' : ''})</span>
        )}
      </p>
      <div className="overflow-x-auto">
        <table className="table table-xs table-bordered">
          <thead>
            <tr>
              <th className="text-xs">#</th>
              {headers.map(h => (
                <th key={h} className="text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i} className={errorRowSet.has(i) ? 'bg-error/10' : ''}>
                <td className="text-xs text-base-content/50">{i + 1}</td>
                {headers.map(h => {
                  const hasErr = errorCellSet.has(`${i}:${h}`);
                  return (
                    <td
                      key={h}
                      className={hasErr ? 'text-error font-semibold ring-1 ring-error/50 rounded' : ''}
                    >
                      {row[h] || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remaining > 0 && (
        <p className="text-xs text-base-content/60 mt-1 italic">and {remaining} more row{remaining !== 1 ? 's' : ''}...</p>
      )}
    </div>
  );
}
