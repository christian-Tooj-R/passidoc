import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { DocumentsComponent } from './documents.component';
import { EspacesService } from '../../core/services/espaces.service';

const mockEspaces = {
  getMesEspaces: vi.fn().mockReturnValue(of([])),
  creer:         vi.fn().mockReturnValue(of({ id: 1, nom: 'Test', couleur: null, documents: [] })),
  supprimer:     vi.fn().mockReturnValue(of({})),
};
const mockSnack  = { open: vi.fn() };
const mockDialog = { open: vi.fn().mockReturnValue({ afterClosed: () => of({ nom: 'Nouvel espace' }) }) };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [DocumentsComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      { provide: EspacesService, useValue: mockEspaces },
      { provide: MatSnackBar,    useValue: mockSnack },
      { provide: MatDialog,      useValue: mockDialog },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(DocumentsComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('DocumentsComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEspaces.getMesEspaces.mockReturnValue(of([]));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge les espaces au init via getMesEspaces', async () => {
    await createComponent();
    expect(mockEspaces.getMesEspaces).toHaveBeenCalled();
  });

  it('espaces est vide par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.espaces()).toHaveLength(0);
  });

  it('loading passe à false après chargement', async () => {
    const { comp } = await createComponent();
    expect(comp.loading()).toBe(false);
  });

  it('espaceOuvert est null par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.espaceOuvert()).toBeNull();
  });

  describe('totalDocs', () => {
    it('compte le total de documents sur tous les espaces', async () => {
      mockEspaces.getMesEspaces.mockReturnValue(of([
        { id: 1, nom: 'A', couleur: null, documents: [{ id: 1 }, { id: 2 }] },
        { id: 2, nom: 'B', couleur: null, documents: [{ id: 3 }] },
      ]));
      const { comp } = await createComponent();
      expect(comp.totalDocs()).toBe(3);
    });
  });

  describe('fmtSize', () => {
    it('affiche en Ko pour des octets >= 1024', async () => {
      const { comp } = await createComponent();
      expect(comp.fmtSize(2048)).toContain('Ko');
    });

    it('affiche en Mo pour des octets >= 1 Mo', async () => {
      const { comp } = await createComponent();
      expect(comp.fmtSize(2 * 1024 * 1024)).toContain('Mo');
    });
  });

  describe('initiales', () => {
    it('extrait les premières lettres de chaque mot', async () => {
      const { comp } = await createComponent();
      expect(comp.initiales('Espace Test')).toBe('ET');
    });

    it('retourne une initiale pour un seul mot', async () => {
      const { comp } = await createComponent();
      expect(comp.initiales('Comptabilite')).toBe('C');
    });
  });
});
