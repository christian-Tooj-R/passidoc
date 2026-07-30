import { Component, inject, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ThemeService } from './core/services/theme.service';
import { TenantService } from './core/services/tenant.service';
import { AiChatWidgetComponent } from './shared/ai-chat-widget/ai-chat-widget.component';
import { HelpPanelComponent } from './shared/help-panel/help-panel.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AiChatWidgetComponent, HelpPanelComponent],
  template: `
    <router-outlet />
    <app-ai-chat-widget />
    <app-help-panel />
  `,
})
export class App implements OnInit {
  private theme  = inject(ThemeService);
  private tenant = inject(TenantService);
  private router = inject(Router);

  ngOnInit() {
    this.theme.load();

    // Après chaque navigation, réinjecter ?tenant= dans l'URL si absent
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
    ).subscribe((e: NavigationEnd) => {
      const slug = this.tenant.slug();
      if (!slug) return;
      const url = e.urlAfterRedirects ?? e.url;
      if (url.includes('tenant=')) return; // déjà présent
      this.router.navigate([], {
        queryParams: { tenant: slug },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }
}
