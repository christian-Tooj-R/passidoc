import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from '../top-nav/top-nav.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, TopNavComponent],
  template: `
    <div class="shell">
      <app-top-nav />
      <main class="shell__main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    .shell__main {
      flex: 1;
      overflow-y: auto;
      background: #f1f5f9;
    }
  `],
})
export class MainLayoutComponent {}
