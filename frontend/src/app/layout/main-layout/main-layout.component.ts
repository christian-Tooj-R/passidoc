import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from '../top-nav/top-nav.component';
import { SideNavComponent } from '../side-nav/side-nav.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, TopNavComponent, SideNavComponent],
  template: `
    <div class="shell">

      <!-- Top bar full-width -->
      <app-top-nav
        [sidebarOpen]="sideOpen()"
        (toggleSidebar)="sideOpen.set(!sideOpen())"
      />

      <!-- Body = sidebar + content -->
      <div class="shell__body">
        <app-side-nav [open]="sideOpen()" />

        <main class="shell__main">
          <router-outlet />
        </main>
      </div>

    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: #f1f5f9;
    }
    .shell__body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .shell__main {
      flex: 1;
      overflow-y: auto;
      padding: 28px 32px;
      min-width: 0;
    }
  `],
})
export class MainLayoutComponent {
  sideOpen = signal(true);
}
