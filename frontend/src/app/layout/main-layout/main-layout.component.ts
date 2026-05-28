import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  template: `
    <div class="layout">
      <app-sidebar />
      <div class="layout__content">
        <app-header />
        <main class="layout__main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout { display: flex; height: 100vh; overflow: hidden; background: var(--page-bg, #F4F6FB); }
    .layout__content { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
    .layout__main { flex: 1; overflow-y: auto; background: var(--page-bg, #F4F6FB); padding: 28px 32px; }
  `],
})
export class MainLayoutComponent {}
