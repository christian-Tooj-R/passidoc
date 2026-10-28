import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  MissionCabinet, STATUTS_MISSION, SyntheseMissions, formatMontant, libelleStatut, nomCycle, nomPersonne,
} from '../../core/models/mission.model';
import { textePdf } from '../travail/shared/rapport-temps.util';

const fmtDate = (d: string | null | undefined) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');
const eur = (v: number | null | undefined) => textePdf(formatMontant(v));

/** Export Excel du tableau consolidé, filtres actifs appliqués (CDC §5.5). */
export function exporterMissionsExcel(missions: MissionCabinet[], nomFichier: string): void {
  const lignes = missions.map(m => ({
    'Dossier client': m.client.nom,
    'Intitulé mission': m.titre,
    "Cycle d'origine": m.cycle ? `${m.cycle} — ${nomCycle(m.cycle)}` : 'Hors cycle',
    'Statut': libelleStatut(m.statut) + (m.archivee ? ' (archivée)' : ''),
    'Montant estimé HT (€)': m.honoraires ?? '',
    'Date de relance': fmtDate(m.dateRelance),
    'À relancer': m.aRelancer ? 'Oui' : '',
    'Responsable': nomPersonne(m.responsable),
    'Secteur / activité': m.client.secteur ?? '',
    'Dernière modification': fmtDate(m.updatedAt),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lignes), 'Missions');
  XLSX.writeFile(wb, nomFichier);
}

export interface EnteteRapportMissions {
  cabinet: string;
  /** Mois couvert par la section « Évolutions du mois », AAAA-MM. */
  mois: string;
  filtres: string[];
}

/**
 * Rapport mensuel des missions (CDC §5.5) : indicateurs, synthèse par statut, missions par
 * statut, et missions dont le statut a changé dans le mois.
 */
export function exporterRapportMensuelPdf(missions: MissionCabinet[], kpi: SyntheseMissions, entete: EnteteRapportMissions): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const [a, m] = entete.mois.split('-').map(Number);
  const libelleMois = new Date(a, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`Rapport des missions — ${libelleMois}`, 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(textePdf(`Généré le ${new Date().toLocaleString('fr-FR')} — ${entete.cabinet}`), 14, 18.5);
  if (entete.filtres.length) doc.text(textePdf(`Filtres : ${entete.filtres.join(' · ')}`), 14, 23);

  // Indicateurs clés
  const cartes: [string, string][] = [
    ['Missions proposées', String(kpi.proposees.nombre)],
    ['Potentiel total HT', eur(kpi.potentiel)],
    ['Signé HT', eur(kpi.acceptees.montant)],
    ['Taux de conversion', kpi.tauxConversion == null ? '—' : `${kpi.tauxConversion} %`],
    ['À relancer', String(kpi.aRelancer)],
  ];
  const w = (pageW - 28 - 4 * 4) / 5;
  cartes.forEach(([l, v], i) => {
    const x = 14 + i * (w + 4);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, 28, w, 17, 2, 2, 'FD');
    doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.text(l.toUpperCase(), x + 4, 33.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(15, 23, 42); doc.text(v, x + 4, 41.5);
    doc.setFont('helvetica', 'normal');
  });

  // Synthèse par statut
  const parStatut = STATUTS_MISSION.map(s => {
    const l = missions.filter(x => x.statut === s.code && !x.archivee);
    return [s.libelle, String(l.length), eur(l.reduce((t, x) => t + (Number(x.honoraires) || 0), 0))];
  });
  autoTable(doc, {
    startY: 51,
    head: [['Statut', 'Missions', 'Montant estimé HT']],
    body: parStatut,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    tableWidth: 120,
    margin: { left: 14 },
  });

  const colonnes = [['Dossier', 'Intitulé', 'Cycle', 'Montant HT', 'Relance', 'Responsable', 'Secteur']];
  const ligne = (x: MissionCabinet) => [
    x.client.nom, x.titre, x.cycle ? `${x.cycle} · ${nomCycle(x.cycle)}` : 'Hors cycle', eur(x.honoraires),
    fmtDate(x.dateRelance) + (x.aRelancer ? ' (à relancer)' : ''), nomPersonne(x.responsable), x.client.secteur ?? '',
  ].map(textePdf);

  // Évolutions du mois : statut modifié dans le mois couvert.
  const evolutions = missions.filter(x => (x.statutModifieLe ?? '').slice(0, 7) === entete.mois);
  const sections: [string, MissionCabinet[]][] = [
    [`Évolutions du mois (${evolutions.length})`, evolutions],
    ...STATUTS_MISSION.map(s => [`${s.libelle} (${missions.filter(x => x.statut === s.code && !x.archivee).length})`,
      missions.filter(x => x.statut === s.code && !x.archivee)] as [string, MissionCabinet[]]),
  ];
  for (const [titre, liste] of sections) {
    if (!liste.length) continue;
    let y = ((doc as any).lastAutoTable?.finalY ?? 60) + 9;
    if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 16; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(15, 23, 42);
    doc.text(textePdf(titre), 14, y);
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
      startY: y + 2,
      head: titre.startsWith('Évolutions') ? [['Statut', ...colonnes[0]]] : colonnes,
      body: liste.map(x => titre.startsWith('Évolutions') ? [libelleStatut(x.statut), ...ligne(x)] : ligne(x)),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak' },
      headStyles: { fillColor: [79, 70, 229] },
      showHead: 'everyPage',
      margin: { left: 14, right: 14 },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
    doc.text(`Page ${p} / ${pages}`, pageW - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
  }
  doc.save(`rapport-missions-${entete.mois}.pdf`);
}

/** Point d'injection des exports (remplaçable dans les tests). */
@Injectable({ providedIn: 'root' })
export class MissionsExportService {
  excel(missions: MissionCabinet[], nomFichier: string) { exporterMissionsExcel(missions, nomFichier); }
  rapportMensuel(missions: MissionCabinet[], kpi: SyntheseMissions, entete: EnteteRapportMissions) {
    exporterRapportMensuelPdf(missions, kpi, entete);
  }
}
