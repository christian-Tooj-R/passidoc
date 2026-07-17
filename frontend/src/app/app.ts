import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
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
  private theme = inject(ThemeService);
  ngOnInit() { this.theme.load(); }
}
