import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect } from 'vitest';
import { SalariesHubComponent } from './salaries-hub.component';

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [SalariesHubComponent],
    providers: [provideRouter([]), provideAnimations()],
  }).compileComponents();

  const fixture = TestBed.createComponent(SalariesHubComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('SalariesHubComponent', () => {
  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });
});
