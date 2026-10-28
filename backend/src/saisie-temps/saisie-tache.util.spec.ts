import {
  missionDeTache, minutesRestantes, heuresDeMinutes, horodatageLocal, heureDebutAvant, champsSaisieTache,
} from './saisie-tache.util';
import { TypeTemps, CategorieNonFacturable } from '../entities/saisie-temps.entity';

describe('saisie-tache.util', () => {
  it('associe le type de tâche au code mission de la saisie des temps', () => {
    expect(missionDeTache('TVA')).toBe('FISC');
    expect(missionDeTache('PAIE')).toBe('SOC');
    expect(missionDeTache('RB')).toBe('TCO');
    expect(missionDeTache('DR')).toBe('REV');
    expect(missionDeTache('AUTRE')).toBeNull();
    expect(missionDeTache(null)).toBeNull();
  });

  it('déduit le temps déjà saisi pour la tâche, à la minute près', () => {
    expect(minutesRestantes(5400, 0)).toBe(90);
    expect(minutesRestantes(5400, 1)).toBe(30);
    expect(minutesRestantes(5400, 1.5)).toBe(0);
    expect(minutesRestantes(3600, 2)).toBe(0);    // jamais négatif
    expect(minutesRestantes(29, 0)).toBe(0);      // moins de 30 s : rien à saisir
    expect(minutesRestantes(0, 0)).toBe(0);
  });

  it('arrondit la durée au centième d’heure', () => {
    expect(heuresDeMinutes(90)).toBe(1.5);
    expect(heuresDeMinutes(20)).toBe(0.33);
    expect(heuresDeMinutes(1)).toBe(0.02);
  });

  it('date et heure dans le fuseau du collaborateur', () => {
    const instant = new Date('2026-10-27T21:30:00Z');
    expect(horodatageLocal(instant, 'Indian/Reunion')).toEqual({ date: '2026-10-28', heure: '01:30' });
    expect(horodatageLocal(instant, 'Indian/Antananarivo')).toEqual({ date: '2026-10-28', heure: '00:30' });
    expect(horodatageLocal(instant, 'UTC')).toEqual({ date: '2026-10-27', heure: '21:30' });
    // Fuseau inconnu : heure du serveur, sans planter.
    expect(horodatageLocal(instant, 'Pas/UnFuseau').date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("calcule l'heure de début si la plage tient dans la journée", () => {
    expect(heureDebutAvant('15:10', 90)).toBe('13:40');
    expect(heureDebutAvant('00:30', 90)).toBeNull();
  });

  it('saisie facturable sur le dossier de la tâche, avec sa référence en commentaire', () => {
    expect(champsSaisieTache({ id: 1, taskId: 'T-2026-012', titre: 'TVA septembre', type: 'TVA', clientId: 4, estFacturable: true }))
      .toEqual({ type: TypeTemps.FACTURABLE, missionCode: 'FISC', clientId: 4, commentaire: 'TVA septembre (tâche T-2026-012)' });
  });

  it('non facturable si la tâche ne l’est pas ou n’a pas de dossier', () => {
    expect(champsSaisieTache({ id: 1, titre: 'Point interne', type: 'AUTRE', clientId: 4, estFacturable: false }))
      .toEqual({ type: TypeTemps.NON_FACTURABLE, categorie: CategorieNonFacturable.AUTRE, clientId: 4, commentaire: 'Point interne' });
    expect(champsSaisieTache({ id: 1, titre: 'Veille', clientId: null, estFacturable: true }).type).toBe(TypeTemps.NON_FACTURABLE);
  });
});
