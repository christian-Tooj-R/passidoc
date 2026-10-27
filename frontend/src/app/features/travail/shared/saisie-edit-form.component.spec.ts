import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { SimpleChange } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { SaisieEditFormComponent, SaisieEditSeed, SaisieEditResult } from './saisie-edit-form.component';
import { SaisieTempsService } from '../../../core/services/saisie-temps.service';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';

const affairesParClient: Record<number, any[]> = {
  3: [{ code: 'C2027-09', etat: 'O' }, { code: 'C2026-09', etat: 'O' }, { code: 'C2025-09', etat: 'C' }],
  4: [{ code: 'C2026-12', etat: 'O' }],
};
const mockSvc = { getAffaires: vi.fn((id: number) => of(affairesParClient[id] ?? [])) };
const clients = [{ id: 3, nom: 'TRANSMAS' }, { id: 4, nom: 'TRANSMASCA' }] as any[];

async function create(seed: SaisieEditSeed | null) {
  await TestBed.configureTestingModule({
    imports: [SaisieEditFormComponent],
    providers: [provideAnimations(), { provide: SaisieTempsService, useValue: mockSvc }],
  }).compileComponents();
  const fixture = TestBed.createComponent(SaisieEditFormComponent);
  const comp = fixture.componentInstance;
  comp.clients = clients;
  comp.seed = seed;
  comp.ngOnChanges({ seed: new SimpleChange(null, seed, true), clients: new SimpleChange(null, clients, true) });
  fixture.detectChanges();
  const emis: SaisieEditResult[] = [];
  comp.save.subscribe(r => emis.push(r));
  return { fixture, comp, emis };
}

const seedAvecAffaire: SaisieEditSeed = {
  date: '2026-10-16', clientId: 3, missionCode: 'REV', dureeHeures: 2.5, type: 'FACTURABLE', affaire: 'C2026-09',
};

describe('SaisieEditFormComponent — affaire', () => {
  beforeEach(() => vi.clearAllMocks());

  it("charge les affaires du client et présélectionne celle de la saisie", async () => {
    const { comp, fixture } = await create(seedAvecAffaire);
    expect(mockSvc.getAffaires).toHaveBeenCalledWith(3);
    expect(comp.affairesOptions.map(a => a.code)).toEqual(['C2027-09', 'C2026-09', 'C2025-09']);
    expect(comp.affaire).toBe('C2026-09');
    const options = [...fixture.nativeElement.querySelectorAll('select[name="sefAffaire"] option')].map((o: any) => o.textContent.trim());
    expect(options[0]).toBe('Automatique (selon la date)');
    expect(options).toContain('C2025-09 — clôturée');
  });

  it("renvoie l'affaire inchangée si l'utilisateur ne touche qu'au commentaire", async () => {
    const { comp, emis } = await create(seedAvecAffaire);
    comp.commentaire = 'précision';
    comp.submit();
    expect(emis[0]).toMatchObject({ affaire: 'C2026-09', dureeHeures: 2.5, clientId: 3 });
  });

  it('repasse en automatique quand la date change sans choix explicite', async () => {
    const { comp, emis } = await create(seedAvecAffaire);
    comp.date = '2026-11-02';
    comp.onContexteChange();
    comp.submit();
    expect(emis[0].affaire).toBeNull();
  });

  it("garde un choix explicite même si la date change ensuite", async () => {
    const { comp, emis } = await create(seedAvecAffaire);
    comp.onAffaireChange('C2025-09');
    comp.date = '2026-11-02';
    comp.onContexteChange();
    comp.submit();
    expect(emis[0].affaire).toBe('C2025-09');
  });

  it("recharge les affaires et repart en automatique quand le client change", async () => {
    const { comp, emis } = await create(seedAvecAffaire);
    comp.onAffaireChange('C2025-09');
    comp.onClientSelected({ option: { value: 4 } } as any);
    expect(mockSvc.getAffaires).toHaveBeenLastCalledWith(4);
    expect(comp.affairesOptions.map(a => a.code)).toEqual(['C2026-12']);
    comp.submit();
    expect(emis[0]).toMatchObject({ clientId: 4, affaire: null });
  });

  it("n'envoie pas d'affaire quand le formulaire ne la gère pas (page Par jour)", async () => {
    const { comp, emis } = await create({ date: '2026-10-16', clientId: 3, dureeHeures: 1, type: 'FACTURABLE' });
    comp.date = '2026-11-02';
    comp.onContexteChange();
    comp.submit();
    expect('affaire' in emis[0]).toBe(false);
  });

  it("n'affiche pas le sélecteur d'affaire sans client", async () => {
    const { fixture } = await create({ date: '2026-10-16', clientId: null, dureeHeures: 1, type: 'NON_FACTURABLE', affaire: null });
    expect(fixture.nativeElement.querySelector('select[name="sefAffaire"]')).toBeNull();
    expect(mockSvc.getAffaires).not.toHaveBeenCalled();
  });

  it('refuse une durée vide', async () => {
    const { comp, emis } = await create(seedAvecAffaire);
    comp.dureeInput = '';
    comp.submit();
    expect(emis).toHaveLength(0);
    expect(comp.localError).toContain('Durée invalide');
  });
});

describe('SaisieEditFormComponent — pôle de travail (cahier v2 #5)', () => {
  const auth = { currentUser: vi.fn(() => ({ id: 7, site: 'OUEST' })) };
  const tenant = { poleLabel: vi.fn((s: string) => (s === 'EST' ? 'Pôle EST' : 'Pôle OUEST')) };

  async function creer(seed: SaisieEditSeed | null, mode: 'edit' | 'duplicate' | 'create') {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SaisieEditFormComponent],
      providers: [
        provideAnimations(),
        { provide: SaisieTempsService, useValue: mockSvc },
        { provide: AuthService, useValue: auth },
        { provide: TenantService, useValue: tenant },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SaisieEditFormComponent);
    const comp = fixture.componentInstance;
    comp.mode = mode;
    comp.seed = seed;
    if (seed) comp.ngOnChanges({ seed: new SimpleChange(null, seed, true) });
    fixture.detectChanges();
    const emis: SaisieEditResult[] = [];
    comp.save.subscribe(r => emis.push(r));
    return { fixture, comp, emis };
  }
  const seed: SaisieEditSeed = { date: '2026-10-16', dureeHeures: 1, type: 'FACTURABLE' };

  it('nouvelle saisie : pôle du collaborateur connecté présélectionné et envoyé, avec les libellés du cabinet', async () => {
    const { comp, emis, fixture } = await creer(seed, 'create');
    const boutons = [...fixture.nativeElement.querySelectorAll('.lf-lieu__btn')] as HTMLButtonElement[];
    expect(boutons.map(b => b.textContent!.trim())).toEqual(['Pôle EST', 'Pôle OUEST', 'Hors bureau']);
    expect(boutons[1].getAttribute('aria-checked')).toBe('true');
    comp.submit();
    expect(emis[0].lieuTravail).toBe('OUEST');
  });

  it('choix « Hors bureau » envoyé', async () => {
    const { comp, emis, fixture } = await creer(seed, 'create');
    (fixture.nativeElement.querySelector('.lf-lieu__btn--HORS_BUREAU') as HTMLButtonElement).click();
    comp.submit();
    expect(emis[0].lieuTravail).toBe('HORS_BUREAU');
  });

  it('modification : pôle connu conservé ; inconnu non envoyé (le serveur le garde) tant qu’on n’y touche pas', async () => {
    const connu = await creer({ ...seed, lieuTravail: 'HORS_BUREAU' }, 'edit');
    connu.comp.submit();
    expect(connu.emis[0].lieuTravail).toBe('HORS_BUREAU');
    const inconnu = await creer(seed, 'edit');
    inconnu.comp.submit();
    expect('lieuTravail' in inconnu.emis[0]).toBe(false);
    inconnu.comp.choisirLieu('EST');
    inconnu.comp.submit();
    expect(inconnu.emis[1].lieuTravail).toBe('EST');
  });
});
