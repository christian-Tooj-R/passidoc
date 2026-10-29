/**
 * Page « Par jour » — l'affaire de chaque saisie : affichée dans la colonne « Client / Affaire »,
 * transmise au formulaire de modification (qui affichait toujours « Automatique »), cherchable.
 */
import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { TravailTempsJourComponent } from './travail-temps-jour.component';
import { SaisieTempsService } from '../../../../core/services/saisie-temps.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { UsersService } from '../../../../core/services/users.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';

const saisie = {
  id: 7, date: '2026-03-10', collaborateurId: 1, collaborateur: 'Zz Test', clientId: 2, client: 'Dossier A',
  commentaire: 'Révision', dureeHeures: 1.5, type: 'FACTURABLE', categorie: null, missionCode: 'REV',
  affaire: 'C2025-12', lieuTravail: 'EST', heureDebut: null, heureFin: null, isLocked: false,
};

async function afficher(lignes: any[]) {
  TestBed.configureTestingModule({
    imports: [TravailTempsJourComponent],
    providers: [
      provideAnimations(), provideHttpClient(), provideHttpClientTesting(),
      { provide: SaisieTempsService, useValue: { getRapportJour: () => of(lignes), getAffaires: () => of([]), update: vi.fn() } },
      { provide: ClientsService, useValue: { getAll: () => of([{ id: 2, nom: 'Dossier A' }]) } },
      { provide: UsersService, useValue: { getAll: () => of([]) } },
      { provide: AuthService, useValue: { currentUser: () => ({ id: 1, site: 'EST' }), isAdmin: () => false } },
      { provide: TenantService, useValue: { poleLabel1: () => 'Pôle EST', poleLabel2: () => 'Pôle OUEST' } },
    ],
  });
  const fixture = TestBed.createComponent(TravailTempsJourComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('TravailTempsJourComponent — affaire des saisies', () => {
  it('affiche l\'affaire sous le client', async () => {
    const { el } = await afficher([saisie, { ...saisie, id: 8, affaire: null }]);
    const cellules = [...el.querySelectorAll('td.td-client')].map(td => td.querySelector('.td-affaire')?.textContent?.trim() ?? null);
    expect(cellules).toEqual(['C2025-12', null]);
    expect(el.querySelector('td.td-client')!.textContent).toContain('Dossier A');
  });

  it('la modification et la duplication partent de l\'affaire enregistrée', async () => {
    const { comp } = await afficher([saisie]);
    comp.startEdit(saisie);
    expect(comp.editSeed()).toMatchObject({ affaire: 'C2025-12', clientId: 2 });
    comp.startDuplicate({ ...saisie, affaire: null });
    expect(comp.editSeed()).toHaveProperty('affaire', null);
  });

  it('la recherche porte aussi sur l\'affaire', async () => {
    const { comp } = await afficher([saisie, { ...saisie, id: 8, affaire: 'C2026-12' }]);
    comp.recherche = 'c2026';
    expect(comp.filteredRows().map(r => r.id)).toEqual([8]);
  });
});
