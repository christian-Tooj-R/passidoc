import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from '../top-nav/top-nav.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, TopNavComponent],
  template: `
    <div class="layout">
      <app-top-nav />
      <main class="layout__main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: #f1f5f9;
    }
    .layout__main {
      flex: 1;
      overflow-y: auto;
      padding: 28px 36px;
    }
  `],
})
export class MainLayoutComponent {}
