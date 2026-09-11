/**
 * Export CSV réutilisable — factorise le mécanisme initialement écrit dans
 * "Détail des temps" (travail-temps-detail.component.ts) pour être partagé par
 * toutes les vues du module Travail (Par jour / Par semaine / Par mois / Détail)
 * plutôt que dupliqué sur chaque page.
 *
 * Séparateur ";" (compatible Excel FR), BOM UTF-8 pour les accents.
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

export function exportRowsToCsv<T>(rows: T[], columns: CsvColumn<T>[], filenamePrefix: string): void {
  if (!rows || rows.length === 0) return;

  const headers = columns.map(c => c.header);
  const lines = [
    headers.join(';'),
    ...rows.map(r => columns
      .map(c => {
        const v = c.value(r);
        return (v === null || v === undefined ? '' : String(v)).replace(/;/g, ',');
      })
      .join(';')),
  ];

  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
