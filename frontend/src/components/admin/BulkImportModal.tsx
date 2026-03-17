import { useRef, useState } from 'react';
import { BulkImportResult } from '../../workflow/types';
import CSVPreviewTable from './CSVPreviewTable';
import ValidationErrorList from './ValidationErrorList';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: Record<string, string>[]) => Promise<BulkImportResult>;
  templateHeaders: string[];
  templateExampleRows: Record<string, string>[];
  title: string;
  requiredFields: string[];
}

type Step = 1 | 2 | 3 | 4;

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

function downloadTemplate(headers: string[], exampleRows: Record<string, string>[]) {
  const csvContent = [
    headers.join(','),
    ...exampleRows.map(row => headers.map(h => row[h] || '').join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadErrorReport(headers: string[], rows: Record<string, string>[], errors: Array<{ row: number; field?: string; message: string }>) {
  const errorByRow: Record<number, string[]> = {};
  errors.forEach(e => {
    if (!errorByRow[e.row]) errorByRow[e.row] = [];
    errorByRow[e.row].push(e.field ? `${e.field}: ${e.message}` : e.message);
  });
  const allHeaders = [...headers, 'error'];
  const csvLines = [
    allHeaders.join(','),
    ...rows.map((row, i) => {
      const errMsg = errorByRow[i] ? errorByRow[i].join('; ') : '';
      return [...headers.map(h => row[h] || ''), errMsg].join(',');
    })
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'import_errors.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkImportModal({
  isOpen,
  onClose,
  onImport,
  templateHeaders,
  templateExampleRows,
  title,
  requiredFields,
}: BulkImportModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; field?: string; message: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; field?: string; message: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setStep(1);
    setParsedRows([]);
    setValidationErrors([]);
    setImporting(false);
    setImportResult(null);
    setImportErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const validateRows = (rows: Record<string, string>[]): Array<{ row: number; field?: string; message: string }> => {
    const errs: Array<{ row: number; field?: string; message: string }> = [];
    rows.forEach((row, i) => {
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errs.push({ row: i, field, message: 'Required field is empty' });
        }
      });
    });
    return errs;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      const errs = validateRows(rows);
      setParsedRows(rows);
      setValidationErrors(errs);
      setStep(3);
    };
    reader.readAsText(file);
  };

  const validRows = parsedRows.filter((_, i) => !validationErrors.find(e => e.row === i));
  const skippedRows = parsedRows.length - validRows.length;

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await onImport(validRows);
      setImportResult(result);
      setImportErrors(result.errors || []);
      setStep(4);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Import failed';
      setImportResult({ created: 0, updated: 0, errors: [{ row: -1, message: errorMsg }] });
      setImportErrors([{ row: -1, message: errorMsg }]);
      setStep(4);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  const stepLabels = ['Download Template', 'Upload CSV', 'Preview & Validate', 'Confirm & Import'];

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-3xl">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-lg">{title}</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={handleClose}>✕</button>
        </div>

        {/* Steps indicator */}
        <ul className="steps steps-horizontal w-full mb-6 text-xs">
          {stepLabels.map((label, i) => (
            <li
              key={i}
              className={`step ${step > i ? 'step-primary' : ''}`}
            >
              {label}
            </li>
          ))}
        </ul>

        {/* Step 1: Download Template */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-base-content/70">
              Download the CSV template, fill in your data, then upload it in the next step.
            </p>
            <div className="overflow-x-auto">
              <table className="table table-sm table-bordered">
                <thead>
                  <tr>
                    {templateHeaders.map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {templateExampleRows.map((row, i) => (
                    <tr key={i} className="text-base-content/60 italic">
                      {templateHeaders.map(h => <td key={h}>{row[h] || ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button
                className="btn btn-primary"
                onClick={() => downloadTemplate(templateHeaders, templateExampleRows)}
              >
                Download CSV Template
              </button>
              <button className="btn btn-outline" onClick={() => setStep(2)}>
                Skip — I have my file
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Upload CSV */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-base-content/70">
              Select your filled-in CSV file to upload.
            </p>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">CSV File</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="file-input file-input-bordered w-full"
                onChange={handleFileChange}
              />
            </div>
            <div className="flex gap-3">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Validation */}
        {step === 3 && (
          <div className="space-y-4">
            <CSVPreviewTable
              rows={parsedRows}
              headers={templateHeaders}
              errors={validationErrors}
            />
            {validationErrors.length > 0 && (
              <div className="alert alert-warning">
                <div>
                  <p className="font-semibold text-sm">Validation Issues</p>
                  <p className="text-xs">Rows with errors will be skipped during import.</p>
                  <ValidationErrorList errors={validationErrors} />
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
              <button
                className="btn btn-primary"
                disabled={validRows.length === 0}
                onClick={() => setStep(4)}
              >
                Continue ({validRows.length} valid rows)
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm & Import */}
        {step === 4 && !importResult && (
          <div className="space-y-4">
            <div className="stats shadow w-full">
              <div className="stat">
                <div className="stat-title">Valid Rows</div>
                <div className="stat-value text-success">{validRows.length}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Skipped Rows</div>
                <div className="stat-value text-warning">{skippedRows}</div>
              </div>
            </div>
            <p className="text-sm text-base-content/70">
              Ready to import {validRows.length} row{validRows.length !== 1 ? 's' : ''}. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button className="btn btn-ghost" onClick={() => setStep(3)}>Back</button>
              <button
                className="btn btn-primary"
                disabled={importing || validRows.length === 0}
                onClick={handleImport}
              >
                {importing ? <span className="loading loading-spinner loading-sm" /> : null}
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Import Result */}
        {step === 4 && importResult && (
          <div className="space-y-4">
            <div className="stats shadow w-full">
              <div className="stat">
                <div className="stat-title">Created</div>
                <div className="stat-value text-success">{importResult.created}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Updated</div>
                <div className="stat-value text-info">{importResult.updated}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Errors</div>
                <div className="stat-value text-error">{importResult.errors?.length ?? 0}</div>
              </div>
            </div>
            {importErrors.length > 0 && (
              <div className="alert alert-warning">
                <div className="w-full">
                  <p className="font-semibold text-sm mb-1">Import Errors</p>
                  <ValidationErrorList errors={importErrors} />
                  <button
                    className="btn btn-xs btn-outline mt-2"
                    onClick={() => downloadErrorReport(templateHeaders, validRows, importErrors)}
                  >
                    Download Error Report
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button className="btn btn-primary" onClick={handleClose}>Done</button>
            </div>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={handleClose} />
    </dialog>
  );
}
