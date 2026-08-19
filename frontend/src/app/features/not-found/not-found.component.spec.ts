import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundComponent } from './not-found.component';

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [NotFoundComponent],
    providers: [provideRouter([]), provideAnimations()],
  }).compileComponents();

  const fixture = TestBed.createComponent(NotFoundComponent);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance };
}

describe('NotFoundComponent', () => {
  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('affiche le code 404 dans le DOM', async () => {
    const { fixture } = await createComponent();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('404');
  });

  it('affiche le texte Page introuvable', async () => {
    const { fixture } = await createComponent();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('introuvable');
  });

  it('affiche le lien retour au tableau de bord', async () => {
    const { fixture } = await createComponent();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('tableau de bord');
  });

  it('affiche la marque Passidoc', async () => {
    const { fixture } = await createComponent();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Passidoc');
  });
});
