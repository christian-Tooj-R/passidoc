/**
 * Tableau de Bord BP — export PDF par outil ou rapport BP annuel (document client, partie 5).
 */
import { describe, it, expect } from 'vitest';
import { construireRapportBp, outilRenseigne } from './bp.export';
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
});
