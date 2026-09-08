import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TabSaveService } from '../../../../../core/services/tab-save.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ObjectifsService } from '../../../../../core/services/objectifs.service';

@Component({
  selector: 'app-objectifs-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="tab">

      @if (!editMode()) {
        <!-- ── Vue lecture ───────────────────────────────── -->
        <div class="section-title"><mat-icon>flag</mat-icon> Objectifs du client</div>
        <div class="objectives-grid">
          <div class="objective-card">
            <div class="objective-card__header objective-card__header--blue">
              <mat-icon>calendar_today</mat-icon><span>Dans les 12 prochains mois</span>
            </div>
            <div class="card-body"><p class="read-text">{{ form.get('objectifs12mois')?.value || '—' }}</p></div>
          </div>
          <div class="objective-card">
            <div class="objective-card__header objective-card__header--indigo">
              <mat-icon>timeline</mat-icon><span>Dans les 3 à 5 ans</span>
            </div>
            <div class="card-body"><p class="read-text">{{ form.get('objectifs3a5ans')?.value || '—' }}</p></div>
          </div>
          <div class="objective-card">
            <div class="objective-card__header objective-card__header--purple">
              <mat-icon>rocket_launch</mat-icon><span>Au-delà</span>
            </div>
            <div class="card-body"><p class="read-text">{{ form.get('objectifsLongTerme')?.value || '—' }}</p></div>
          </div>
        </div>

        <div class="section-title" style="margin-top:12px"><mat-icon>handshake</mat-icon> Mission de l'expert-comptable</div>
        <div class="read-row">
          <div class="read-field"><span class="read-label">Client chez AFYM depuis</span><span class="read-value">{{ form.get('depuisQuand')?.value || '—' }}</span></div>
          <div class="read-field"><span class="read-label">Qualité de la relation</span><span class="read-value">{{ form.get('qualiteRelation')?.value || '—' }}</span></div>
        </div>
        <div class="read-field full"><span class="read-label">Ce qu'attend le client</span><p class="read-text">{{ form.get('attentesClient')?.value || '—' }}</p></div>
        <div class="read-field full"><span class="read-label">Axes d'amélioration</span><p class="read-text">{{ form.get('axesAmelioration')?.value || '—' }}</p></div>
        <div class="read-field full"><span class="read-label">Recommandations faites</span><p class="read-text">{{ form.get('recommandationsFaites')?.value || '—' }}</p></div>

        <div class="section-title" style="margin-top:12px"><mat-icon>groups</mat-icon> Qualité de la relation par pôle</div>
        <div class="read-row">
          <div class="read-field"><span class="read-label">Collaborateur en charge</span><p class="read-text">{{ form.get('relationCollaborateur')?.value || '—' }}</p></div>
          <div class="read-field"><span class="read-label">Pôle social</span><p class="read-text">{{ form.get('relationPoleSocial')?.value || '—' }}</p></div>
          <div class="read-field"><span class="read-label">Pôle juridique</span><p class="read-text">{{ form.get('relationPoleJuridique')?.value || '—' }}</p></div>
          <div class="read-field"><span class="read-label">Directeur / EC</span><p class="read-text">{{ form.get('relationDirecteur')?.value || '—' }}</p></div>
        </div>

      } @else {
        <!-- ── Vue édition ──────────────────────────────── -->
        <form [formGroup]="form" class="tab-form">
          <!-- Objectifs -->
          <div class="section-title"><mat-icon>flag</mat-icon> Objectifs du client</div>
          <div class="objectives-grid">
            <div class="objective-card">
              <div class="objective-card__header objective-card__header--blue">
                <mat-icon>calendar_today</mat-icon>
                <span>Dans les 12 prochains mois</span>
              </div>
              <div class="card-body">
                <mat-form-field appearance="outline" class="full-width">
                  <textarea matInput rows="4" formControlName="objectifs12mois"
                    placeholder="Ex: Acheter les locaux commerciaux..."></textarea>
                </mat-form-field>
              </div>
            </div>
            <div class="objective-card">
              <div class="objective-card__header objective-card__header--indigo">
                <mat-icon>timeline</mat-icon>
                <span>Dans les 3 à 5 ans</span>
              </div>
              <div class="card-body">
                <mat-form-field appearance="outline" class="full-width">
                  <textarea matInput rows="4" formControlName="objectifs3a5ans"
                    placeholder="Ex: Structurer via une holding..."></textarea>
                </mat-form-field>
              </div>
            </div>
            <div class="objective-card">
              <div class="objective-card__header objective-card__header--purple">
                <mat-icon>rocket_launch</mat-icon>
                <span>Au-delà</span>
              </div>
              <div class="card-body">
                <mat-form-field appearance="outline" class="full-width">
                  <textarea matInput rows="4" formControlName="objectifsLongTerme"
                    placeholder="Vision long terme..."></textarea>
                </mat-form-field>
              </div>
            </div>
          </div>

          <!-- Mission EC -->
          <div class="section-title" style="margin-top:12px"><mat-icon>handshake</mat-icon> Mission de l'expert-comptable</div>
          <div class="ec-grid">
            <mat-form-field appearance="outline">
              <mat-label>Client chez AFYM depuis</mat-label>
              <input matInput formControlName="depuisQuand" placeholder="Ex: Création en 2023" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Qualité de la relation</mat-label>
              <input matInput formControlName="qualiteRelation" placeholder="Ex: Très bonne, le client recommande..." />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Ce qu'attend le client de l'expert-comptable</mat-label>
            <textarea matInput rows="4" formControlName="attentesClient"
              placeholder="Ex: Sécurisation des obligations fiscales, accompagnement stratégique..."></textarea>
          </mat-form-field>
          @if (recommandationsCIImportees.length > 0) {
            <div class="ci-import-banner">
              <mat-icon>recommend</mat-icon>
              <div class="ci-import-banner__text">
                <strong>{{ recommandationsCIImportees.length }} recommandation{{ recommandationsCIImportees.length > 1 ? 's' : '' }} CI disponible{{ recommandationsCIImportees.length > 1 ? 's' : '' }}</strong>
                <span>Depuis le Contrôle interne — acceptées ou en cours</span>
              </div>
              <button class="ci-import-btn" type="button" (click)="integrerRecommandations()">
                <mat-icon>merge_type</mat-icon> Intégrer dans les axes d'amélioration
              </button>
            </div>
          }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Axes d'amélioration</mat-label>
            <textarea matInput rows="3" formControlName="axesAmelioration"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Recommandations faites</mat-label>
            <textarea matInput rows="2" formControlName="recommandationsFaites"
              placeholder="Ex: A recommandé nos services à son frère..."></textarea>
          </mat-form-field>

          <!-- Relation par pôle -->
          <div class="section-title" style="margin-top:12px"><mat-icon>groups</mat-icon> Qualité de la relation par pôle</div>
          <div class="ec-grid">
            <mat-form-field appearance="outline">
              <mat-label>Avec le collaborateur en charge</mat-label>
              <textarea matInput rows="2" formControlName="relationCollaborateur"
                placeholder="Ex: Relation de confiance, échanges réguliers..."></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Avec le pôle social</mat-label>
              <textarea matInput rows="2" formControlName="relationPoleSocial"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Avec le pôle juridique</mat-label>
              <textarea matInput rows="2" formControlName="relationPoleJuridique"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Avec le directeur d'antenne / l'EC</mat-label>
              <textarea matInput rows="2" formControlName="relationDirecteur"></textarea>
            </mat-form-field>
          </div>
        </form>
      }
    </div>
  `,
  styles: [`
    :host { display: block; padding: 24px; }

    /* ── Read view ─────────────────────────────────── */
    .read-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; margin-bottom: 8px; }
    .read-field { display: flex; flex-direction: column; gap: 3px; padding: 8px 0; }
    .read-field.full { width: 100%; }
    .read-label { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .read-value { font-size: 0.88rem; color: #1e293b; }
    .read-text { font-size: 0.85rem; color: #374151; line-height: 1.7; white-space: pre-line; margin: 2px 0 0; }

    .tab-form { display: flex; flex-direction: column; gap: 0; }

    /* ── Section titles ─────────────────────────────── */
    .section-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; font-weight: 700; color: #1e293b;
      margin: 0 0 16px;
      padding: 10px 14px;
      background: #F4F6FB; border-radius: 10px;
      border-left: 3px solid #6366f1;
    }
    .section-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: #6366f1; }

    /* ── Objectives grid ────────────────────────────── */
    .objectives-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 16px; margin-bottom: 28px;
    }
    .objective-card {
      border-radius: 12px; overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0,0,0,.04);
    }
    .objective-card__header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px; font-size: 13px; font-weight: 600;
    }
    .objective-card__header mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .objective-card__header--blue   { background: #dbeafe; color: #1d4ed8; }
    .objective-card__header--indigo { background: #e0e7ff; color: #4338ca; }
    .objective-card__header--purple { background: #f3e8ff; color: #7c3aed; }
    .card-body { padding: 16px 16px 4px; }
    .objective-card mat-form-field { width: 100%; }

    /* ── EC / Relation grids ────────────────────────── */
    .ec-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 0 20px; margin-bottom: 0;
    }
    .ec-grid mat-form-field { width: 100%; }

    .full-width { width: 100%; }

    /* ── Bannière import CI ─────────────────────────── */
    .ci-import-banner {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      padding: 12px 16px; margin-bottom: 8px;
      background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px;
      mat-icon { color: #16a34a; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    }
    .ci-import-banner__text {
      display: flex; flex-direction: column; gap: 2px; flex: 1;
      strong { font-size: 13px; font-weight: 700; color: #15803d; }
      span { font-size: 11px; color: #4ade80; color: #166534; }
    }
    .ci-import-btn {
      display: flex; align-items: center; gap: 6px; padding: 6px 14px;
      background: #16a34a; color: white; border: none; border-radius: 8px;
      cursor: pointer; font-size: 12px; font-weight: 700; font-family: inherit;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #15803d; }
    }
  `],
})
export class ObjectifsTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() clientId!: number;
  @Input() exerciceId!: number;
  @Input() readonly = false;
  @Input() recommandationsCIImportees: string[] = [];
  @Output() recommandationsIntegrees = new EventEmitter<void>();
  private fb = inject(FormBuilder);
  private service = inject(ObjectifsService);
  private toast = inject(ToastService);
  private tabSave = inject(TabSaveService);

  editMode = signal(false);
  private _snapshot: any = null;

  form = this.fb.group({
    objectifs12mois: [''],
    objectifs3a5ans: [''],
    objectifsLongTerme: [''],
    attentesClient: [''],
    depuisQuand: [''],
    qualiteRelation: [''],
    axesAmelioration: [''],
    recommandationsFaites: [''],
    relationCollaborateur: [''],
    relationPoleSocial: [''],
    relationPoleJuridique: [''],
    relationDirecteur: [''],
  });

  ngOnInit() {
    this.tabSave.registerEditMode(
      () => this.enterEdit(),
      () => this.save(),
      () => this.cancelEdit()
    );
    this.load();
  }

  ngOnDestroy() { this.tabSave.clear(); }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['exerciceId'] || changes['clientId']) && this.clientId != null && this.exerciceId != null) {
      this.editMode.set(false);
      this.tabSave.setEditing(false);
      this.load();
    }
  }

  private load() {
    if (!this.clientId || this.exerciceId == null) return;
    this.service.get(this.clientId, this.exerciceId).subscribe(data => {
      if (data) this.form.patchValue(data);
    });
  }

  enterEdit() {
    this._snapshot = this.form.getRawValue();
    this.editMode.set(true);
    this.tabSave.setEditing(true);
  }

  cancelEdit() {
    if (this._snapshot) this.form.patchValue(this._snapshot);
    this.editMode.set(false);
    this.tabSave.setEditing(false);
  }

  integrerRecommandations() {
    if (!this.editMode()) this.enterEdit();
    const existant = this.form.get('axesAmelioration')?.value ?? '';
    const nouvelles = this.recommandationsCIImportees.map((r, i) => `${i + 1}. ${r}`).join('\n');
    const valeur = existant.trim() ? `${existant.trim()}\n\n--- Recommandations CI ---\n${nouvelles}` : nouvelles;
    this.form.get('axesAmelioration')?.setValue(valeur);
    this.form.markAsDirty();
    this.recommandationsIntegrees.emit();
  }

  save() {
    if (this.readonly) return;
    this.service.save(this.clientId, this.exerciceId, this.form.value).subscribe(() => {
      this.toast.success('Objectifs enregistrés');
      this.editMode.set(false);
      this.tabSave.setEditing(false);
    });
  }
}
