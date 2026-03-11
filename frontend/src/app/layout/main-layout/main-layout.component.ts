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
    .layout { display: flex; height: 100vh; overflow: hidden; }
    .layout__content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .layout__main { flex: 1; overflow-y: auto; padding: 24px; background: #f5f5f5; }
  `],
})
export class MainLayoutComponent {}
