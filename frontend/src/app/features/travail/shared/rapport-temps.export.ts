import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { LigneRapportDetail } from '../../../core/services/saisie-temps.service';
import { formatHeures } from '../../../core/services/duree.util';
import { Groupe, LIBELLES_PRESENCE, aplatir, formatEuros as formatEurosBrut, libelleDimension as libelleDim, recapitulatif, textePdf, totaux } from './rapport-temps.util';

const formatEuros = (n: number | null | undefined) => textePdf(formatEurosBrut(n));

/** Paramètres affichés en tête du rapport, comme le bandeau Tempolia. */
export interface EnteteRapport {
  cabinet: string;
  periode: string;
  regroupements: string;
  detail: boolean;
  restrictions: string[];
}

const COULEURS_NIVEAU: [number, number, number][] = [
  [252, 231, 243], // niveau 1 — rose (Présence)
  [226, 232, 240], // niveau 2 — gris bleu (Client)
  [220, 252, 231], // niveau 3 — vert (Affaire)
];
const TEXTE_NIVEAU: [number, number, number][] = [[157, 23, 77], [30, 41, 59], [21, 128, 61]];

const fmtDate = (d: string) => d.split('-').reverse().join('/');
const libelleDimension = (g: Groupe) => libelleDim(g.dimension);

function celluleLigne(l: LigneRapportDetail): string[] {
  return [
    fmtDate(l.date), l.collaborateur, LIBELLES_PRESENCE[l.presence], l.clientTnf,
    l.affaire ?? '', l.affaireEtat ?? '', l.missionCode ?? '', l.libelle ?? '',
    formatHeures(l.dureeHeures), l.pv ? formatEuros(l.pv) : '0,00',
  ];
}

export function exporterPdf(groupes: Groupe[], lignes: LigneRapportDetail[], entete: EnteteRapport): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(219, 39, 119);
  doc.rect(0, 0, pageW, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Détail des temps passés', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')} par ${entete.cabinet}`, 14, 18.5);

  const infos = [
    `Période : ${entete.periode}`,
    `Regroupements : ${entete.regroupements}`,
    `Lignes de détail : ${entete.detail ? 'Oui' : 'Non'}`,
    ...entete.restrictions.map(r => `Restriction : ${r}`),
  ];
  doc.setTextColor(51, 65, 85);
  infos.forEach((t, i) => doc.text(t, 14, 25 + i * 4.2));

  const nbCol = 10;
  const body: RowInput[] = [];
  for (const g of aplatir(groupes)) {
    const n = Math.min(g.niveau, 3) - 1;
    body.push([{
      content: `${libelleDimension(g)} : ${g.libelle}`,
      colSpan: 8,
      styles: { fillColor: COULEURS_NIVEAU[n], textColor: TEXTE_NIVEAU[n], fontStyle: 'bold' },
    }, {
      content: formatHeures(g.totalHeures), styles: { fillColor: COULEURS_NIVEAU[n], textColor: TEXTE_NIVEAU[n], fontStyle: 'bold', halign: 'right' },
    }, {
      content: formatEuros(g.totalPv), styles: { fillColor: COULEURS_NIVEAU[n], textColor: TEXTE_NIVEAU[n], fontStyle: 'bold', halign: 'right' },
    }]);
    if (entete.detail && !g.enfants.length) {
      for (const l of g.lignes) body.push(celluleLigne(l));
      body.push([
        { content: `Total ${g.libelle}`, colSpan: 8, styles: { fontStyle: 'bold', textColor: TEXTE_NIVEAU[n] } },
        { content: formatHeures(g.totalHeures), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: formatEuros(g.totalPv), styles: { fontStyle: 'bold', halign: 'right' } },
      ]);
    }
  }
  const t = totaux(lignes);
  body.push([
    { content: 'Total général', colSpan: nbCol - 2, styles: { fontStyle: 'bold', fillColor: [30, 41, 59], textColor: 255 } },
    { content: formatHeures(t.heures), styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 41, 59], textColor: 255 } },
    { content: formatEuros(t.pv), styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 41, 59], textColor: 255 } },
  ]);

  autoTable(doc, {
    startY: 27 + infos.length * 4.2,
    head: [['Date', 'Collaborateur', 'Présence', 'Client / TNF', 'Affaire', 'État', 'Tâche', 'Libellé', 'Temps', 'PV Col']],
    body,
    headStyles: { fillColor: [51, 51, 63], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, cellPadding: 1.2, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 17 }, 1: { cellWidth: 26 }, 2: { cellWidth: 25 }, 3: { cellWidth: 30 },
      4: { cellWidth: 16 }, 5: { cellWidth: 9, halign: 'center' }, 6: { cellWidth: 11 },
      7: { cellWidth: 'auto' }, 8: { cellWidth: 15, halign: 'right' }, 9: { cellWidth: 18, halign: 'right' },
    },
    margin: { left: 10, right: 10 },
  });

  // Récapitulatif général (par présence), comme le bas du rapport Tempolia.
  const recap = recapitulatif(lignes, 'presence');
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Récapitulatif général', 'Temps', 'Part', 'PV Col']],
    body: [
      ...recap.map(r => [r.libelle, formatHeures(r.heures), `${Math.round(r.part * 100)} %`, formatEuros(r.pv)]),
      [{ content: 'Total', styles: { fontStyle: 'bold' } }, { content: formatHeures(t.heures), styles: { fontStyle: 'bold' } }, '100 %', { content: formatEuros(t.pv), styles: { fontStyle: 'bold' } }],
    ],
    headStyles: { fillColor: [219, 39, 119], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    tableWidth: 120,
    margin: { left: 10 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} / ${pages}`, pageW - 10, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
  }
  doc.save(`temps-passes-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Classeur Excel : feuille « Détail » (une ligne par saisie, colonnes filtrables) et
 *  feuille « Sous-totaux » (un ligne par groupe, tous niveaux). Temps en heures décimales. */
export function exporterExcel(groupes: Groupe[], lignes: LigneRapportDetail[], entete: EnteteRapport): void {
  const detail = [
    ['Date', 'Collaborateur', 'Présence', 'Client / TNF', 'Affaire', 'État affaire', 'Tâche', 'Libellé', 'Temps (h)', 'Temps', 'Taux horaire', 'PV Col'],
    ...lignes.map(l => [
      fmtDate(l.date), l.collaborateur, LIBELLES_PRESENCE[l.presence], l.clientTnf, l.affaire ?? '', l.affaireEtat ?? '',
      l.missionCode ?? '', l.libelle ?? '', Math.round(l.dureeHeures * 100) / 100, formatHeures(l.dureeHeures),
      l.tauxHoraire ?? '', l.pv,
    ]),
  ];
  const sousTotaux = [
    [`Détail des temps passés — ${entete.periode} — ${entete.regroupements}`],
    ...entete.restrictions.map(r => [r]),
    [],
    ['Niveau', 'Regroupement', 'Libellé', 'Temps (h)', 'Temps', 'PV Col'],
    ...aplatir(groupes).map(g => [g.niveau, libelleDimension(g), `${'   '.repeat(g.niveau - 1)}${g.libelle}`, g.totalHeures, formatHeures(g.totalHeures), g.totalPv]),
    [],
    ['', 'Total général', '', totaux(lignes).heures, formatHeures(totaux(lignes).heures), totaux(lignes).pv],
  ];
  const wb = XLSX.utils.book_new();
  const wsDetail = XLSX.utils.aoa_to_sheet(detail);
  wsDetail['!cols'] = [10, 20, 20, 24, 10, 8, 8, 60, 9, 9, 10, 10].map(wch => ({ wch }));
  wsDetail['!autofilter'] = { ref: `A1:L${detail.length}` };
  const wsTotaux = XLSX.utils.aoa_to_sheet(sousTotaux);
  wsTotaux['!cols'] = [7, 16, 40, 10, 10, 12].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail');
  XLSX.utils.book_append_sheet(wb, wsTotaux, 'Sous-totaux');
  XLSX.writeFile(wb, `temps-passes-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
