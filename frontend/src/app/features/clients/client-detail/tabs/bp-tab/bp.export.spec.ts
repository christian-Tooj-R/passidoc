/**
 * Tableau de Bord BP — export PDF par outil ou rapport BP annuel (document client, partie 5).
 */
import { describe, it, expect } from 'vitest';
import { construireQuestionnaireVierge, construireRapportBp, outilRenseigne } from './bp.export';
import { OutilBpVue } from '../../../../../core/models/outils-bp.model';

const vue = (outil: any, contenu: any, o: Partial<OutilBpVue> = {}): OutilBpVue =>
  ({ outil, contenu, statut: 'BROUILLON', valideLe: null, validePar: null, modifieLe: null, origine: 'ENREGISTRE', ...o });

const swot = vue('SWOT', {
  forces: [{ id: '1', texte: 'Clientèle fidèle' }], faiblesses: [], opportunites: [], menaces: [{ id: '2', texte: 'Grande surface' }], ecartees: [],
}, { statut: 'VALIDE', validePar: { id: 3, nom: 'Marie Dubois' }, valideLe: '2026-11-12T10:00:00Z' });
const risques = vue('RISQUES', { risques: [
  { id: 'a', nom: 'Retard TVA', description: '', categorie: 'FISCAL', probabilite: 4, gravite: 4, planAction: 'Relancer le client', responsable: 'Marie', dateCible: '2026-12-31' },
], ecartees: [] });
const pestelVide = vue('PESTEL', { politique: [], economique: [], socioculturel: [], technologique: [], environnemental: [], legal: [], ecartees: ['x'] }, { origine: 'VIDE' });

const texte = (outils: OutilBpVue[]) =>
  construireRapportBp({ client: 'Boulangerie Hoarau', cabinet: 'AFYM', annee: 2026, outils }).output();

describe('Export PDF du Tableau de bord BP', () => {
  it('rapport complet : en-tête, outils renseignés avec leur statut, outils vides absents', () => {
    const pdf = texte([swot, risques, pestelVide]);
    for (const t of ['RAPPORT BUSINESS PARTNER', 'Boulangerie Hoarau', 'exercice 2026', 'SWOT', 'Validé par Marie Dubois le 12/11/2026',
      'Clientèle fidèle', 'Grande surface', 'Matrice de risques', 'Brouillon', 'Retard TVA', 'Fiscal', 'Inacceptable', 'Relancer le client']) {
      expect(pdf, t).toContain(t);
    }
    expect(pdf).toMatch(/\(16 . Inacceptable\)/);
    expect(pdf).not.toContain('PESTEL');
  });

  it('un seul outil : titré par l’outil, même vide', () => {
    const pdf = texte([pestelVide]);
    expect(pdf).toContain('PESTEL');
    expect(pdf).not.toContain('RAPPORT BUSINESS PARTNER');
  });

  it('rapport sans aucun outil renseigné : message explicite', () => {
    expect(texte([pestelVide, vue('BCG', { activites: [], ecartees: [] })])).toContain('Aucun outil renseigné pour cet exercice.');
  });

  it('outil renseigné : les suggestions écartées seules ne comptent pas', () => {
    expect(outilRenseigne(pestelVide)).toBe(false);
    expect(outilRenseigne(swot)).toBe(true);
    expect(outilRenseigne(vue('DIAGNOSTIC', { axes: { finance: { score: 0, note: '' } }, forces: [], faiblesses: [] }))).toBe(false);
    expect(outilRenseigne(vue('DIAGNOSTIC', { axes: { finance: { score: 3, note: '' } }, forces: [], faiblesses: [] }))).toBe(true);
  });

  it('entretien en annexe du rapport, commentaire de validation, bloc de signatures', () => {
    const entretien = vue('ENTRETIEN', { date: '2026-11-13', participants: 'M. Hoarau', reponses: { concurrents: 'Boulangerie Dupont' }, notes: { numerique: 2, satisfaction: 4 }, ecartees: [] });
    const swotCommente = { ...swot, commentaire: 'À revoir en juin' };
    const pdf = construireRapportBp({
      client: 'Boulangerie Hoarau', annee: 2026, outils: [entretien, swotCommente],
      signatures: { date: '2026-11-13T10:00:00Z', bp: { nom: 'Marie Dubois', image: '' }, dirigeant: { nom: 'M. Hoarau', image: '' } },
    }).output();
    for (const t of ['Commentaire du BP', 'À revoir en juin', 'Entretien BP', 'Contexte stratégique', 'Boulangerie Dupont', '4 / 5',
      'Signatures', 'Marie Dubois']) {
      expect(pdf, t).toContain(t);
    }
    expect(pdf).toMatch(/Le Business Partner . Marie Dubois/);   // tiret cadratin encodé dans le PDF
    expect(pdf).toMatch(/Le dirigeant . M\. Hoarau/);
    expect(pdf.indexOf('SWOT')).toBeLessThan(pdf.indexOf('Contexte stratégique'));
  });

  it('questionnaire vierge : les 5 thèmes et les questions, sans réponse', () => {
    const pdf = construireQuestionnaireVierge({ client: 'Boulangerie Hoarau', annee: 2026 }).output();
    expect(pdf).toContain("QUESTIONNAIRE D'ENTRETIEN BUSINESS PARTNER");
    expect(pdf).toContain('Satisfaction sur les services du cabinet');
    expect(pdf).toContain('Quelles menaces percevez-vous ?');
  });
});
