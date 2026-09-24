import * as XLSX_STYLE from 'xlsx-js-style';
import * as XLSX from 'xlsx';

const HEADER_STYLE = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
    fill: { fgColor: { rgb: "4F46E5" } }, // Indigo-600
    alignment: { horizontal: "center", vertical: "center" },
    border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
    }
};

const CELL_STYLE = {
    border: {
        top: { style: "thin", color: { rgb: "CCCCCC" } },
        bottom: { style: "thin", color: { rgb: "CCCCCC" } },
        left: { style: "thin", color: { rgb: "CCCCCC" } },
        right: { style: "thin", color: { rgb: "CCCCCC" } }
    },
    alignment: { vertical: "center" }
};

const applyStyles = (ws: XLSX_STYLE.WorkSheet, data: any[], headers: string[]) => {
    // 1. Column Widths
    const colWidths = headers.map(key => {
        let maxLen = key.length;
        data.forEach(row => {
            const val = row[key] ? String(row[key]) : "";
            if (val.length > maxLen) maxLen = val.length;
        });
        return { wch: maxLen + 5 }; // Buffer
    });
    ws['!cols'] = colWidths;

    // 2. Iterate Cells
    const range = XLSX_STYLE.utils.decode_range(ws['!ref'] || 'A1');

    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX_STYLE.utils.encode_cell({ c: C, r: R });
            if (!ws[cellRef]) continue;

            if (R === 0) {
                // Header
                ws[cellRef].s = HEADER_STYLE;
                ws[cellRef].v = ws[cellRef].v.toString().toUpperCase(); // Uppercase Headers
            } else {
                // Body
                ws[cellRef].s = CELL_STYLE;

                // Enforce Text Format for specific columns
                const header = headers[C];
                const lower = header.toLowerCase();
                if (lower.includes('nisn') || lower.includes('nip') || lower.includes('kode') || lower.includes('nik') || lower.includes('hp')) {
                    ws[cellRef].t = 's'; // Force string type
                    ws[cellRef].z = '@'; // Force text format
                    // Merge with existing style
                    ws[cellRef].s = { ...CELL_STYLE, numFmt: '@' };
                }
            }
        }
    }
};

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
    const ws = XLSX_STYLE.utils.json_to_sheet(data);

    if (data.length > 0) {
        const headers = Object.keys(data[0]);
        applyStyles(ws, data, headers);
    }

    const wb = XLSX_STYLE.utils.book_new();
    XLSX_STYLE.utils.book_append_sheet(wb, ws, sheetName);
    XLSX_STYLE.writeFile(wb, `${fileName}.xlsx`);
};

export const generateTemplate = (headers: string[], fileName: string) => {
    // Determine text-format columns (NISN, NIP, KODE, etc.)
    const textColumns = headers.map(h => {
        const lower = h.toLowerCase();
        return lower.includes('nisn') || lower.includes('nip') || lower.includes('kode') || lower.includes('nik') || lower.includes('hp') ? true : false;
    });

    // Create Headers
    const ws = XLSX_STYLE.utils.aoa_to_sheet([headers]);

    // Apply Column Widths
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 10, 15) }));
    ws['!cols'] = colWidths;

    // Apply Styles to Header
    const range = XLSX_STYLE.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX_STYLE.utils.encode_cell({ c: C, r: 0 });
        if (!ws[cellRef]) continue;
        ws[cellRef].s = HEADER_STYLE;
        ws[cellRef].v = String(ws[cellRef].v).toUpperCase();
    }

    // Pre-format next 50 rows as Text for ID columns to guide user
    // This helps Excel treat typed numbers as text automatically in these cells
    for (let R = 1; R <= 50; ++R) {
        for (let C = 0; C < headers.length; ++C) {
            if (textColumns[C]) {
                const cellRef = XLSX_STYLE.utils.encode_cell({ c: C, r: R });
                ws[cellRef] = { v: '', t: 's', z: '@' }; // t='s' (string), z='@' (Text format)
                // Also apply basic border style if desired
                ws[cellRef].s = {
                    alignment: { wrapText: true },
                    numFmt: '@'
                };
            }
        }
    }

    // Update ref to include pre-formatted rows
    ws['!ref'] = XLSX_STYLE.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: headers.length - 1, r: 50 } });

    const wb = XLSX_STYLE.utils.book_new();
    XLSX_STYLE.utils.book_append_sheet(wb, ws, 'Template');
    XLSX_STYLE.writeFile(wb, `${fileName}_Template.xlsx`);
}


export const readExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            setTimeout(() => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet);
                    resolve(jsonData);
                } catch (err) {
                    console.error("Excel Parsing Error:", err);
                    reject(new Error("Gagal membaca file Excel. Pastikan format valid."));
                }
            }, 0);
        };

        reader.onerror = (err) => reject(new Error("Gagal membaca file."));
        reader.readAsArrayBuffer(file);
    });
};

// Client-side: parse Excel file → JSON array (browser only)
export const importFromExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                resolve(json);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

// Client-side: generate and download a blank template Excel file
export const downloadTemplate = (columns: string[], fileName: string) => {
    // Detect text-format columns (IDs that should not be auto-converted to numbers)
    const textColumns = columns.map((h) => {
        const lower = h.toLowerCase();
        return (
            lower.includes('nisn') ||
            lower.includes('nip') ||
            lower.includes('kode') ||
            lower.includes('nik') ||
            lower.includes('hp')
        );
    });

    // Create header row
    const ws = XLSX_STYLE.utils.aoa_to_sheet([columns]);

    // Column widths
    const colWidths = columns.map((h) => ({ wch: Math.max(h.length + 10, 15) }));
    ws['!cols'] = colWidths;

    // Style header row
    const range = XLSX_STYLE.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX_STYLE.utils.encode_cell({ c: C, r: 0 });
        if (!ws[cellRef]) continue;
        ws[cellRef].s = HEADER_STYLE;
        ws[cellRef].v = String(ws[cellRef].v).toUpperCase();
    }

    // Pre-format 50 rows as text for ID columns to guide user input
    for (let R = 1; R <= 50; ++R) {
        for (let C = 0; C < columns.length; ++C) {
            if (textColumns[C]) {
                const cellRef = XLSX_STYLE.utils.encode_cell({ c: C, r: R });
                ws[cellRef] = { v: '', t: 's', z: '@' };
                ws[cellRef].s = { alignment: { wrapText: true }, numFmt: '@' };
            }
        }
    }

    ws['!ref'] = XLSX_STYLE.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: columns.length - 1, r: 50 },
    });

    const wb = XLSX_STYLE.utils.book_new();
    XLSX_STYLE.utils.book_append_sheet(wb, ws, 'Template');
    XLSX_STYLE.writeFile(wb, `${fileName}_Template.xlsx`);
};
