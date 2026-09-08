import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject , OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TabSaveService } from '../../../../../core/services/tab-save.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmService } from '../../../../../core/services/confirm.service';
import { ControleInterneService } from '../../../../../core/services/controle-interne.service';

@Component({
  selector: 'app-controle-interne-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="tab">
      <!-- Process OK -->
      <div class="section">
        <div class="section-header section-header--green">
          <mat-icon>check_circle</mat-icon>
          <span>Process qui fonctionnent bien</span>
          <button mat-icon-button (click)="addProcessOk()"><mat-icon>add</mat-icon></button>
        </div>
        <div class="process-rows">
          @for (p of processOk; track $index) {
            <div class="process-row process-row--green">
              <input class="process-input" [(ngModel)]="p.description" placeholder="Description du process..." />
              <input class="process-input" [(ngModel)]="p.raison" placeholder="Pourquoi ça fonctionne..." />
              <button mat-icon-button (click)="removeProcessOk($index)"><mat-icon>remove_circle_outline</mat-icon></button>
            </div>
          }
          @if (processOk.length === 0) {
            <p class="empty-hint">Cliquez sur + pour ajouter un process</p>
          }
        </div>
      </div>

      <!-- Process défaillants -->
      <div class="section">
        <div class="section-header section-header--red">
          <mat-icon>cancel</mat-icon>
          <span>Process qui font défaut</span>
          <button mat-icon-button (click)="addProcessKo()"><mat-icon>add</mat-icon></button>
        </div>
        <div class="process-rows">
          @for (p of processKo; track $index) {
            <div class="process-row process-row--red">
              <input class="process-input" [(ngModel)]="p.description" placeholder="Description du process..." />
              <input class="process-input" [(ngModel)]="p.raison" placeholder="Pourquoi ça échoue..." />
              <input class="process-input" [(ngModel)]="p.risques" placeholder="Risques associés..." />
              <button mat-icon-button (click)="removeProcessKo($index)"><mat-icon>remove_circle_outline</mat-icon></button>
            </div>
          }
          @if (processKo.length === 0) {
            <p class="empty-hint">Cliquez sur + pour ajouter un process défaillant</p>
          }
        </div>
      </div>

      <!-- Outils de pilotage -->
      <div class="section">
        <div class="section-header section-header--blue">
          <mat-icon>settings</mat-icon>
          <span>Outils & modes de pilotage du client</span>
          <button mat-icon-button (click)="addOutil()"><mat-icon>add</mat-icon></button>
        </div>
        <div class="process-rows">
          @for (o of outils; track $index) {
            <div class="process-row process-row--blue">
              <input class="process-input" [(ngModel)]="o.nom" placeholder="Nom de l'outil (ex: Tiime Apps)" />
              <input class="process-input flex-2" [(ngModel)]="o.description" placeholder="Description de l'usage..." />
              <button mat-icon-button (click)="removeOutil($index)"><mat-icon>remove_circle_outline</mat-icon></button>
            </div>
          }
          @if (outils.length === 0) {
            <p class="empty-hint">Cliquez sur + pour ajouter un outil</p>
          }
        </div>
      </div>

      <!-- Note générale -->
      <div class="section">
        <div class="section-header section-header--gray">
          <mat-icon>notes</mat-icon>
          <span>Note générale</span>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <textarea matInput rows="4" [(ngModel)]="noteGenerale"
            placeholder="Observations générales sur l'organisation interne..."></textarea>
        </mat-form-field>
      </div>

      <!-- TACHE-05 : Risques identifiés -->
      <div class="section">
        <div class="section-header section-header--orange">
          <mat-icon>warning_amber</mat-icon>
          <span>Risques identifiés</span>
          <button mat-icon-button (click)="addRisque()" [disabled]="readonly"><mat-icon>add</mat-icon></button>
        </div>
        <div class="process-rows">
          @for (r of risques; track $index) {
            <div class="process-row process-row--orange">
              <textarea class="process-input" [(ngModel)]="r.description" placeholder="Description du risque..." rows="2"></textarea>
              <select class="ci-select" [(ngModel)]="r.niveauRisque">
                <option value="FAIBLE">Faible</option>
                <option value="MOYEN">Moyen</option>
                <option value="ELEVE">Élevé</option>
              </select>
              <span class="risque-badge" [class]="'risque-' + r.niveauRisque.toLowerCase()">
                {{ r.niveauRisque === 'FAIBLE' ? 'Faible' : r.niveauRisque === 'MOYEN' ? 'Moyen' : 'Élevé' }}
              </span>
              <button mat-icon-button (click)="removeRisque($index)" [disabled]="readonly">
                <mat-icon>remove_circle_outline</mat-icon>
              </button>
            </div>
          }
          @if (risques.length === 0) {
            <p class="empty-hint">Aucun risque identifié — cliquez sur + pour en ajouter</p>
          }
        </div>
      </div>

      <!-- TACHE-05 : Recommandations formalisées -->
      <div class="section">
        <div class="section-header section-header--purple">
          <mat-icon>recommend</mat-icon>
          <span>Recommandations formalisées</span>
          <button mat-icon-button (click)="addRecommandation()" [disabled]="readonly"><mat-icon>add</mat-icon></button>
        </div>
        @if (recommandationsValidees.length > 0) {
          <div class="ci-export-bar">
            <mat-icon>check_circle</mat-icon>
            <span>{{ recommandationsValidees.length }} recommandation{{ recommandationsValidees.length > 1 ? 's' : '' }} validée{{ recommandationsValidees.length > 1 ? 's' : '' }}</span>
            <button class="ci-export-btn" type="button" (click)="envoyerVersObjectifs()">
              <mat-icon>upload</mat-icon> Envoyer vers Objectifs
            </button>
          </div>
        }
        <div class="process-rows">
          @for (rec of recommandations; track $index) {
            <div class="process-row process-row--purple">
              <textarea class="process-input" [(ngModel)]="rec.description" placeholder="Description de la recommandation..." rows="2"></textarea>
              <select class="ci-select" [(ngModel)]="rec.statut">
                <option value="A_SOUMETTRE">À soumettre</option>
                <option value="SOUMIS">Soumis au client</option>
                <option value="ACCEPTE">Accepté</option>
                <option value="EN_COURS">En cours</option>
                <option value="MIS_EN_OEUVRE">Mis en œuvre</option>
              </select>
              <button mat-icon-button (click)="removeRecommandation($index)" [disabled]="readonly">
                <mat-icon>remove_circle_outline</mat-icon>
              </button>
            </div>
          }
          @if (recommandations.length === 0) {
            <p class="empty-hint">Aucune recommandation — cliquez sur + pour en ajouter</p>
          }
        </div>
      </div>

      <!-- TACHE-05 : Mission de conseil potentielle -->
      <div class="section">
        <div class="section-header section-header--teal">
          <mat-icon>handshake</mat-icon>
          <span>Mission de conseil potentielle</span>
        </div>
        <div class="process-rows">
          <label class="mission-conseil-row">
            <input type="checkbox" [(ngModel)]="missionConseilPotentielle" [disabled]="readonly" />
            <span>Une mission de conseil en contrôle interne pourrait être proposée sur ce dossier</span>
          </label>
          @if (missionConseilPotentielle) {
            <div class="ci-mission-link">
              <mat-icon>info_outline</mat-icon>
              <span>Une mission a été identifiée sur ce dossier.</span>
              <button class="ci-link-btn" type="button" (click)="lancerCreationMission()">
                <mat-icon>arrow_forward</mat-icon> Créer la mission dans l'onglet Missions
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 24px; }

    /* ── Sections ───────────────────────────────────── */
    .section { margin-bottom: 28px; }

    .section-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-radius: 12px 12px 0 0;
      font-size: 13.5px; font-weight: 600;
    }
    .section-header mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .section-header span { flex: 1; }
    .section-header button {
      color: inherit !important;
      width: 30px !important; height: 30px !important;
      background: rgba(255,255,255,0.5) !important;
      border-radius: 8px !important;
    }
    .section-header--green  { background: #dcfce7; color: #15803d; }
    .section-header--red    { background: #fee2e2; color: #dc2626; }
    .section-header--blue   { background: #dbeafe; color: #1d4ed8; }
    .section-header--gray   { background: #f1f5f9; color: #475569; }
    .section-header--orange { background: #ffedd5; color: #c2410c; }
    .section-header--purple { background: #ede9fe; color: #6d28d9; }
    .section-header--teal   { background: #ccfbf1; color: #0f766e; }

    /* ── Rows container ─────────────────────────────── */
    .process-rows {
      border: 1px solid rgba(0,0,0,0.07); border-top: none;
      border-radius: 0 0 12px 12px;
      padding: 12px; background: white;
      display: flex; flex-direction: column; gap: 8px;
    }

    /* ── Individual row ─────────────────────────────── */
    .process-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.06);
      transition: box-shadow .15s;
    }
    .process-row:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); }
    .process-row--green { background: #f8fffe; }
    .process-row--red   { background: #fff8f8; }
    .process-row--blue  { background: #f8faff; }

    .process-input {
      flex: 1; border: none; background: transparent;
      font-size: 13.5px; padding: 6px 10px; border-radius: 8px;
      font-family: inherit; color: #1e293b; line-height: 1.4;
      transition: background .15s, outline .15s;
    }
    .process-input::placeholder { color: #94a3b8; }
    .process-input:focus {
      outline: 1.5px solid #6366f1;
      background: white;
    }
    .flex-2 { flex: 2 !important; }

    .full-width { width: 100%; }

    .process-row--orange { background: #fff7ed; }
    .process-row--purple { background: #faf5ff; }

    .empty-hint {
      font-size: 13px; color: #94a3b8;
      padding: 12px 14px; margin: 0;
      font-style: italic;
    }

    .ci-select {
      border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 6px 10px; font-size: 13px; font-family: inherit;
      background: white; color: #1e293b; cursor: pointer;
      min-width: 160px;
    }

    .risque-badge {
      font-size: 11px; font-weight: 700; padding: 3px 10px;
      border-radius: 20px; white-space: nowrap;
    }
    .risque-faible { background: #dcfce7; color: #15803d; }
    .risque-moyen  { background: #ffedd5; color: #c2410c; }
    .risque-eleve  { background: #fee2e2; color: #dc2626; }

    .ci-export-bar {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px;
      background: #f5f3ff; border: 1px solid #ddd6fe; border-top: none;
      font-size: 13px; color: #6d28d9;
      mat-icon { font-size: 17px; width: 17px; height: 17px; flex-shrink: 0; }
      span { flex: 1; font-weight: 600; }
    }
    .ci-export-btn {
      display: flex; align-items: center; gap: 6px; padding: 6px 16px;
      background: #7c3aed; color: white; border: none; border-radius: 8px;
      cursor: pointer; font-size: 12px; font-weight: 700; font-family: inherit;
      white-space: nowrap;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #6d28d9; }
    }
    .ci-mission-link {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      margin-top: 10px; padding: 10px 14px;
      background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px;
      font-size: 13px; color: #0f766e;
      mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    }
    .ci-link-btn {
      display: flex; align-items: center; gap: 5px; margin-left: auto;
      padding: 5px 12px; background: #0d9488; color: white; border: none;
      border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 700;
      font-family: inherit;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #0f766e; }
    }
    .mission-conseil-row {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; cursor: pointer;
      font-size: 14px; color: #1e293b;
    }
    .mission-conseil-row input[type="checkbox"] {
      width: 18px; height: 18px; cursor: pointer; accent-color: #0f766e;
    }
  `],
})
export class ControleInterneTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() clientId!: number;
  @Input() exerciceId!: number;
  @Input() readonly = false;
  @Output() navigateTo    = new EventEmitter<string>();
  @Output() exporterReco  = new EventEmitter<string[]>();
  @Output() creerMissionCI = new EventEmitter<{ titre: string; type: string; description: string; arguments: string }>();
  private service = inject(ControleInterneService);
  private toast = inject(ToastService);
  private tabSave = inject(TabSaveService);
  private confirm = inject(ConfirmService);

  processOk: { description: string; raison: string }[] = [];
  processKo: { description: string; raison: string; risques: string }[] = [];
  outils: { nom: string; description: string }[] = [];
  noteGenerale = '';
  risques: { description: string; niveauRisque: 'FAIBLE' | 'MOYEN' | 'ELEVE' }[] = [];
  recommandations: { description: string; statut: 'A_SOUMETTRE' | 'SOUMIS' | 'ACCEPTE' | 'EN_COURS' | 'MIS_EN_OEUVRE' }[] = [];
  missionConseilPotentielle = false;

  ngOnInit() { this.tabSave.register(() => this.save()); this.load(); }

  ngOnDestroy() { this.tabSave.clear(); }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['exerciceId'] || changes['clientId']) && this.clientId != null && this.exerciceId != null) {
      this.load();
    }
  }

  private load() {
    if (!this.clientId || this.exerciceId == null) return;
    this.service.get(this.clientId, this.exerciceId).subscribe(data => {
      if (data) {
        this.processOk = data.processOk || [];
        this.processKo = data.processDefaillants || [];
        this.outils = data.outilsPilotage || [];
        this.noteGenerale = data.noteGenerale || '';
        this.risques = data.risquesIdentifies || [];
        this.recommandations = data.recommandations || [];
        this.missionConseilPotentielle = data.missionConseilPotentielle ?? false;
      }
    });
  }

  addProcessOk() { this.processOk.push({ description: '', raison: '' }); }
  removeProcessOk(i: number) {
    this.confirm.confirm('Supprimer ce process ?').subscribe(ok => { if (ok) { this.processOk.splice(i, 1); this.save(true); } });
  }

  addProcessKo() { this.processKo.push({ description: '', raison: '', risques: '' }); }
  removeProcessKo(i: number) {
    this.confirm.confirm('Supprimer ce process défaillant ?').subscribe(ok => { if (ok) { this.processKo.splice(i, 1); this.save(true); } });
  }

  addOutil() { this.outils.push({ nom: '', description: '' }); }
  removeOutil(i: number) {
    this.confirm.confirm('Supprimer cet outil ?').subscribe(ok => { if (ok) { this.outils.splice(i, 1); this.save(true); } });
  }

  addRisque() { this.risques.push({ description: '', niveauRisque: 'MOYEN' }); }
  removeRisque(i: number) {
    this.confirm.confirm('Supprimer ce risque ?').subscribe(ok => { if (ok) { this.risques.splice(i, 1); this.save(true); } });
  }

  get recommandationsValidees() {
    return this.recommandations.filter(r => r.statut === 'ACCEPTE' || r.statut === 'EN_COURS' || r.statut === 'MIS_EN_OEUVRE');
  }

  envoyerVersObjectifs() {
    const texts = this.recommandationsValidees.map(r => r.description).filter(d => d.trim());
    if (!texts.length) return;
    this.exporterReco.emit(texts);
    this.toast.success(`${texts.length} recommandation${texts.length > 1 ? 's' : ''} envoyée${texts.length > 1 ? 's' : ''} vers les Objectifs`);
    this.navigateTo.emit('objectifs');
  }

  lancerCreationMission() {
    const descParts: string[] = [];
    if (this.noteGenerale?.trim()) descParts.push(this.noteGenerale.trim());
    else if (this.risques.length) {
      descParts.push('Risques identifiés :\n' + this.risques.map(r => `- [${r.niveauRisque}] ${r.description}`).join('\n'));
    }
    const argsValides = this.recommandationsValidees.map(r => r.description).filter(d => d.trim());
    const prefill = {
      titre: 'Mission de conseil en contrôle interne',
      type: 'DETECTEE',
      description: descParts.join('\n\n'),
      arguments: argsValides.join('\n'),
    };
    this.creerMissionCI.emit(prefill);
    this.navigateTo.emit('missions');
  }

  addRecommandation() { this.recommandations.push({ description: '', statut: 'A_SOUMETTRE' }); }
  removeRecommandation(i: number) {
    this.confirm.confirm('Supprimer cette recommandation ?').subscribe(ok => { if (ok) { this.recommandations.splice(i, 1); this.save(true); } });
  }

  save(silent = false) {
    if (this.readonly) return;
    this.service.save(this.clientId, this.exerciceId, {
      processOk: this.processOk,
      processDefaillants: this.processKo,
      outilsPilotage: this.outils,
      noteGenerale: this.noteGenerale,
      risquesIdentifies: this.risques,
      recommandations: this.recommandations,
      missionConseilPotentielle: this.missionConseilPotentielle,
    }).subscribe(() => {
      if (!silent) this.toast.success('Contrôle interne enregistré');
    });
  }
}
