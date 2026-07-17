import { Injectable, signal, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface HelpMessage { role: 'user' | 'assistant'; content: string; }

@Injectable({ providedIn: 'root' })
export class HelpService {
  private auth = inject(AuthService);
  private api  = environment.apiUrl;

  readonly isOpen = signal(false);

  open()   { this.isOpen.set(true);  }
  close()  { this.isOpen.set(false); }
  toggle() { this.isOpen.update(v => !v); }

  async chatStream(
    messages: HelpMessage[],
    onChunk: (t: string) => void,
    onDone:  () => void,
    onError: (e: string) => void,
  ) {
    const token = this.auth.getToken();
    try {
      const res = await fetch(`${this.api}/help/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ messages }),
      });
      if (!res.ok || !res.body) { onError('Erreur serveur'); return; }
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(decoder.decode(value, { stream: true }));
      }
      onDone();
    } catch (e: any) {
      onError(e?.message ?? 'Impossible de contacter le serveur.');
    }
  }
}
