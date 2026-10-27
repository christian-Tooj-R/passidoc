import { describe, it, expect } from 'vitest';
import type { LigneRapportDetail } from '../../../core/services/saisie-temps.service';
import { aplatir, grouper, recapitulatif, totaux, trierLignes, libelleMois, REGROUPEMENT_TEMPOLIA, DIMENSIONS, definirLibellesLieu } from './rapport-temps.util';

let seq = 0;
function ligne(p: Partial<LigneRapportDetail>): LigneRapportDetail {
  return {
    id: ++seq, source: 'SAISIE', date: '2026-10-16', collaborateurId: 1, collaborateur: 'AAM',
    presence: 'FACTURABLE', clientId: 1, client: 'TRANSMAS', clientTnf: 'TRANSMAS',
    affaire: 'C2026-09', affaireEtat: 'O', missionCode: 'REV', categorie: null, libelle: null,
    dureeHeures: 1, tauxHoraire: 100, tauxFige: true, pv: 100, heureDebut: null, heureFin: null, isLocked: false,
    ...p,
  };
}

describe('rapport-temps.util', () => {
  const lignes = [
    ligne({ collaborateur: 'JULIE', collaborateurId: 3, date: '2026-02-17', dureeHeures: 0.65, pv: 13 }),
    ligne({ collaborateur: 'AAM', date: '2026-10-16', dureeHeures: 3, pv: 300 }),
    ligne({ collaborateur: 'AAM', date: '2026-10-12', dureeHeures: 1.5, pv: 150 }),
    ligne({ clientId: 2, client: 'TRANSMASCA', clientTnf: 'TRANSMASCA', dureeHeures: 2.5, pv: 250 }),
    ligne({ presence: 'NON_FACTURABLE', clientId: null, client: null, clientTnf: 'Formation', affaire: null, missionCode: null, dureeHeures: 2, pv: 0 }),
    ligne({ presence: 'ABSENCE', source: 'ABSENCE', clientId: null, client: null, clientTnf: 'Congés payés', affaire: null, missionCode: null, dureeHeures: 7, pv: 0 }),
  ];

  it('regroupe comme Tempolia : présence > client/TNF > affaire, avec sous-totaux', () => {
    const arbre = grouper(lignes, REGROUPEMENT_TEMPOLIA);
    expect(arbre.map(g => g.libelle)).toEqual(['Présence facturable', 'Présence non facturable', 'Absence']);
    const fact = arbre[0];
    expect(fact.totalHeures).toBe(7.65);
    expect(fact.totalPv).toBe(713);
    expect(fact.enfants.map(g => g.libelle)).toEqual(['TRANSMAS', 'TRANSMASCA']);
    const transmas = fact.enfants[0];
    expect(transmas.enfants).toHaveLength(1);
    expect(transmas.enfants[0].libelle).toBe('C2026-09');
    expect(transmas.enfants[0].totalHeures).toBe(5.15);
    expect(arbre[1].enfants[0].enfants[0].libelle).toBe('Sans affaire');
  });

  it('trie les lignes par collaborateur puis date décroissante', () => {
    const t = trierLignes(lignes.slice(0, 3));
    expect(t.map(l => `${l.collaborateur} ${l.date}`)).toEqual(['AAM 2026-10-16', 'AAM 2026-10-12', 'JULIE 2026-02-17']);
  });

  it('aplatit l’arbre en profondeur et donne des chemins uniques', () => {
    const plat = aplatir(grouper(lignes, REGROUPEMENT_TEMPOLIA));
    expect(new Set(plat.map(g => g.chemin)).size).toBe(plat.length);
    expect(plat[0].niveau).toBe(1);
    expect(plat[1].niveau).toBe(2);
    expect(plat[2].niveau).toBe(3);
  });

  it('calcule totaux et récapitulatif', () => {
    expect(totaux(lignes)).toEqual({ heures: 16.65, pv: 713 });
    const recap = recapitulatif(lignes, 'presence');
    expect(recap[2]).toMatchObject({ libelle: 'Absence', heures: 7 });
    expect(recap.reduce((s, r) => s + r.part, 0)).toBeCloseTo(1);
  });

  it('libelle les mois en français', () => {
    expect(libelleMois('2026-09')).toBe('Septembre 2026');
  });
});

describe('regroupement « Pôle de travail » (cahier v2 #5)', () => {
  const l = (id: number, lieuTravail: any, dureeHeures: number, presence: any = 'FACTURABLE') =>
    ({ id, source: presence === 'ABSENCE' ? 'ABSENCE' : 'SAISIE', date: '2026-09-10', collaborateurId: 1, collaborateur: 'A', presence,
       clientId: 1, client: 'X', clientTnf: 'X', affaire: null, affaireEtat: null, missionCode: null, categorie: null, libelle: null,
       dureeHeures, tauxHoraire: null, tauxFige: false, pv: 0, heureDebut: null, heureFin: null, isLocked: false, lieuTravail } as any);

  it('regroupe Est / Ouest / Hors bureau dans cet ordre, absences et inconnus à part', () => {
    definirLibellesLieu({ EST: 'Pôle EST', OUEST: 'Pôle OUEST' });
    const g = grouper([l(1, 'HORS_BUREAU', 2), l(2, 'EST', 3), l(3, 'OUEST', 1), l(4, null, 1), l(5, null, 7, 'ABSENCE')], ['lieu']);
    expect(g.map(x => [x.libelle, x.totalHeures])).toEqual([['Pôle EST', 3], ['Pôle OUEST', 1], ['Hors bureau', 2], ['Absence', 7], ['Non précisé', 1]]);
    expect(DIMENSIONS.find(d => d.key === 'lieu')?.label).toBe('Pôle de travail');
  });
});
