interface ValidationErrorListProps {
  errors: Array<{ row: number; field?: string; message: string }>;
  maxShow?: number;
}

export default function ValidationErrorList({ errors, maxShow = 5 }: ValidationErrorListProps) {
  if (errors.length === 0) return null;
  const shown = errors.slice(0, maxShow);
  const remaining = errors.length - shown.length;

  return (
    <div className="mt-2">
      <ul className="text-sm text-error space-y-1">
        {shown.map((err, i) => (
          <li key={i} className="flex gap-1">
            {err.row >= 0 && <span className="font-semibold">Row {err.row + 2}:</span>}
            <span>{err.field && err.field !== 'general' ? `${err.field} — ` : ""}{err.message}</span>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <p className="text-xs text-base-content/60 mt-1">and {remaining} more error{remaining !== 1 ? 's' : ''}...</p>
      )}
    </div>
  );
}
