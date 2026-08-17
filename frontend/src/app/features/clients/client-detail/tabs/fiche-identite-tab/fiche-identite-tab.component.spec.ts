import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { FicheIdentiteTabComponent } from './fiche-identite-tab.component';
import { ClientsService } from '../../../../../core/services/clients.service';
import { FicheIdentiteService } from '../../../../../core/services/fiche-identite.service';
import { FiscalReferenceService } from '../../../../../core/services/fiscal-reference.service';
import { TenantService } from '../../../../../core/services/tenant.service';
import { ToastService } from '../../../../../core/services/toast.service';

// ── Stubs services ─────────────────────────────────────────────────
const mockClientsService = {
  update: vi.fn().mockReturnValue(of({ id: 1 })),
};
const mockFicheService = {
  get:    vi.fn().mockReturnValue(of(null)),
  update: vi.fn().mockReturnValue(of({})),
};
const mockFiscalService = { get: vi.fn().mockResolvedValue({}) };
const mockTenantService = {
  poleFlag1:  vi.fn().mockReturnValue('🇷🇪'),
  poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2:  vi.fn().mockReturnValue('🇲🇬'),
  poleLabel2: vi.fn().mockReturnValue('Madagascar'),
};
const mockToastService = { success: vi.fn(), error: vi.fn() };

// ── Helper : créer le composant ─────────────────────────────────────
async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [FicheIdentiteTabComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      { provide: ClientsService,         useValue: mockClientsService },
      { provide: FicheIdentiteService,   useValue: mockFicheService },
      { provide: FiscalReferenceService, useValue: mockFiscalService },
      { provide: TenantService,          useValue: mockTenantService },
      { provide: ToastService,           useValue: mockToastService },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(FicheIdentiteTabComponent);
  const comp    = fixture.componentInstance;
  comp.clientId = 42;
  comp.site     = 'REUNION';
  fixture.detectChanges();
  return { fixture, comp };
}

describe('FicheIdentiteTabComponent — types flux personnalisés', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientsService.update.mockReturnValue(of({ id: 1 }));
  });

  // ── @Input() customFluxTypes ────────────────────────────────────

  describe('@Input() customFluxTypes', () => {
    it('charge les types custom depuis le @Input', async () => {
      const { comp } = await createComponent();
      comp.customFluxTypes = [{ key: 'CUSTOM_TEST_123', label: 'Mon document' }];
      expect(comp.customFluxTypesArray).toHaveLength(1);
      expect(comp.customFluxTypesArray[0].label).toBe('Mon document');
    });

    it('initialise à un tableau vide si le @Input est null', async () => {
      const { comp } = await createComponent();
      comp.customFluxTypes = null;
      expect(comp.customFluxTypesArray).toEqual([]);
    });
  });

  // ── startAddingCustomFlux ───────────────────────────────────────

  describe('startAddingCustomFlux', () => {
    it('passe addingCustomFlux à true', async () => {
      const { comp } = await createComponent();
      expect(comp.addingCustomFlux()).toBe(false);
      comp.startAddingCustomFlux();
      expect(comp.addingCustomFlux()).toBe(true);
    });
  });

  // ── cancelAddCustomFlux ─────────────────────────────────────────

  describe('cancelAddCustomFlux', () => {
    it('repasse addingCustomFlux à false et vide le nom', async () => {
      const { comp } = await createComponent();
      comp.startAddingCustomFlux();
      comp.newFluxName.set('test en cours');
      comp.cancelAddCustomFlux();
      expect(comp.addingCustomFlux()).toBe(false);
      expect(comp.newFluxName()).toBe('');
    });
  });

  // ── confirmAddCustomFlux ────────────────────────────────────────

  describe('confirmAddCustomFlux', () => {
    it('ne fait rien si le nom est vide', async () => {
      const { comp } = await createComponent();
      comp.newFluxName.set('  ');
      comp.confirmAddCustomFlux();
      expect(mockClientsService.update).not.toHaveBeenCalled();
    });

    it('génère une clé préfixée CUSTOM_ depuis le label', async () => {
      const { comp } = await createComponent();
      comp.newFluxName.set('Relevé de charges');
      comp.confirmAddCustomFlux();

      const payload = mockClientsService.update.mock.calls[0][1];
      const added = payload.customFluxTypes[0];
      expect(added.key).toMatch(/^CUSTOM_/);
      expect(added.label).toBe('Relevé de charges');
    });

    it('ajoute le nouveau type à la liste existante', async () => {
      const { comp } = await createComponent();
      comp.customFluxTypes = [{ key: 'CUSTOM_EXISTANT_1', label: 'Existant' }];
      comp.newFluxName.set('Nouveau doc');
      comp.confirmAddCustomFlux();

      const payload = mockClientsService.update.mock.calls[0][1];
      expect(payload.customFluxTypes).toHaveLength(2);
    });

    it('appelle ClientsService.update avec le bon clientId', async () => {
      const { comp } = await createComponent();
      comp.newFluxName.set('Doc test');
      comp.confirmAddCustomFlux();
      expect(mockClientsService.update).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ customFluxTypes: expect.any(Array) }),
      );
    });

    it('émet customFluxTypesChanged après la sauvegarde', async () => {
      const { comp } = await createComponent();
      const emitted: any[] = [];
      comp.customFluxTypesChanged.subscribe((v: any) => emitted.push(v));

      comp.newFluxName.set('Doc émission');
      comp.confirmAddCustomFlux();

      expect(emitted).toHaveLength(1);
      expect(emitted[0][0].label).toBe('Doc émission');
    });

    it('ferme le formulaire après confirmation', async () => {
      const { comp } = await createComponent();
      comp.startAddingCustomFlux();
      comp.newFluxName.set('Fermeture');
      comp.confirmAddCustomFlux();
      expect(comp.addingCustomFlux()).toBe(false);
      expect(comp.newFluxName()).toBe('');
    });
  });

  // ── removeCustomFluxType ────────────────────────────────────────

  describe('removeCustomFluxType', () => {
    it('retire le type ciblé du tableau', async () => {
      const { comp } = await createComponent();
      comp.customFluxTypes = [
        { key: 'CUSTOM_A_1', label: 'A' },
        { key: 'CUSTOM_B_2', label: 'B' },
      ];
      comp.removeCustomFluxType('CUSTOM_A_1');

      const payload = mockClientsService.update.mock.calls[0][1];
      expect(payload.customFluxTypes).toHaveLength(1);
      expect(payload.customFluxTypes[0].key).toBe('CUSTOM_B_2');
    });

    it('émet customFluxTypesChanged après suppression', async () => {
      const { comp } = await createComponent();
      comp.customFluxTypes = [{ key: 'CUSTOM_X_1', label: 'X' }];
      const emitted: any[] = [];
      comp.customFluxTypesChanged.subscribe((v: any) => emitted.push(v));

      comp.removeCustomFluxType('CUSTOM_X_1');

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual([]);
    });

    it('conserve les autres types si la clé est inconnue', async () => {
      const { comp } = await createComponent();
      comp.customFluxTypes = [{ key: 'CUSTOM_Z_1', label: 'Z' }];
      comp.removeCustomFluxType('CUSTOM_INCONNU_9');

      const payload = mockClientsService.update.mock.calls[0][1];
      expect(payload.customFluxTypes).toHaveLength(1);
    });
  });
});
