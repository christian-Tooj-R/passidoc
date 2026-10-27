import jsPDF from 'jspdf';
import autoTable, { CellDef, RowInput } from 'jspdf-autotable';
import { Client, QuestionnaireAdnGlobal, approcheClient } from '../../core/models/client.model';
import { ItemFiche, SectionFiche, sectionsAdnGlobal } from './adn-lecture.util';

/**
 * Note de passation (cahier v2 #8) : uniquement la fiche d'identité et l'ADN entreprise, pour
 * transmettre l'essentiel d'un dossier lors d'un changement de collaborateur. Tâches, temps,
 * documents, flux, analyse financière et historique en sont volontairement exclus.
 * A4 portrait, une à deux pages : les rubriques non renseignées de l'ADN sont omises.
 */
export interface DonneesNotePassation {
  cabinet: string;
  client: Client;
  siteLibelle: string;
  /** Intitulés des intervenants (cahier v2 #7) : [responsable, collaborateurOuest]. */
  intervenants: [string, string];
  adnGlobal: Partial<QuestionnaireAdnGlobal> | null;
  secteurLibelle: string | null;
  itemsSectoriels: ItemFiche[];
}

const NAVY: [number, number, number] = [30, 58, 138];
const TEAL: [number, number, number] = [15, 118, 110];
const GRIS: [number, number, number] = [100, 116, 139];
const ENCRE: [number, number, number] = [15, 23, 42];
const FOND_LIBELLE: [number, number, number] = [248, 250, 252];

const COULEUR_APPROCHE: Record<string, [number, number, number]> = {
  FORMEL: [30, 58, 138], PROFESSIONNEL: [29, 78, 216], AMICAL: [21, 128, 61], INFORMEL: [194, 65, 12],
};

/** Polices standard du PDF (WinAnsi) : espaces fines → espaces, caractères hors jeu retirés (émojis…). */
export function textePassation(t: string | null | undefined): string {
  return (t ?? '')
    .replace(/[  ]/g, ' ')
    .replace(/[^\x00-\xffŒœŠšŸŽž–—‘’“”•…€]/g, '')
    .trim();
}

const vide = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && (!v.trim() || v.trim() === '—'));
const val = (v: unknown, defaut = 'Non renseigné') => (vide(v) ? defaut : textePassation(String(v)));
const nomPersonne = (p?: { firstName?: string; lastName?: string } | null) =>
  p ? textePassation(`${p.firstName ?? ''} ${p.lastName ?? ''}`) || '—' : 'Non assigné';
const fmtDate = (d?: string | null) => {
  if (!d) return null;
  const x = new Date(d);
  return isNaN(x.getTime()) ? d : x.toLocaleDateString('fr-FR');
};

/** Contact légal : nom/fonction saisis, à défaut le premier gérant repris de Pappers. */
export function contactLegalNote(client: Client) {
  const f = client.ficheIdentite;
  const gerant = (f?.gerants ?? []).find(g => g?.nom?.trim());
  const nom = f?.contactLegalNom?.trim() || gerant?.nom?.trim() || '';
  return {
    nom,
    fonction: f?.contactLegalFonction?.trim() || (nom && !f?.contactLegalNom?.trim() ? 'Gérant' : ''),
    telephone: f?.telephoneContact?.trim() || '',
    email: f?.emailContact?.trim() || '',
  };
}

/** Rangées « libellé | valeur | libellé | valeur » ; un champ long occupe toute la largeur. */
function rangeesParPaires(items: ItemFiche[]): RowInput[] {
  const libelle = (t: string): CellDef => ({ content: textePassation(t), styles: { fontStyle: 'bold', textColor: GRIS, fillColor: FOND_LIBELLE } });
  const rows: RowInput[] = [];
  let enCours: CellDef[] = [];
  // Un seul champ restant sur la rangée : sa valeur occupe toute la largeur (pas de cases vides).
  const vider = () => {
    if (enCours.length === 2) rows.push([enCours[0], { ...enCours[1], colSpan: 3 }]);
    else if (enCours.length) rows.push(enCours);
    enCours = [];
  };
  for (const it of items) {
    const cellule: CellDef = { content: val(it.value), styles: it.warn ? { textColor: [180, 83, 9] } : {} };
    if (it.full || String(it.value ?? '').length > 60) {
      vider();
      rows.push([libelle(it.label), { ...cellule, colSpan: 3 }]);
    } else {
      enCours.push(libelle(it.label), cellule);
      if (enCours.length === 4) vider();
    }
  }
  vider();
  return rows;
}

export function construireNotePassation(d: DonneesNotePassation): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const marge = 14;
  const largeur = pageW - marge * 2;
  const c = d.client;
  const f = c.ficheIdentite;

  // ── En-tête ──
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('NOTE DE PASSATION', marge, 11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRIS);
  doc.setFontSize(8);
  doc.text(textePassation(`${d.cabinet} — générée le ${new Date().toLocaleDateString('fr-FR')}`), pageW - marge, 11, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...ENCRE);
  doc.text(textePassation(c.nom), marge, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const sousTitre = [
    textePassation(d.siteLibelle),
    d.secteurLibelle ? textePassation(d.secteurLibelle) : null,
    fmtDate(c.createdAt) ? `Client du cabinet depuis le ${fmtDate(c.createdAt)}` : null,
  ].filter(Boolean).join('  •  ');
  doc.text(sousTitre, marge, 25.5);

  // ── Intervenants ──
  autoTable(doc, {
    startY: 29,
    margin: { left: marge, right: marge },
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: { top: 1.6, bottom: 1.6, left: 2.5, right: 2.5 }, textColor: ENCRE },
    head: [[ 'Directeur', textePassation(d.intervenants[0]), textePassation(d.intervenants[1]) ]],
    headStyles: { fontStyle: 'bold', textColor: GRIS, fontSize: 7.5, fillColor: FOND_LIBELLE },
    body: [[ nomPersonne(c.directeur), nomPersonne(c.responsable), nomPersonne(c.collaborateurOuest) ]],
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.2,
  });

  // ── Approche client ──
  const a = approcheClient(f?.approcheClient);
  let y = (doc as any).lastAutoTable.finalY + 4;
  const coul = COULEUR_APPROCHE[a.value] ?? NAVY;
  doc.setFillColor(...coul);
  doc.rect(marge, y, 1.4, 9, 'F');
  doc.setFillColor(248, 250, 252);
  doc.rect(marge + 1.4, y, largeur - 1.4, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...coul);
  const libApproche = textePassation(`Approche client : ${a.libelle}`);
  doc.text(libApproche, marge + 4, y + 5.8);
  const xDescription = marge + 4 + doc.getTextWidth(libApproche) + 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(textePassation(`— ${a.description}`), xDescription, y + 5.8);
  y += 14;

  const titre = (t: string, couleur: [number, number, number] = NAVY) => {
    if (y > 265) { doc.addPage(); y = 16; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...couleur);
    doc.text(textePassation(t), marge, y);
    doc.setDrawColor(...couleur);
    doc.setLineWidth(0.4);
    doc.line(marge, y + 1.6, pageW - marge, y + 1.6);
    y += 4;
  };
  const tableau = (rows: RowInput[], options: Record<string, any> = {}) => {
    autoTable(doc, {
      startY: y,
      margin: { left: marge, right: marge },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 1.8, textColor: ENCRE, lineColor: [226, 232, 240], lineWidth: 0.2, valign: 'top' },
      columnStyles: { 0: { cellWidth: 34 }, 2: { cellWidth: 34 } },
      body: rows,
      ...options,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  };

  // ── 1. Fiche d'identité ──
  titre("1. Fiche d'identité");
  tableau(rangeesParPaires([
    { label: 'Raison sociale', value: f?.raisonSociale || c.nom },
    { label: 'Forme juridique', value: f?.formeJuridique ?? '' },
    { label: 'SIREN', value: f?.siren ?? '' },
    { label: 'SIRET', value: f?.siret ?? '' },
    { label: 'Adresse', value: f?.adresse ?? '', full: true },
    { label: 'Date de création', value: fmtDate((f as any)?.dateCreation) ?? '' },
    { label: 'Capital', value: (f as any)?.capital != null ? `${Number((f as any).capital).toLocaleString('fr-FR')} €` : '' },
    { label: 'Activité', value: f?.activite ?? '', full: true },
  ]));

  // ── 2. Contacts ──
  titre('2. Contacts', TEAL);
  const legal = contactLegalNote(c);
  const oper = f?.contactOperationnel ?? {};
  const lib = (t: string): CellDef => ({ content: t, styles: { fontStyle: 'bold', textColor: GRIS, fillColor: FOND_LIBELLE } });
  tableau([
    [lib('Nom / Prénom'), val(legal.nom, '—'), val(oper.nom, '—')],
    [lib('Fonction'), val(legal.fonction, '—'), val(oper.poste, '—')],
    [lib('Téléphone'), val(legal.telephone, '—'), val(oper.telephone, '—')],
    [lib('Email'), val(legal.email, '—'), val(oper.email, '—')],
  ], {
    head: [[ '', 'Contact légal — juridique, engagements', 'Contact opérationnel — échanges du quotidien' ]],
    headStyles: { fillColor: [241, 245, 249], textColor: ENCRE, fontStyle: 'bold', fontSize: 8.5 },
    didParseCell: (h: any) => {
      if (h.section === 'head' && h.column.index === 1) h.cell.styles.textColor = NAVY;
      if (h.section === 'head' && h.column.index === 2) h.cell.styles.textColor = TEAL;
    },
    columnStyles: { 0: { cellWidth: 34 } },
  });

  // ── 3. ADN entreprise ──
  titre('3. ADN entreprise');
  const fonctionnement: ItemFiche[] = [
    { label: 'Activité principale', value: f?.activitePrincipale ?? '', full: true },
    { label: 'Type de clientèle', value: f?.typeClientele ?? '' },
    { label: 'Saisonnalité', value: f?.saisonnalite ?? '' },
    { label: 'Points de vente / particularités', value: f?.pointsDeVente ?? '', full: true },
  ].filter(i => !vide(i.value));
  const sections: SectionFiche[] = [
    ...(fonctionnement.length ? [{ titre: 'Activité & fonctionnement', items: fonctionnement }] : []),
    ...sectionsAdnGlobal(d.adnGlobal).map(s => ({ ...s, items: s.items.filter(i => !vide(i.value)) })),
    ...(d.itemsSectoriels.some(i => !vide(i.value))
      ? [{ titre: `Questionnaire sectoriel — ${d.secteurLibelle ?? ''}`, items: d.itemsSectoriels.filter(i => !vide(i.value)) }]
      : []),
  ].filter(s => s.items.length);

  if (!vide(f?.pointsVigilance)) {
    tableau([[{ content: 'Points de vigilance', styles: { fontStyle: 'bold', textColor: [180, 83, 9], fillColor: [255, 247, 237] } },
      { content: val(f?.pointsVigilance), colSpan: 3, styles: { fillColor: [255, 251, 245] } }]]);
  }
  if (!sections.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    doc.text("ADN entreprise non renseigné : à compléter dans l'onglet ADN du dossier.", marge, y + 2);
    y += 8;
  }
  // Titre de rubrique en en-tête de tableau : répété en haut de page si la rubrique est coupée,
  // et jamais laissé seul en bas d'une page.
  for (const s of sections) {
    if (y > 262) { doc.addPage(); y = 16; }
    tableau(rangeesParPaires(s.items), {
      head: [[{ content: textePassation(s.titre), colSpan: 4 }]],
      headStyles: { fontStyle: 'bold', fillColor: [238, 242, 255], textColor: NAVY, fontSize: 8.5 },
      showHead: 'everyPage',
    });
    y -= 3;
  }

  // ── Pied de page ──
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(textePassation(`Note de passation — ${c.nom} — document interne`), marge, 290);
    doc.text(`Page ${p} / ${n}`, pageW - marge, 290, { align: 'right' });
  }
  return doc;
}

export function exporterNotePassation(d: DonneesNotePassation): void {
  const nom = (d.client.nom || 'dossier').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-');
  construireNotePassation(d).save(`note-passation-${nom}.pdf`);
}
