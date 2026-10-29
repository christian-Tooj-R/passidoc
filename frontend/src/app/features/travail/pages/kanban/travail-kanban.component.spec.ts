/**
 * Kanban des tâches — temps affiché sur les cartes.
 */
import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { vi, describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { TravailKanbanComponent } from './travail-kanban.component';
import { TasksService, Task } from '../../../../core/services/tasks.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { UsersService } from '../../../../core/services/users.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TimerService } from '../../../../core/services/saisie-temps.service';

const tache = (o: Partial<Task>): Task => ({
  id: 1, titre: 'T', statut: 'TERMINEE', priorite: 'NORMALE', clientId: 2, createdAt: '', ...o,
} as Task);

async function afficher(taches: Task[]) {
  TestBed.configureTestingModule({
    imports: [TravailKanbanComponent],
    providers: [
      provideAnimations(),
      { provide: TasksService, useValue: { getAllGlobal: () => of(taches), update: vi.fn() } },
      { provide: ClientsService, useValue: { getAll: () => of([]) } },
      { provide: UsersService, useValue: { getAll: () => of([]) } },
      { provide: AuthService, useValue: { currentUser: () => null, isAdmin: () => false } },
      { provide: TimerService, useValue: { activeTaskCtx: signal(null), isRunning: signal(false), pausedTasks: signal({}) } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(TravailKanbanComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('TravailKanbanComponent — temps des cartes', () => {
  it('tempsExecution est en minutes : formaté en h/min, plus de « 0.0434…h »', async () => {
    const { el } = await afficher([
      tache({ id: 1, tempsExecution: 0.04348333333333333 }),
      tache({ id: 2, tempsExecution: 4.4 }),
      tache({ id: 3, tempsExecution: 65 }),
      tache({ id: 4, tempsExecution: 119.6 }),
    ]);
    const textes = [...el.querySelectorAll('.card-time')].map(e => e.textContent!.replace('schedule', '').trim());
    expect(textes).toEqual(['< 1min', '4min', '1h05', '2h']);
  });

  it('le temps chronométré prime sur le délai création → fin', async () => {
    const { comp } = await afficher([]);
    expect(comp.dureeCarte(tache({ tempsTotalSecondes: 1500, tempsExecution: 2880 })))
      .toEqual({ texte: '25min', aide: 'Temps chronométré' });
    expect(comp.dureeCarte(tache({ tempsExecution: 2880 })))
      .toEqual({ texte: '48h', aide: 'Délai entre la création et la fin de la tâche' });
    expect(comp.dureeCarte(tache({}))).toBeNull();
  });
});
