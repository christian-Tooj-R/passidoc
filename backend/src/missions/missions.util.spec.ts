import {
  CYCLES_MISSIONS, estARelancer, estCycle, statutDepuisType, peutSupprimer, synthese,
  filtrerMissions, finSemaine, finMois, correspondTranche, echeanceANotifier, nomCycle,
} from './missions.util';

const AUJ = '2026-11-18';   // mercredi

describe('missions.util', () => {
  it('10 cycles de révision du CDC, dans l’ordre', () => {
    expect(CYCLES_MISSIONS.map(c => c.code)).toEqual(['IMM', 'CAP', 'EMP', 'FRS', 'CLI', 'SOC', 'FIS', 'TRE', 'STK', 'DIV']);
    expect(estCycle('CLI')).toBe(true);
    expect(estCycle('A')).toBe(false);
    expect(nomCycle(null)).toBe('Hors cycle');
    expect(nomCycle('TRE')).toBe('Trésorerie');
  });

  it("déduit le statut des missions de l'ancien module", () => {
    expect(statutDepuisType('REALISEE')).toBe('ACCEPTEE');
    expect(statutDepuisType('REFUSEE')).toBe('REFUSEE');
    expect(statutDepuisType('DETECTEE')).toBe('PROPOSEE');
    expect(statutDepuisType('IA')).toBe('PROPOSEE');
  });

  it('R7 : suppression seulement si Proposée ou Sans suite', () => {
    expect(peutSupprimer('PROPOSEE')).toBe(true);
    expect(peutSupprimer('SANS_SUITE')).toBe(true);
    expect(peutSupprimer('EN_DISCUSSION')).toBe(false);
    expect(peutSupprimer('ACCEPTEE')).toBe(false);
    expect(peutSupprimer('REFUSEE')).toBe(false);
  });

  it('R3 : à relancer = date dépassée et mission proposée ou en discussion', () => {
    expect(estARelancer({ statut: 'PROPOSEE', dateRelance: '2026-11-17' }, AUJ)).toBe(true);
    expect(estARelancer({ statut: 'EN_DISCUSSION', dateRelance: '2026-11-01' }, AUJ)).toBe(true);
    expect(estARelancer({ statut: 'PROPOSEE', dateRelance: AUJ }, AUJ)).toBe(false);          // le jour même : pas encore dépassée
    expect(estARelancer({ statut: 'ACCEPTEE', dateRelance: '2026-11-01' }, AUJ)).toBe(false);
    expect(estARelancer({ statut: 'SANS_SUITE', dateRelance: '2026-11-01' }, AUJ)).toBe(false);
    expect(estARelancer({ statut: 'PROPOSEE', dateRelance: '2026-11-01', archivee: true }, AUJ)).toBe(false);
    expect(estARelancer({ statut: 'PROPOSEE', dateRelance: null }, AUJ)).toBe(false);
  });

  it('KPI : potentiel, en cours, signées, à relancer, taux de conversion (exemple Société A du CDC)', () => {
    const k = synthese([
      { statut: 'ACCEPTEE', honoraires: 2500 },
      { statut: 'EN_DISCUSSION', honoraires: 2200, dateRelance: '2026-11-15' },
      { statut: 'PROPOSEE', honoraires: 2700, dateRelance: '2026-11-15' },
      { statut: 'PROPOSEE', honoraires: null },                     // R6 : comptée, montant vide
      { statut: 'REFUSEE', honoraires: 4000 },
      { statut: 'SANS_SUITE', honoraires: 900 },
      { statut: 'PROPOSEE', honoraires: 10000, archivee: true },   // archivée : hors KPI
    ], AUJ);
    expect(k.total).toBe(6);
    expect(k.potentiel).toBe(7400);
    expect(k.proposees).toEqual({ nombre: 2, montant: 2700 });
    expect(k.enDiscussion).toEqual({ nombre: 1, montant: 2200 });
    expect(k.acceptees).toEqual({ nombre: 1, montant: 2500 });
    expect(k.refusees).toBe(1);
    expect(k.sansSuite).toBe(1);
    expect(k.aRelancer).toBe(2);
    expect(k.tauxConversion).toBe(25);   // 1 / (2 + 1 + 1)
    expect(synthese([], AUJ).tauxConversion).toBeNull();
  });

  it('fin de semaine (dimanche) et fin de mois', () => {
    expect(finSemaine('2026-11-18')).toBe('2026-11-22');
    expect(finSemaine('2026-11-22')).toBe('2026-11-22');
    expect(finMois('2026-11-18')).toBe('2026-11-30');
    expect(finMois('2028-02-03')).toBe('2028-02-29');
  });

  it('tranches de montant (< 1 000 / 1 000–5 000 / > 5 000)', () => {
    expect(correspondTranche(999, 'MOINS_1000')).toBe(true);
    expect(correspondTranche(1000, 'DE_1000_A_5000')).toBe(true);
    expect(correspondTranche(5000, 'DE_1000_A_5000')).toBe(true);
    expect(correspondTranche(5001, 'PLUS_5000')).toBe(true);
    expect(correspondTranche(null, 'MOINS_1000')).toBe(false);
  });

  describe('filtres de la vue cabinet', () => {
    const missions = [
      { id: 1, statut: 'PROPOSEE', cycle: 'CLI', honoraires: 2500, dateRelance: '2026-11-20', responsableId: 7, secteur: 'TRANSPORT' },
      { id: 2, statut: 'EN_DISCUSSION', cycle: null, honoraires: null, dateRelance: '2026-11-10', responsableId: 8, secteur: 'BTP' },
      { id: 3, statut: 'ACCEPTEE', cycle: 'TRE', honoraires: 6000, dateRelance: '2026-11-25', responsableId: 7, secteur: 'TRANSPORT' },
      { id: 4, statut: 'PROPOSEE', cycle: 'SOC', honoraires: 800, dateRelance: '2026-11-28', responsableId: 7, secteur: 'BTP', archivee: true },
    ];
    const ids = (f: any) => filtrerMissions(missions, f, AUJ).map(m => m.id);

    it('archivées masquées par défaut', () => {
      expect(ids({})).toEqual([1, 2, 3]);
      expect(ids({ inclureArchivees: true })).toEqual([1, 2, 3, 4]);
    });
    it('statut (multi), responsable, cycle, hors cycle, secteur, montant renseigné', () => {
      expect(ids({ statuts: ['PROPOSEE', 'ACCEPTEE'] })).toEqual([1, 3]);
      expect(ids({ responsableId: 7 })).toEqual([1, 3]);
      expect(ids({ cycle: 'TRE' })).toEqual([3]);
      expect(ids({ cycle: 'HORS_CYCLE' })).toEqual([2]);
      expect(ids({ secteur: 'BTP' })).toEqual([2]);
      expect(ids({ avecMontant: true })).toEqual([1, 3]);
      expect(ids({ tranche: 'PLUS_5000' })).toEqual([3]);
    });
    it('relance : cette semaine, ce mois, en retard (missions ouvertes seulement)', () => {
      expect(ids({ relance: 'SEMAINE' })).toEqual([1]);
      expect(ids({ relance: 'MOIS' })).toEqual([1]);          // 3 est acceptée
      expect(ids({ relance: 'RETARD' })).toEqual([2]);
    });
  });

  describe('R8 : échéance de notification', () => {
    const m = (o: any) => ({ statut: 'PROPOSEE', dateRelance: '2026-11-21', notifJ3Pour: null, notifJ0Pour: null, ...o });
    it('J-3 dans les 3 jours qui précèdent, une seule fois par date', () => {
      expect(echeanceANotifier(m({}), '2026-11-17')).toBeNull();
      expect(echeanceANotifier(m({}), '2026-11-18')).toBe('J3');
      expect(echeanceANotifier(m({ notifJ3Pour: '2026-11-21' }), '2026-11-19')).toBeNull();
      // Nouvelle date de relance : nouveau rappel.
      expect(echeanceANotifier(m({ dateRelance: '2026-11-20', notifJ3Pour: '2026-11-21' }), '2026-11-19')).toBe('J3');
    });
    it('J0 le jour même (ou en rattrapage), une seule fois', () => {
      expect(echeanceANotifier(m({ notifJ3Pour: '2026-11-21' }), '2026-11-21')).toBe('J0');
      expect(echeanceANotifier(m({}), '2026-11-23')).toBe('J0');
      expect(echeanceANotifier(m({ notifJ0Pour: '2026-11-21' }), '2026-11-23')).toBeNull();
    });
    it('rien pour une mission acceptée, refusée, sans suite ou archivée', () => {
      for (const statut of ['ACCEPTEE', 'REFUSEE', 'SANS_SUITE']) expect(echeanceANotifier(m({ statut }), '2026-11-21')).toBeNull();
      expect(echeanceANotifier(m({ archivee: true }), '2026-11-21')).toBeNull();
    });
  });
});
