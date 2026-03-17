import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import CSVPreviewTable from './CSVPreviewTable';
import ValidationErrorList from './ValidationErrorList';
function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2)
        return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i] || ''; });
        return row;
    });
}
function downloadTemplate(headers, exampleRows) {
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
function downloadErrorReport(headers, rows, errors) {
    const errorByRow = {};
    errors.forEach(e => {
        if (!errorByRow[e.row])
            errorByRow[e.row] = [];
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
export default function BulkImportModal({ isOpen, onClose, onImport, templateHeaders, templateExampleRows, title, requiredFields, }) {
    const [step, setStep] = useState(1);
    const [parsedRows, setParsedRows] = useState([]);
    const [validationErrors, setValidationErrors] = useState([]);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importErrors, setImportErrors] = useState([]);
    const fileInputRef = useRef(null);
    const handleClose = () => {
        setStep(1);
        setParsedRows([]);
        setValidationErrors([]);
        setImporting(false);
        setImportResult(null);
        setImportErrors([]);
        if (fileInputRef.current)
            fileInputRef.current.value = '';
        onClose();
    };
    const validateRows = (rows) => {
        const errs = [];
        rows.forEach((row, i) => {
            requiredFields.forEach(field => {
                if (!row[field] || row[field].trim() === '') {
                    errs.push({ row: i, field, message: 'Required field is empty' });
                }
            });
        });
        return errs;
    };
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result;
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
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Import failed';
            setImportResult({ created: 0, updated: 0, errors: [{ row: -1, message: errorMsg }] });
            setImportErrors([{ row: -1, message: errorMsg }]);
            setStep(4);
        }
        finally {
            setImporting(false);
        }
    };
    if (!isOpen)
        return null;
    const stepLabels = ['Download Template', 'Upload CSV', 'Preview & Validate', 'Confirm & Import'];
    return (_jsxs("dialog", { className: "modal modal-open", children: [_jsxs("div", { className: "modal-box w-11/12 max-w-3xl", children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsx("h3", { className: "font-bold text-lg", children: title }), _jsx("button", { className: "btn btn-sm btn-circle btn-ghost", onClick: handleClose, children: "\u2715" })] }), _jsx("ul", { className: "steps steps-horizontal w-full mb-6 text-xs", children: stepLabels.map((label, i) => (_jsx("li", { className: `step ${step > i ? 'step-primary' : ''}`, children: label }, i))) }), step === 1 && (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-base-content/70", children: "Download the CSV template, fill in your data, then upload it in the next step." }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm table-bordered", children: [_jsx("thead", { children: _jsx("tr", { children: templateHeaders.map(h => _jsx("th", { children: h }, h)) }) }), _jsx("tbody", { children: templateExampleRows.map((row, i) => (_jsx("tr", { className: "text-base-content/60 italic", children: templateHeaders.map(h => _jsx("td", { children: row[h] || '' }, h)) }, i))) })] }) }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { className: "btn btn-primary", onClick: () => downloadTemplate(templateHeaders, templateExampleRows), children: "Download CSV Template" }), _jsx("button", { className: "btn btn-outline", onClick: () => setStep(2), children: "Skip \u2014 I have my file" })] })] })), step === 2 && (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-base-content/70", children: "Select your filled-in CSV file to upload." }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "CSV File" }) }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".csv", className: "file-input file-input-bordered w-full", onChange: handleFileChange })] }), _jsx("div", { className: "flex gap-3", children: _jsx("button", { className: "btn btn-ghost", onClick: () => setStep(1), children: "Back" }) })] })), step === 3 && (_jsxs("div", { className: "space-y-4", children: [_jsx(CSVPreviewTable, { rows: parsedRows, headers: templateHeaders, errors: validationErrors }), validationErrors.length > 0 && (_jsx("div", { className: "alert alert-warning", children: _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-sm", children: "Validation Issues" }), _jsx("p", { className: "text-xs", children: "Rows with errors will be skipped during import." }), _jsx(ValidationErrorList, { errors: validationErrors })] }) })), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { className: "btn btn-ghost", onClick: () => setStep(2), children: "Back" }), _jsxs("button", { className: "btn btn-primary", disabled: validRows.length === 0, onClick: () => setStep(4), children: ["Continue (", validRows.length, " valid rows)"] })] })] })), step === 4 && !importResult && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "stats shadow w-full", children: [_jsxs("div", { className: "stat", children: [_jsx("div", { className: "stat-title", children: "Valid Rows" }), _jsx("div", { className: "stat-value text-success", children: validRows.length })] }), _jsxs("div", { className: "stat", children: [_jsx("div", { className: "stat-title", children: "Skipped Rows" }), _jsx("div", { className: "stat-value text-warning", children: skippedRows })] })] }), _jsxs("p", { className: "text-sm text-base-content/70", children: ["Ready to import ", validRows.length, " row", validRows.length !== 1 ? 's' : '', ". This action cannot be undone."] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { className: "btn btn-ghost", onClick: () => setStep(3), children: "Back" }), _jsxs("button", { className: "btn btn-primary", disabled: importing || validRows.length === 0, onClick: handleImport, children: [importing ? _jsx("span", { className: "loading loading-spinner loading-sm" }) : null, importing ? 'Importing...' : 'Import'] })] })] })), step === 4 && importResult && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "stats shadow w-full", children: [_jsxs("div", { className: "stat", children: [_jsx("div", { className: "stat-title", children: "Created" }), _jsx("div", { className: "stat-value text-success", children: importResult.created })] }), _jsxs("div", { className: "stat", children: [_jsx("div", { className: "stat-title", children: "Updated" }), _jsx("div", { className: "stat-value text-info", children: importResult.updated })] }), _jsxs("div", { className: "stat", children: [_jsx("div", { className: "stat-title", children: "Errors" }), _jsx("div", { className: "stat-value text-error", children: importResult.errors?.length ?? 0 })] })] }), importErrors.length > 0 && (_jsx("div", { className: "alert alert-warning", children: _jsxs("div", { className: "w-full", children: [_jsx("p", { className: "font-semibold text-sm mb-1", children: "Import Errors" }), _jsx(ValidationErrorList, { errors: importErrors }), _jsx("button", { className: "btn btn-xs btn-outline mt-2", onClick: () => downloadErrorReport(templateHeaders, validRows, importErrors), children: "Download Error Report" })] }) })), _jsx("div", { className: "flex gap-3", children: _jsx("button", { className: "btn btn-primary", onClick: handleClose, children: "Done" }) })] }))] }), _jsx("div", { className: "modal-backdrop", onClick: handleClose })] }));
}
