import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ApercuRelance, ResultatRelance, SuiviPiecesService } from '../../core/services/suivi-pieces.service';
import { approcheClient } from '../../core/models/client.model';

/**
 * Relance d'un client pour ses pièces manquantes (cahier v2 #1) : destinataire = contact
 * opérationnel (repli : contact légal), texte pré-rédigé selon l'approche client (#3),
 * relu et modifiable avant envoi. Rien n'est envoyé sans clic sur « Envoyer ».
 */
@Component({
  selector: 'app-relance-client',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
<div class="rc-overlay" (click)="fermer.emit()">
  <div class="rc" role="dialog" aria-modal="true" aria-labelledby="rc-titre" (click)="$event.stopPropagation()">
    <header class="rc-hd">
      <mat-icon>forward_to_inbox</mat-icon>
      <h2 id="rc-titre">Relancer le client{{ apercu() ? ' — ' + apercu()!.client : '' }}</h2>
      <button type="button" class="rc-x" (click)="fermer.emit()" aria-label="Fermer"><mat-icon>close</mat-icon></button>
    </header>

    @if (chargement()) {
      <div class="rc-etat"><mat-icon class="spin">sync</mat-icon> Préparation de la relance…</div>
    } @else if (erreurChargement()) {
      <div class="rc-etat rc-etat--err"><mat-icon>error_outline</mat-icon> {{ erreurChargement() }}</div>
    } @else if (envoye(); as r) {
      <div class="rc-ok">
        <mat-icon>mark_email_read</mat-icon>
        <div>
          <strong>Relance envoyée à {{ r.destinataire.nom || r.envoyeA }}</strong>
          <span>{{ r.envoyeA }} — {{ r.nbPieces }} pièce(s). La date de relance est notée sur la grille du dossier.</span>
        </div>
      </div>
      <footer class="rc-ft"><button type="button" class="rc-btn rc-btn--ok" (click)="fermer.emit()">Fermer</button></footer>
    } @else if (apercu(); as a) {
      <div class="rc-body">
        <div class="rc-meta">
          <div class="rc-dest" [class.rc-dest--none]="!a.destinataire">
            <mat-icon>{{ a.destinataire ? 'support_agent' : 'person_off' }}</mat-icon>
            @if (a.destinataire) {
              <div>
                <span class="rc-lbl">Destinataire — {{ a.destinataire.role === 'OPERATIONNEL' ? 'contact opérationnel' : 'contact légal (pas de contact opérationnel)' }}</span>
                <strong>{{ a.destinataire.nom || a.destinataire.email }}</strong> <span class="rc-mail">{{ a.destinataire.email }}</span>
              </div>
            } @else {
              <div>
                <span class="rc-lbl">Aucune adresse e-mail</span>
                <strong>Renseignez le contact opérationnel dans la fiche d'identité du dossier.</strong>
              </div>
            }
          </div>
          <div class="rc-appr badge-approche badge-approche--{{ a.approche }}" [title]="approche().description">
            <mat-icon>{{ approche().icon }}</mat-icon> Approche {{ approche().libelle.toLowerCase() }} — {{ approche().description }}
          </div>
        </div>

        <label class="rc-lbl" for="rc-objet">Objet</label>
        <input id="rc-objet" class="rc-input" [(ngModel)]="objet" maxlength="200" />
        <label class="rc-lbl" for="rc-texte">Message ({{ a.manquantes.length }} pièce(s) manquante(s))</label>
        <textarea id="rc-texte" class="rc-input rc-texte" [(ngModel)]="texte" rows="13" maxlength="8000"></textarea>
        @if (erreurEnvoi()) { <p class="rc-err">{{ erreurEnvoi() }}</p> }
      </div>
      <footer class="rc-ft">
        <button type="button" class="rc-btn" (click)="fermer.emit()">Annuler</button>
        <button type="button" class="rc-btn rc-btn--ok" (click)="envoyer()"
                [disabled]="envoi() || !a.destinataire || !a.manquantes.length || !texte.trim()">
          <mat-icon>{{ envoi() ? 'hourglass_empty' : 'send' }}</mat-icon> {{ envoi() ? 'Envoi…' : 'Envoyer la relance' }}
        </button>
      </footer>
    }
  </div>
</div>
  `,
  styles: [`
    .rc-overlay { position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; }
    .rc { background:#fff; border-radius:14px; width:min(720px, 100%); max-height:calc(100vh - 32px); display:flex; flex-direction:column; box-shadow:0 20px 50px rgba(15,23,42,.3); overflow:hidden; }
    .rc-hd { display:flex; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid #e2e8f0; }
    .rc-hd h2 { margin:0; font-size:16px; font-weight:800; color:#0f172a; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .rc-hd > mat-icon { color:#1e3a8a; }
    .rc-x { background:none; border:none; cursor:pointer; color:#64748b; display:flex; padding:4px; border-radius:6px; }
    .rc-x:hover { background:#f1f5f9; }
    .rc-body { padding:16px 18px; overflow:auto; display:flex; flex-direction:column; gap:6px; }
    .rc-meta { display:flex; flex-direction:column; gap:8px; margin-bottom:8px; }
    .rc-dest { display:flex; gap:10px; align-items:flex-start; padding:10px 12px; border-radius:10px; background:#f0fdfa; border:1px solid #99f6e4; font-size:13px; color:#0f172a; }
    .rc-dest mat-icon { color:#0f766e; }
    .rc-dest--none { background:#fef2f2; border-color:#fecaca; }
    .rc-dest--none mat-icon { color:#dc2626; }
    .rc-dest div { display:flex; flex-direction:column; gap:2px; }
    .rc-mail { color:#475569; font-size:12.5px; }
    .rc-appr { align-self:flex-start; }
    .rc-appr mat-icon { font-size:14px; width:14px; height:14px; }
    .rc-lbl { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; margin-top:6px; }
    .rc-input { border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; font:inherit; font-size:13.5px; color:#0f172a; outline:none; }
    .rc-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
    .rc-texte { resize:vertical; line-height:1.5; font-family:inherit; }
    .rc-err { color:#dc2626; font-size:12.5px; margin:6px 0 0; }
    .rc-ft { display:flex; justify-content:flex-end; gap:8px; padding:12px 18px; border-top:1px solid #e2e8f0; background:#f8fafc; }
    .rc-btn { height:36px; display:flex; align-items:center; gap:6px; padding:0 16px; border-radius:8px; border:1px solid #e2e8f0; background:#fff; color:#334155; font-weight:600; font-size:13px; cursor:pointer; }
    .rc-btn mat-icon { font-size:18px; width:18px; height:18px; }
    .rc-btn--ok { background:#1e3a8a; border-color:#1e3a8a; color:#fff; }
    .rc-btn:disabled { opacity:.55; cursor:not-allowed; }
    .rc-etat { display:flex; align-items:center; gap:8px; padding:40px 18px; justify-content:center; color:#64748b; font-size:13.5px; }
    .rc-etat--err { color:#b91c1c; }
    .rc-ok { display:flex; gap:12px; align-items:flex-start; padding:22px 18px; font-size:13.5px; color:#0f172a; }
    .rc-ok mat-icon { color:#059669; font-size:28px; width:28px; height:28px; }
    .rc-ok div { display:flex; flex-direction:column; gap:4px; }
    .rc-ok span { color:#475569; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `],
})
export class RelanceClientComponent implements OnInit {
  @Input({ required: true }) clientId!: number;
  @Input() annee?: number;
  @Output() fermer = new EventEmitter<void>();
  @Output() envoyee = new EventEmitter<ResultatRelance>();

  private svc = inject(SuiviPiecesService);

  readonly chargement = signal(true);
  readonly erreurChargement = signal('');
  readonly apercu = signal<ApercuRelance | null>(null);
  readonly envoi = signal(false);
  readonly erreurEnvoi = signal('');
  readonly envoye = signal<ResultatRelance | null>(null);
  objet = '';
  texte = '';

  approche() { return approcheClient(this.apercu()?.approche); }

  ngOnInit() {
    this.svc.apercuRelance(this.clientId, this.annee).subscribe({
      next: a => {
        this.apercu.set(a);
        this.objet = a.objet;
        this.texte = a.texte;
        this.chargement.set(false);
        if (!a.manquantes.length) this.erreurChargement.set('Aucune pièce manquante à relancer pour ce dossier.');
      },
      error: e => {
        this.erreurChargement.set(e?.error?.message || 'Impossible de préparer la relance.');
        this.chargement.set(false);
      },
    });
  }

  envoyer() {
    this.envoi.set(true);
    this.erreurEnvoi.set('');
    this.svc.envoyerRelance(this.clientId, { objet: this.objet, texte: this.texte }, this.annee).subscribe({
      next: r => { this.envoi.set(false); this.envoye.set(r); this.envoyee.emit(r); },
      error: e => {
        this.envoi.set(false);
        this.erreurEnvoi.set(e?.error?.message || "L'envoi a échoué — réessayez.");
      },
    });
  }
}
