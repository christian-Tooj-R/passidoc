import { describe, it, expect } from 'vitest';
import {
  CYCLES_MISSIONS, compterRecommandations, formatMontant, initialesPersonne, libelleStatut, nomCycle,
  peutSupprimerMission, resumeStatuts,
} from './mission.model';

const sp = (s: string) => s.replace(/[  ]/g, ' ');

describe('mission.model', () => {
  it('10 cycles du CDC, « Hors cycle » sans code', () => {
    expect(CYCLES_MISSIONS.map(c => c.code).join(',')).toBe('IMM,CAP,EMP,FRS,CLI,SOC,FIS,TRE,STK,DIV');
    expect(nomCycle('FIS')).toBe('Fiscal & TVA');
    expect(nomCycle(null)).toBe('Hors cycle');
  });

  it('libellés de statut et règle de suppression (R7)', () => {
    expect(libelleStatut('EN_DISCUSSION')).toBe('En discussion');
    expect(libelleStatut('X')).toBe('—');
    expect(peutSupprimerMission('PROPOSEE')).toBe(true);
    expect(peutSupprimerMission('SANS_SUITE')).toBe(true);
    expect(peutSupprimerMission('ACCEPTEE')).toBe(false);
    expect(peutSupprimerMission('REFUSEE')).toBe(false);
  });

  it('montant : séparateur de milliers, « — » si non renseigné (R6)', () => {
    expect(sp(formatMontant(13300))).toBe('13 300 €');
    expect(sp(formatMontant(0))).toBe('0 €');
    expect(formatMontant(null)).toBe('—');
  });

  it('une recommandation par ligne non vide (puces ignorées)', () => {
    expect(compterRecommandations('Diversifier.\n\n- Suivre la concentration\n•   \n')).toBe(2);
    expect(compterRecommandations('')).toBe(0);
    expect(compterRecommandations(null)).toBe(0);
  });

  it('résumé des statuts du cycle, du plus fréquent au moins fréquent, archivées exclues', () => {
    expect(resumeStatuts([
      { statut: 'ACCEPTEE', archivee: false },
      { statut: 'EN_DISCUSSION', archivee: false },
      { statut: 'EN_DISCUSSION', archivee: false },
      { statut: 'REFUSEE', archivee: true },
    ]).map(r => r.libelle)).toEqual(['2 en discussion', '1 acceptée']);
  });

  it('initiales du responsable', () => {
    expect(initialesPersonne({ id: 1, firstName: 'marie', lastName: 'Dubois' })).toBe('MD');
    expect(initialesPersonne(null)).toBe('');
  });
});
