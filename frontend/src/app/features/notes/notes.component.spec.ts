import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { NotesComponent } from './notes.component';
import { NotesService } from '../../core/services/notes.service';
import { ConfirmService } from '../../core/services/confirm.service';

const mockNotes   = { getAll: vi.fn().mockReturnValue(of([])), create: vi.fn().mockReturnValue(of({ id: 99, contenu: '', color: 0, pinned: false, createdAt: '', updatedAt: '' })), update: vi.fn().mockReturnValue(of({})), delete: vi.fn().mockReturnValue(of({})) };
const mockConfirm = { confirm: vi.fn().mockReturnValue(of(true)) };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [NotesComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      { provide: NotesService,   useValue: mockNotes },
      { provide: ConfirmService, useValue: mockConfirm },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(NotesComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('NotesComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotes.getAll.mockReturnValue(of([]));
    mockNotes.create.mockReturnValue(of({ id: 99, contenu: '', color: 0, pinned: false, createdAt: '', updatedAt: '' }));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge les notes au init', async () => {
    await createComponent();
    expect(mockNotes.getAll).toHaveBeenCalled();
  });

  it('notes est vide par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.notes()).toHaveLength(0);
  });

  it('loading passe à false après chargement', async () => {
    const { comp } = await createComponent();
    expect(comp.loading()).toBe(false);
  });

  it('saving est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.saving()).toBe(false);
  });

  describe('pinnedNotes / otherNotes', () => {
    it('sépare les notes épinglées et non épinglées', async () => {
      mockNotes.getAll.mockReturnValue(of([
        { id: 1, title: 'A', content: 'Aa', color: '0', pinned: true,  createdAt: '', updatedAt: '' },
        { id: 2, title: 'B', content: 'Bb', color: '1', pinned: false, createdAt: '', updatedAt: '' },
      ]));
      const { comp } = await createComponent();
      expect(comp.pinnedNotes()).toHaveLength(1);
      expect(comp.otherNotes()).toHaveLength(1);
    });
  });

  describe('addNote', () => {
    it('appelle NotesService.create', async () => {
      const { comp } = await createComponent();
      comp.addNote();
      expect(mockNotes.create).toHaveBeenCalled();
    });
  });

  describe('affichage', () => {
    it('affiche le titre Mes Notes', async () => {
      const { fixture } = await createComponent();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Notes');
    });
  });
});
