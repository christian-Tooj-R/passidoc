import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect } from 'vitest';
import { RhComponent } from './rh.component';

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [RhComponent],
    providers: [
      provideRouter([]),
      provideAnimations(),
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(RhComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('RhComponent', () => {
  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('entering démarre à true', async () => {
    const { comp } = await createComponent();
    expect(comp.entering()).toBe(true);
  });

  it('affiche l\'entrée du module RH', async () => {
    const { fixture } = await createComponent();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toMatch(/Ressources Humaines/i);
  });

  it('navLoading est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.navLoading()).toBe(false);
  });
});
