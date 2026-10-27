import { calculerIndicateurs, estTempsCompta, statutBudget } from './rentabilite.util';

describe('rentabilite.util', () => {
  it('calcule le prix de vente horaire, le montant réalisé et le boni (cahier v2 #6)', () => {
    const i = calculerIndicateurs({ heuresBudget: 100, honorairesFiche: 3000, heuresConsommees: 80, valorisation: 1500 });
    expect(i.prixVenteHoraire).toBe(30);
    expect(i.prixVenteCalcule).toBe(true);
    expect(i.montantRealise).toBe(2400);
    expect(i.boniMali).toBe(600);
    expect(i.boniMaliPct).toBeCloseTo(0.2);
    expect(i.tauxConsommation).toBeCloseTo(0.8);
    expect(i.statut).toBe('ATTENTION');
    expect(i.heuresRestantes).toBe(20);
    expect(i.margeValorisation).toBe(1500);
    expect(i.honorairesSource).toBe('FICHE');
  });

  it('donne un mali en cas de dépassement', () => {
    const i = calculerIndicateurs({ heuresBudget: 100, honorairesBudget: 3000, honorairesFiche: 9999, heuresConsommees: 107.7, valorisation: 2521 });
    expect(i.honoraires).toBe(3000);
    expect(i.honorairesSource).toBe('BUDGET');
    expect(i.boniMali).toBe(-231);
    expect(i.statut).toBe('DEPASSE');
    expect(i.heuresRestantes).toBe(-7.7);
  });

  it('privilégie le prix de vente horaire saisi manuellement', () => {
    const i = calculerIndicateurs({ heuresBudget: 100, honorairesFiche: 3000, prixVenteHoraireManuel: 40, heuresConsommees: 50, valorisation: 0 });
    expect(i.prixVenteHoraire).toBe(40);
    expect(i.prixVenteCalcule).toBe(false);
    expect(i.montantRealise).toBe(2000);
    expect(i.boniMali).toBe(1000);
  });

  it("reste exploitable sans budget ni honoraires", () => {
    const i = calculerIndicateurs({ heuresConsommees: 12, valorisation: 240 });
    expect(i.statut).toBe('NON_BUDGETE');
    expect(i.tauxConsommation).toBeNull();
    expect(i.prixVenteHoraire).toBeNull();
    expect(i.boniMali).toBeNull();
    expect(i.margeValorisation).toBeNull();
    expect(i.valorisation).toBe(240);
  });

  it('classe les seuils 80 % / 100 %', () => {
    expect(statutBudget(0.79)).toBe('OK');
    expect(statutBudget(0.8)).toBe('ATTENTION');
    expect(statutBudget(1)).toBe('DEPASSE');
  });

  it('exclut du budget compta le temps non facturable et les missions facturées à part', () => {
    expect(estTempsCompta('FACTURABLE', null)).toBe(true);
    expect(estTempsCompta('FACTURABLE', 'REV')).toBe(true);
    expect(estTempsCompta('FACTURABLE', 'SOC')).toBe(false);
    expect(estTempsCompta('NON_FACTURABLE', 'TCO')).toBe(false);
  });
});
