import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MissionsService, MissionSaisie } from '../../../../../core/services/missions.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmService } from '../../../../../core/services/confirm.service';
import {
  CYCLES_MISSIONS, HistoriqueStatut, Mission, STATUTS_MISSION, StatutMission,
  libelleStatut, nomCycle, peutSupprimerMission,
} from '../../../../../core/models/mission.model';

export interface MissionFormData {
  clientId: number;
  /** Absente = création. */
  mission?: Mission;
  /** Création depuis un cycle (onglet « Par cycle ») : cycle d'origine figé. */
  cycle?: string | null;
  exerciceId: number | null;
  annee?: number | null;
  utilisateurs: { id: number; firstName: string; lastName: string; isActive?: boolean }[];
  peutEcrire: boolean;
  /** Le cycle d'origine peut-il être choisi (pipeline) ? Sinon il est affiché en lecture seule. */
  cycleModifiable: boolean;
  prefill?: { titre?: string; description?: string; arguments?: string; honoraires?: number | null; cycle?: string | null; repriseDeId?: number };
}

/**
 * Saisie d'une mission (CDC §3.3) — création depuis un cycle ou hors cycle, détail et
 * modification, historique des statuts (R4), archivage / suppression (R7).
 * Fermeture : 'saved' | 'deleted' | undefined.
 */
@Component({
  selector: 'app-mission-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatTooltipModule],
  template: `
<div class="mf">
  <div class="mf-head">
    <div>
      <div class="mf-kicker">{{ data.mission ? 'Mission' : 'Nouvelle mission' }} · {{ libelleCycle() }}</div>
      <h2 class="mf-title">{{ data.mission ? data.mission.titre : (data.cycle ? 'Proposer une mission sur ce cycle' : 'Mission hors cycle') }}</h2>
    </div>
    <button class="mf-x" type="button" (click)="ref.close()" aria-label="Fermer"><mat-icon>close</mat-icon></button>
  </div>

  <div class="mf-body">
    <div class="mf-grid">
      <label class="f f--full">
        <span class="f-l">Intitulé de la mission <b class="req">*</b></span>
        <input class="f-i" name="titre" [(ngModel)]="titre" [disabled]="!data.peutEcrire" maxlength="255"
               placeholder="Ex. : Plan de trésorerie prévisionnel annuel" />
      </label>

      <label class="f">
        <span class="f-l">Statut <b class="req">*</b></span>
        <select class="f-i st st--{{ statut }}" name="statut" [(ngModel)]="statut" [disabled]="!data.peutEcrire">
          @for (s of statuts; track s.code) { <option [value]="s.code">{{ s.libelle }}</option> }
        </select>
        <span class="f-h">{{ definitionStatut() }}</span>
      </label>

      <label class="f">
        <span class="f-l">Montant estimé (€ HT)</span>
        <input class="f-i" type="number" min="0" step="100" name="honoraires" [(ngModel)]="honoraires" [disabled]="!data.peutEcrire" placeholder="—" />
        <span class="f-h">Estimation d'honoraires, reprise dans le pipeline.</span>
      </label>

      <label class="f">
        <span class="f-l">Date de relance</span>
        <input class="f-i" type="date" name="dateRelance" [(ngModel)]="dateRelance" [disabled]="!data.peutEcrire" />
        <span class="f-h">Rappel au responsable 3 jours avant, puis le jour même.</span>
      </label>

      <label class="f">
        <span class="f-l">Collaborateur responsable</span>
        <select class="f-i" name="responsable" [(ngModel)]="responsableId" [disabled]="!data.peutEcrire">
          <option [ngValue]="null">— Non attribuée —</option>
          @for (u of utilisateurs; track u.id) { <option [ngValue]="u.id">{{ u.firstName }} {{ u.lastName }}</option> }
        </select>
      </label>

      <label class="f f--full">
        <span class="f-l">Description</span>
        <textarea class="f-i f-ta" name="description" rows="3" [(ngModel)]="description" [disabled]="!data.peutEcrire"
                  placeholder="Détail de ce qui est proposé, contexte, justification"></textarea>
      </label>

      @if (data.cycleModifiable) {
        <label class="f">
          <span class="f-l">Cycle d'origine</span>
          <select class="f-i" name="cycle" [(ngModel)]="cycle" [disabled]="!data.peutEcrire">
            <option [ngValue]="null">— Hors cycle</option>
            @for (c of cycles; track c.code) { <option [ngValue]="c.code">{{ c.code }} · {{ c.nom }}</option> }
          </select>
        </label>
      }

      @if (statut === 'REFUSEE' || raisonRefus) {
        <label class="f f--full">
          <span class="f-l">Raison du refus</span>
          <textarea class="f-i f-ta" name="raisonRefus" rows="2" [(ngModel)]="raisonRefus" [disabled]="!data.peutEcrire"></textarea>
        </label>
      }
      @if (argumentsTexte) {
        <label class="f f--full">
          <span class="f-l">Arguments</span>
          <textarea class="f-i f-ta" name="arguments" rows="2" [(ngModel)]="argumentsTexte" [disabled]="!data.peutEcrire"></textarea>
        </label>
      }
    </div>

    @if (data.mission) {
      <div class="mf-histo">
        <div class="mf-histo__t"><mat-icon>history</mat-icon> Historique du statut</div>
        @if (!historique().length) { <div class="muted">Aucun changement enregistré.</div> }
        @for (h of historique(); track h.id) {
          <div class="mf-histo__l">
            <span class="muted">{{ h.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
            @if (h.ancienStatut) {
              <span class="badge-mission badge-mission--{{ h.ancienStatut }}">{{ libelle(h.ancienStatut) }}</span>
              <mat-icon class="arrow">arrow_forward</mat-icon>
            } @else { <span class="muted">Création</span> }
            <span class="badge-mission badge-mission--{{ h.nouveauStatut }}">{{ libelle(h.nouveauStatut) }}</span>
            <span class="muted">par {{ h.auteurNom || '—' }}</span>
          </div>
        }
      </div>
    }
    @if (erreur()) { <div class="mf-err"><mat-icon>error_outline</mat-icon> {{ erreur() }}</div> }
  </div>

  <div class="mf-foot">
    @if (data.mission && data.peutEcrire) {
      @if (peutSupprimer()) {
        <button class="b b--danger" type="button" (click)="supprimer()" [disabled]="saving()"><mat-icon>delete</mat-icon> Supprimer</button>
      } @else {
        <button class="b b--ghost" type="button" (click)="archiver()" [disabled]="saving()"
                matTooltip="Une mission en discussion, acceptée ou refusée ne se supprime pas : elle s'archive">
          <mat-icon>{{ data.mission.archivee ? 'unarchive' : 'archive' }}</mat-icon> {{ data.mission.archivee ? 'Désarchiver' : 'Archiver' }}
        </button>
      }
    }
    <span class="spacer"></span>
    <button class="b b--ghost" type="button" (click)="ref.close()">{{ data.peutEcrire ? 'Annuler' : 'Fermer' }}</button>
    @if (data.peutEcrire) {
      <button class="b b--primary" type="button" (click)="enregistrer()" [disabled]="saving() || !titre.trim()">
        <mat-icon>check</mat-icon> {{ data.mission ? 'Enregistrer' : 'Créer la mission' }}
      </button>
    }
  </div>
</div>
  `,
  styles: [`
    .mf { display:flex; flex-direction:column; max-height:90vh; font-family:inherit; }
    .mf-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:18px 22px 12px; border-bottom:1px solid #f1f5f9; }
    .mf-kicker { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#6366f1; }
    .mf-title { margin:2px 0 0; font-size:17px; font-weight:800; color:#0f172a; }
    .mf-x { border:none; background:transparent; cursor:pointer; color:#64748b; padding:4px; border-radius:6px; }
    .mf-x:hover { background:#f1f5f9; }
    .mf-body { padding:16px 22px; overflow:auto; }
    .mf-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 16px; }
    .f { display:flex; flex-direction:column; gap:4px; min-width:0; }
    .f--full { grid-column:1 / -1; }
    .f-l { font-size:11px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:.04em; }
    .req { color:#dc2626; }
    .f-i { height:36px; border:1px solid #e2e8f0; border-radius:8px; padding:0 10px; font-size:13.5px; font-family:inherit; color:#0f172a; background:#fff; box-sizing:border-box; width:100%; }
    .f-i:focus { outline:none; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.15); }
    .f-i:disabled { background:#f8fafc; color:#334155; }
    .f-ta { height:auto; padding:8px 10px; resize:vertical; line-height:1.45; }
    .f-h { font-size:11.5px; color:#94a3b8; }
    .st { font-weight:700; }
    .st--PROPOSEE { color:#1d4ed8; } .st--EN_DISCUSSION { color:#a16207; } .st--ACCEPTEE { color:#15803d; }
    .st--REFUSEE { color:#dc2626; } .st--SANS_SUITE { color:#4b5563; }
    .mf-histo { margin-top:16px; padding:12px 14px; border-radius:10px; background:#f8fafc; border:1px solid #f1f5f9; }
    .mf-histo__t { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#334155; margin-bottom:8px; }
    .mf-histo__t mat-icon { font-size:16px; width:16px; height:16px; }
    .mf-histo__l { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12px; padding:3px 0; }
    .arrow { font-size:14px; width:14px; height:14px; color:#94a3b8; }
    .muted { color:#64748b; font-size:12px; }
    .mf-err { display:flex; align-items:center; gap:6px; margin-top:12px; color:#b91c1c; font-size:13px; background:#fef2f2; border:1px solid #fecaca; padding:8px 10px; border-radius:8px; }
    .mf-foot { display:flex; align-items:center; gap:8px; padding:12px 22px 16px; border-top:1px solid #f1f5f9; }
    .spacer { flex:1; }
    .b { display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 14px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; border:1px solid transparent; }
    .b mat-icon { font-size:17px; width:17px; height:17px; }
    .b:disabled { opacity:.5; cursor:not-allowed; }
    .b--primary { background:#4f46e5; color:#fff; }
    .b--ghost { background:#fff; color:#334155; border-color:#e2e8f0; }
    .b--danger { background:#fff; color:#dc2626; border-color:#fecaca; }
    @media (max-width: 640px) { .mf-grid { grid-template-columns:1fr; } }
  `],
})
export class MissionFormDialogComponent implements OnInit {
  readonly data: MissionFormData = inject(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<MissionFormDialogComponent>);
  private svc = inject(MissionsService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  get statuts() { return STATUTS_MISSION; }
  get cycles() { return CYCLES_MISSIONS; }

  titre = '';
  description = '';
  honoraires: number | null = null;
  statut: StatutMission = 'PROPOSEE';
  dateRelance = '';
  responsableId: number | null = null;
  cycle: string | null = null;
  raisonRefus = '';
  argumentsTexte = '';

  readonly historique = signal<HistoriqueStatut[]>([]);
  readonly saving = signal(false);
  readonly erreur = signal('');

  /** Utilisateurs actifs, plus le responsable actuel s'il ne l'est plus. */
  utilisateurs: MissionFormData['utilisateurs'] = [];

  ngOnInit() {
    const m = this.data.mission;
    const p = this.data.prefill;
    this.titre = m?.titre ?? p?.titre ?? '';
    this.description = m?.description ?? p?.description ?? '';
    this.honoraires = m?.honoraires ?? p?.honoraires ?? null;
    this.statut = m?.statut ?? 'PROPOSEE';
    this.dateRelance = m?.dateRelance ?? '';
    this.responsableId = m?.responsableId ?? null;
    this.cycle = m ? m.cycle : (this.data.cycle ?? p?.cycle ?? null);
    this.raisonRefus = m?.raisonRefus ?? '';
    this.argumentsTexte = m?.arguments ?? p?.arguments ?? '';
    this.utilisateurs = [...this.data.utilisateurs]
      .filter(u => u.isActive !== false || u.id === this.responsableId)
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'fr'));
    if (m) this.svc.historique(this.data.clientId, m.id).subscribe({ next: h => this.historique.set(h), error: () => {} });
  }

  libelle(s: string) { return libelleStatut(s); }
  libelleCycle() { return this.cycle ? `${this.cycle} · ${nomCycle(this.cycle)}` : 'Hors cycle'; }
  definitionStatut() { return STATUTS_MISSION.find(s => s.code === this.statut)?.definition ?? ''; }
  peutSupprimer() { return peutSupprimerMission(this.data.mission?.statut); }

  private saisie(): MissionSaisie {
    const h = this.honoraires as unknown;
    return {
      titre: this.titre.trim(),
      description: this.description?.trim() || null,
      honoraires: h === '' || h == null ? null : Number(h),
      statut: this.statut,
      dateRelance: this.dateRelance || null,
      responsableId: this.responsableId,
      ...(this.data.cycleModifiable || !this.data.mission ? { cycle: this.cycle } : {}),
      ...(this.raisonRefus ? { raisonRefus: this.raisonRefus } : {}),
      ...(this.argumentsTexte ? { arguments: this.argumentsTexte } : {}),
    };
  }

  enregistrer() {
    if (!this.titre.trim()) { this.erreur.set("L'intitulé de la mission est obligatoire."); return; }
    this.saving.set(true);
    this.erreur.set('');
    const m = this.data.mission;
    const req$ = m
      ? this.svc.update(this.data.clientId, m.id, this.saisie())
      : this.svc.create(this.data.clientId, {
          ...this.saisie(),
          exerciceId: this.cycle ? this.data.exerciceId : null,
          ...(this.data.annee ? { annee: this.data.annee } : {}),
          ...(this.data.prefill?.repriseDeId ? { repriseDeId: this.data.prefill.repriseDeId } : {}),
        });
    req$.subscribe({
      next: () => { this.toast.success(m ? 'Mission enregistrée' : 'Mission créée'); this.ref.close('saved'); },
      error: (e) => { this.saving.set(false); this.erreur.set(this.message(e)); },
    });
  }

  archiver() {
    const m = this.data.mission!;
    this.saving.set(true);
    this.svc.update(this.data.clientId, m.id, { archivee: !m.archivee }).subscribe({
      next: () => { this.toast.success(m.archivee ? 'Mission désarchivée' : 'Mission archivée'); this.ref.close('saved'); },
      error: (e) => { this.saving.set(false); this.erreur.set(this.message(e)); },
    });
  }

  supprimer() {
    const m = this.data.mission!;
    this.confirm.confirm(`Supprimer la mission « ${m.titre} » ?`).subscribe(ok => {
      if (!ok) return;
      this.saving.set(true);
      this.svc.delete(this.data.clientId, m.id).subscribe({
        next: () => { this.toast.success('Mission supprimée'); this.ref.close('deleted'); },
        error: (e) => { this.saving.set(false); this.erreur.set(this.message(e)); },
      });
    });
  }

  private message(e: any): string {
    const msg = e?.error?.message;
    return (Array.isArray(msg) ? msg.join(' ') : msg) || "L'enregistrement a échoué.";
  }
}
