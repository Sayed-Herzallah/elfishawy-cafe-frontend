/** Create an Excel-friendly UTF-8 CSV; quote every cell and escape embedded quotes. */
export function buildCsv(rows: Array<Array<string | number | null | undefined>>): string {
  const escapeCell = (value: string | number | null | undefined) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')}`;
}

export function downloadCsv(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.toLowerCase().endsWith('.csv') ? fileName : `${fileName}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
