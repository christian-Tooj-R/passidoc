import {
  ajouterMois, ajouterJours, codeAffaire, clotureSuivante, resoudreAffaire,
  etatAffaire, periodeAffaire, listerAffaires, estCodeAffaire,
} from './affaire.util';

describe('affaire.util', () => {
  describe('calculs de dates', () => {
    it('ajoute des mois en bornant au dernier jour du mois', () => {
      expect(ajouterMois('2026-08-31', 6)).toBe('2027-02-28');
      expect(ajouterMois('2026-09-30', 6)).toBe('2027-03-30');
      expect(ajouterMois('2026-12-31', 1)).toBe('2027-01-31');
    });

    it('ajoute des jours en franchissant mois et années', () => {
      expect(ajouterJours('2025-12-31', 1)).toBe('2026-01-01');
      expect(ajouterJours('2024-02-28', 1)).toBe('2024-02-29');
    });

    it('trouve la prochaine clôture annuelle', () => {
      expect(clotureSuivante('2026-09-30', '09-30')).toBe('2026-09-30');
      expect(clotureSuivante('2026-10-01', '09-30')).toBe('2027-09-30');
      expect(clotureSuivante('2028-02-15', '02-29')).toBe('2028-02-29');
      expect(clotureSuivante('2027-02-15', '02-29')).toBe('2027-02-28');
    });

    it('code une affaire comme Tempolia', () => {
      expect(codeAffaire('2026-09-30')).toBe('C2026-09');
      expect(estCodeAffaire('C2026-09')).toBe(true);
      expect(estCodeAffaire('C2026-13')).toBe(false);
      expect(estCodeAffaire('2026-09')).toBe(false);
    });
  });

  describe('resoudreAffaire — sans exercice dans PASSIDOC', () => {
    const ctx = { dateClotureExercice: '09-30' };

    it("rattache une saisie à l'exercice qui contient sa date", () => {
      expect(resoudreAffaire('2026-02-17', ctx)).toBe('C2026-09');
      expect(resoudreAffaire('2025-10-27', ctx)).toBe('C2026-09');
      expect(resoudreAffaire('2026-10-07', ctx, 'TCO')).toBe('C2027-09');
    });

    it("garde la révision post-clôture sur l'exercice qui vient de se clore", () => {
      expect(resoudreAffaire('2026-10-16', ctx, 'REV')).toBe('C2026-09');
      expect(resoudreAffaire('2027-03-30', ctx, 'REV')).toBe('C2026-09');
      expect(resoudreAffaire('2027-04-01', ctx, 'REV')).toBe('C2027-09');
    });

    it('prend le 31/12 par défaut ou si la date de clôture est invalide', () => {
      expect(resoudreAffaire('2026-05-10', {})).toBe('C2026-12');
      expect(resoudreAffaire('2026-05-10', { dateClotureExercice: 'n/a' })).toBe('C2026-12');
    });
  });

  describe('resoudreAffaire — avec exercices PASSIDOC', () => {
    const e2026 = { dateOuverture: '2025-10-01', dateCloture: '2026-09-30', statut: 'OUVERT' };

    it("reste sur l'exercice ouvert après sa date de clôture (révision en cours)", () => {
      const ctx = { dateClotureExercice: '09-30', exercices: [e2026] };
      expect(resoudreAffaire('2026-10-16', ctx, 'TCO')).toBe('C2026-09');
    });

    it("bascule sur l'exercice suivant une fois le précédent clôturé", () => {
      const ctx = {
        dateClotureExercice: '09-30',
        exercices: [
          { ...e2026, statut: 'CLOTURE' },
          { dateOuverture: '2026-10-01', dateCloture: '2027-09-30', statut: 'OUVERT' },
        ],
      };
      expect(resoudreAffaire('2026-10-16', ctx)).toBe('C2027-09');
      // une saisie tardive datée dans l'exercice clôturé y reste
      expect(resoudreAffaire('2026-03-01', ctx)).toBe('C2026-09');
    });

    it("ignore un exercice resté ouvert au-delà du délai de révision", () => {
      const ctx = { dateClotureExercice: '09-30', exercices: [e2026] };
      expect(resoudreAffaire('2027-05-02', ctx)).toBe('C2027-09');
    });
  });

  describe('période et état', () => {
    it("reprend la période de l'exercice PASSIDOC, sinon la reconstitue", () => {
      const ctx = { dateClotureExercice: '09-30', exercices: [{ dateOuverture: '2025-10-01', dateCloture: '2026-09-30', statut: 'CLOTURE' }] };
      expect(periodeAffaire('C2026-09', ctx)).toEqual({ dateOuverture: '2025-10-01', dateCloture: '2026-09-30', source: 'EXERCICE' });
      expect(periodeAffaire('C2027-09', ctx)).toEqual({ dateOuverture: '2026-10-01', dateCloture: '2027-09-30', source: 'CALCUL' });
      expect(etatAffaire('C2026-09', ctx, '2026-10-19')).toBe('C');
    });

    it("répute ouverte une affaire calculée jusqu'à la fin du délai de révision", () => {
      const ctx = { dateClotureExercice: '09-30' };
      expect(etatAffaire('C2026-09', ctx, '2027-03-30')).toBe('O');
      expect(etatAffaire('C2026-09', ctx, '2027-04-01')).toBe('C');
    });

    it('liste les affaires proposées, de la plus récente à la plus ancienne', () => {
      const liste = listerAffaires({ dateClotureExercice: '09-30' }, '2026-10-19', ['C2024-09', 'nimporte']);
      expect(liste.map(a => a.code)).toEqual(['C2028-09', 'C2027-09', 'C2026-09', 'C2024-09']);
    });
  });
});
