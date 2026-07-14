import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { AiChatWidgetComponent } from './shared/ai-chat-widget/ai-chat-widget.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AiChatWidgetComponent],
  template: `
    <router-outlet />
    <app-ai-chat-widget />
  `,
})
export class App implements OnInit {
  private theme = inject(ThemeService);
  ngOnInit() { this.theme.load(); }
}
