import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { TravailRentabiliteComponent } from './travail-rentabilite.component';
import { SaisieTempsService, IndicateursRentabilite } from '../../../../core/services/saisie-temps.service';
import { UsersService } from '../../../../core/services/users.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';

const l = (p: Partial<IndicateursRentabilite>): IndicateursRentabilite => ({
  clientId: 1, client: 'A', site: 'EST', intervenants: { directeur: null, responsable: 'Julie R', collaborateurOuest: null },
  affaire: 'C2026-09', etat: 'O', dateOuverture: '2025-10-01', dateCloture: '2026-09-30', budgetId: 1,
  honoraires: 3000, honorairesSource: 'FICHE', heuresBudget: 100, prixVenteHoraire: 30, prixVenteCalcule: true,
  heuresConsommees: 50, heuresRestantes: 50, tauxConsommation: 0.5, statut: 'OK', montantRealise: 1500,
  boniMali: 1500, boniMaliPct: 0.5, valorisation: 1000, margeValorisation: 2000, ...p,
});

const tableau = (voirValorisation: boolean) => ({
  annee: 2026, voirValorisation,
  lignes: [
    l({ clientId: 1, client: 'Bravo' }),
    l({ clientId: 2, client: 'Alpha', statut: 'DEPASSE', tauxConsommation: 1.2, boniMali: -600, boniMaliPct: -0.2, honoraires: 5000 }),
    l({ clientId: 3, client: 'Charlie', statut: 'ATTENTION', tauxConsommation: 0.85, boniMali: 450, honoraires: 1000 }),
    l({ clientId: 4, client: 'Delta', statut: 'NON_BUDGETE', heuresBudget: null, tauxConsommation: null, boniMali: null, boniMaliPct: null, heuresConsommees: 0, honoraires: null }),
  ],
  totaux: { honoraires: 9000, heuresBudget: 300, heuresConsommees: 255, montantRealise: 7650, boniMali: 1350, valorisation: voirValorisation ? 3000 : null, margeValorisation: voirValorisation ? 6000 : null, dossiersDepasses: 1, dossiersAttention: 1 },
});

let estAdmin = true;
const mockSvc = { getRentabilite: vi.fn(() => of(tableau(estAdmin))) };
const mockUsers = { getAll: vi.fn(() => of([])) };
const mockAuth = { isAdmin: vi.fn(() => estAdmin) };

async function create() {
  await TestBed.configureTestingModule({
    imports: [TravailRentabiliteComponent],
    providers: [
      provideRouter([]), provideAnimations(),
      { provide: SaisieTempsService, useValue: mockSvc },
      { provide: UsersService, useValue: mockUsers },
      { provide: AuthService, useValue: mockAuth },
      { provide: TenantService, useValue: { nomSociete: () => 'AFYM' } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TravailRentabiliteComponent);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('TravailRentabiliteComponent', () => {
  beforeEach(() => { vi.clearAllMocks(); estAdmin = true; });

  it("charge l'année en cours et masque par défaut les dossiers sans temps ni budget", async () => {
    const { comp } = await create();
    expect(mockSvc.getRentabilite).toHaveBeenCalledWith({ annee: new Date().getFullYear(), collaborateurId: undefined });
    expect(comp.lignesVue().map(x => x.client)).not.toContain('Delta');
    comp.masquerVides = false;
    expect(comp.lignesVue().map(x => x.client)).toContain('Delta');
  });

  it("trie les pires boni/mali d'abord par défaut, puis selon le choix", async () => {
    const { comp } = await create();
    expect(comp.lignesVue().map(x => x.client)).toEqual(['Alpha', 'Charlie', 'Bravo']);
    comp.tri = 'conso';
    expect(comp.lignesVue().map(x => x.client)).toEqual(['Alpha', 'Charlie', 'Bravo']);
    comp.tri = 'honoraires';
    expect(comp.lignesVue().map(x => x.client)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    comp.tri = 'nom';
    expect(comp.lignesVue().map(x => x.client)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('filtre par statut et par nom, avec les compteurs', async () => {
    const { comp } = await create();
    expect(comp.compte('DEPASSE')).toBe(1);
    comp.statut = 'ATTENTION';
    expect(comp.lignesVue().map(x => x.client)).toEqual(['Charlie']);
    comp.statut = null;
    comp.recherche = 'bra';
    expect(comp.lignesVue().map(x => x.client)).toEqual(['Bravo']);
  });

  it("change d'année et filtre par intervenant (ADMIN)", async () => {
    const { comp } = await create();
    comp.annee = 2025;
    comp.collaborateurId = 7;
    comp.load();
    expect(mockSvc.getRentabilite).toHaveBeenLastCalledWith({ annee: 2025, collaborateurId: 7 });
    expect(mockUsers.getAll).toHaveBeenCalled();
  });

  it("affiche valorisation et marge réelle à l'ADMIN uniquement", async () => {
    const admin = await create();
    expect(admin.el.textContent).toContain('Valo. PV Col');
    expect(admin.el.textContent).toContain('Marge réelle');
    TestBed.resetTestingModule();
    estAdmin = false;
    const collab = await create();
    expect(collab.el.textContent).not.toContain('Valo. PV Col');
    expect(collab.el.textContent).not.toContain('Intervenant');
    expect(mockUsers.getAll).toHaveBeenCalledTimes(1); // seulement pour l'ADMIN du premier rendu
  });

  it('met en évidence les dépassements et lie chaque dossier à son onglet Rentabilité', async () => {
    const { el } = await create();
    expect(el.querySelectorAll('tr.data-row--over').length).toBe(1);
    const lien = el.querySelector('a.lnk') as HTMLAnchorElement;
    expect(lien.getAttribute('href')).toBe('/clients/2?tab=rentabilite');
  });
});
