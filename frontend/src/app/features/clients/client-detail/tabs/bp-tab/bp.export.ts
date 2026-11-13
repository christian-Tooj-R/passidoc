/**
 * Tableau de Bord BP — « Export PDF par outil ou global (rapport BP annuel) » (document client,
 * partie 5). Même mise en page sobre que la note de passation (jsPDF + autotable).
 */
import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import { textePassation } from '../../../note-passation.export';
import {
  ACTIVITES_PRIMAIRES, ACTIVITES_SOUTIEN, AXES_DIAGNOSTIC, CATEGORIES_RISQUE, FORCES_PORTER, ItemBp, LIBELLES_ZONES,
  LISTES_ICP, LISTES_PERSONA, NIVEAUX_PORTER, OutilBpVue, ProfilAutoBp, QUADRANTS_BCG, ZONES_BMC, ZONES_CRITICITE,
  ZONES_PESTEL, criticite, infoOutil, menaceGlobalePorter, scoreDiagnostic,
} from '../../../../../core/models/outils-bp.model';

export interface DonneesRapportBp {
  client: string;
  cabinet?: string;
  annee: number;
  outils: OutilBpVue[];
  profil?: ProfilAutoBp | null;
}

type Rgb = [number, number, number];
const NAVY: Rgb = [30, 58, 138];
const ENCRE: Rgb = [15, 23, 42];
const GRIS: Rgb = [100, 116, 139];
const FOND: Rgb = [248, 250, 252];

const rgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const t = (v: unknown) => textePassation(v === null || v === undefined ? '' : String(v));
const puces = (l: ItemBp[] = []) => (l.length ? l.map(i => `• ${t(i.texte)}`).join('\n') : '—');
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');
const nombre = (n: number | null | undefined) => (n === null || n === undefined ? '—' : t(Math.round(n).toLocaleString('fr-FR')));

/** Un outil sans aucune saisie n'apparaît pas dans le rapport complet. */
export function outilRenseigne(o: OutilBpVue): boolean {
  const { ecartees: _e, ...reste } = o.contenu ?? {};
  const plein = (v: any): boolean =>
    Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.values(v).some(plein) : typeof v === 'number' ? v > 0 : !!v;
  return plein(reste);
}

export function construireRapportBp(d: DonneesRapportBp): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const marge = 14;
  const seul = d.outils.length === 1;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(seul ? t(infoOutil(d.outils[0].outil).label.toUpperCase()) : 'RAPPORT BUSINESS PARTNER', marge, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text(t(`${d.cabinet ? `${d.cabinet} — ` : ''}généré le ${new Date().toLocaleDateString('fr-FR')}`), pageW - marge, 11, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...ENCRE);
  doc.text(t(d.client), marge, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(t(`Tableau de bord BP — exercice ${d.annee}`), marge, 25.5);
  let y = 32;

  const titre = (texte: string, couleur: Rgb, statut: string) => {
    if (y > 262) { doc.addPage(); y = 16; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...couleur);
    doc.text(t(texte), marge, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(t(statut), pageW - marge, y, { align: 'right' });
    doc.setDrawColor(...couleur);
    doc.setLineWidth(0.4);
    doc.line(marge, y + 1.6, pageW - marge, y + 1.6);
    y += 4.5;
  };
  const tableau = (head: string[] | null, body: RowInput[], options: Record<string, any> = {}) => {
    autoTable(doc, {
      startY: y,
      margin: { left: marge, right: marge },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 1.8, textColor: ENCRE, lineColor: [226, 232, 240], lineWidth: 0.2, valign: 'top' },
      headStyles: { fillColor: FOND, textColor: GRIS, fontStyle: 'bold', fontSize: 8 },
      ...(head ? { head: [head.map(t)] } : {}),
      body,
      ...options,
    });
    y = (doc as any).lastAutoTable.finalY + 3;
  };
  const ligne = (texte: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...ENCRE);
    doc.text(t(texte), marge, y + 3);
    y += 6;
  };
  const zones = (c: any, codes: readonly string[]) => codes.map(z => [t(LIBELLES_ZONES[z]), puces(c[z])]);
  const libellesCol = { 0: { cellWidth: 46, fontStyle: 'bold' as const } };

  const outils = seul ? d.outils : d.outils.filter(outilRenseigne);
  if (!outils.length) {
    doc.setFontSize(10);
    doc.setTextColor(...GRIS);
    doc.text('Aucun outil renseigné pour cet exercice.', marge, y + 4);
  }

  for (const o of outils) {
    const info = infoOutil(o.outil);
    const c = o.contenu;
    const statut = o.statut === 'VALIDE'
      ? `Validé${o.validePar?.nom ? ` par ${o.validePar.nom}` : ''}${o.valideLe ? ` le ${fmtDate(o.valideLe)}` : ''}`
      : 'Brouillon';
    titre(info.label, rgb(info.couleur), statut);
    switch (o.outil) {
      case 'SWOT':
        tableau(['Forces', 'Faiblesses'], [[puces(c.forces), puces(c.faiblesses)]], { columnStyles: { 0: { cellWidth: (pageW - 2 * marge) / 2 } } });
        tableau(['Opportunités', 'Menaces'], [[puces(c.opportunites), puces(c.menaces)]], { columnStyles: { 0: { cellWidth: (pageW - 2 * marge) / 2 } } });
        break;
      case 'PESTEL':
        tableau(null, zones(c, ZONES_PESTEL), { columnStyles: libellesCol });
        break;
      case 'BMC':
        tableau(null, zones(c, ZONES_BMC), { columnStyles: libellesCol });
        break;
      case 'PORTER': {
        const m = menaceGlobalePorter(c);
        tableau(['Force', 'Niveau', 'Éléments identifiés'], FORCES_PORTER.map(f => [
          t(LIBELLES_ZONES[f]), t(NIVEAUX_PORTER[c.forces[f].niveau].label), puces(c.forces[f].elements),
        ]), { columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' }, 1: { cellWidth: 22 } } });
        ligne(`Menace globale : ${m.score} / ${m.max} — ${m.label}`);
        break;
      }
      case 'CHAINE_VALEUR': {
        const lignes = (codes: readonly string[], type: string) => codes.map(a => {
          const v = c.activites[a];
          return [t(LIBELLES_ZONES[a]), type, v.importance ? `${v.importance}/5` : '—', v.performance ? `${v.performance}/5` : '—', t(v.description) || '—'];
        });
        tableau(['Activité', 'Type', 'Importance', 'Performance', 'Description'],
          [...lignes(ACTIVITES_SOUTIEN, 'Soutien'), ...lignes(ACTIVITES_PRIMAIRES, 'Principale')],
          { columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' }, 1: { cellWidth: 20 }, 2: { cellWidth: 20 }, 3: { cellWidth: 22 } } });
        if (c.marge) ligne(`Marge : ${c.marge}`);
        tableau(['Forces', 'Faiblesses'], [[puces(c.forces), puces(c.faiblesses)]]);
        break;
      }
      case 'DIAGNOSTIC': {
        const s = scoreDiagnostic(c);
        ligne(`Score global : ${s === null ? '—' : `${s} / 5`}`);
        tableau(['Axe', 'Note', 'Notes / analyse'], AXES_DIAGNOSTIC.map(a => [
          t(LIBELLES_ZONES[a]), c.axes[a].score ? `${c.axes[a].score}/5` : '—', t(c.axes[a].note) || '—',
        ]), { columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 14 } } });
        tableau(['Forces', 'Faiblesses'], [[puces(c.forces), puces(c.faiblesses)]]);
        break;
      }
      case 'RISQUES': {
        const tries = c.risques.map((r: any, i: number) => ({ r, n: i + 1, k: criticite(r.probabilite, r.gravite) }))
          .sort((a: any, b: any) => b.k.valeur - a.k.valeur);
        const parZone = Object.entries(ZONES_CRITICITE)
          .map(([z, info]) => `${info.label} : ${tries.filter((x: any) => x.k.zone === z).length}`).join('   ');
        ligne(`Risques par criticité — ${parZone}`);
        tableau(['N°', 'Risque', 'Catégorie', 'P', 'G', 'Criticité', "Plan d'action", 'Responsable', 'Date cible'],
          tries.length ? tries.map((x: any) => [
            String(x.n), t(x.r.nom), t(CATEGORIES_RISQUE.find(k => k.code === x.r.categorie)?.label),
            String(x.r.probabilite), String(x.r.gravite),
            { content: t(`${x.k.valeur} — ${ZONES_CRITICITE[x.k.zone as keyof typeof ZONES_CRITICITE].label}`),
              styles: { fillColor: rgb(ZONES_CRITICITE[x.k.zone as keyof typeof ZONES_CRITICITE].fond) } },
            t(x.r.planAction) || '—', t(x.r.responsable) || '—', fmtDate(x.r.dateCible) || '—',
          ]) : [['', 'Aucun risque identifié', '', '', '', '', '', '', '']],
          { styles: { fontSize: 7.5, cellPadding: 1.5 }, columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 7 }, 4: { cellWidth: 7 } } });
        break;
      }
      case 'PERSONA': {
        const p = c.persona, i = c.icp;
        if (d.profil && !seul) {
          const pr = d.profil;
          tableau(['Profil PASSIDOC (automatique)', ''], [
            ['Secteur', t(pr.secteur) || '—'], ['Effectif', nombre(pr.effectif)], ["Chiffre d'affaires", nombre(pr.ca)],
            ['Croissance du CA', pr.croissanceCa === null ? '—' : `${pr.croissanceCa > 0 ? '+' : ''}${pr.croissanceCa} %`],
            ['Relation', `${pr.ancienneteRelationAns ?? '—'} an(s), ${pr.nbExercices} exercice(s)`],
            ['Dépôt des pièces', t(pr.disciplinePieces.appreciation)],
          ], { columnStyles: libellesCol });
        }
        tableau(['Persona — le dirigeant', ''], [
          ['Âge', t(p.age) || '—'], ['Poste', t(p.poste) || '—'], ['Lieu', t(p.lieu) || '—'], ['Bio / contexte', t(p.bio) || '—'],
          ...LISTES_PERSONA.map(k => [t(LIBELLES_ZONES[k]), puces(p[k])]),
        ], { columnStyles: libellesCol });
        tableau(['Profil client idéal (ICP)', ''], [
          ['Employés', t(i.employes) || '—'], ['CA annuel', t(i.caAnnuel) || '—'], ['Croissance', t(i.croissance) || '—'],
          ...LISTES_ICP.map(k => [t(LIBELLES_ZONES[k]), puces(i[k])]),
        ], { columnStyles: libellesCol });
        break;
      }
      case 'BCG':
        tableau(['Activité', 'Quadrant', "Chiffre d'affaires"], c.activites.length
          ? c.activites.map((a: any) => [t(a.nom), t(QUADRANTS_BCG.find(q => q.code === a.quadrant)?.label), nombre(a.ca)])
          : [['Aucune activité', '', '']]);
        break;
    }
    y += 3;
  }

  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(t(`Tableau de bord BP — ${d.client} — exercice ${d.annee}`), marge, 290);
    doc.text(`Page ${p} / ${n}`, pageW - marge, 290, { align: 'right' });
  }
  return doc;
}

export function exporterRapportBp(d: DonneesRapportBp): void {
  const nom = (d.client || 'dossier').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-');
  const suffixe = d.outils.length === 1 ? d.outils[0].outil.toLowerCase() : 'rapport';
  construireRapportBp(d).save(`bp-${suffixe}-${nom}-${d.annee}.pdf`);
}
