import { Component, Input, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
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
      <div class="tab-header">
        <h2>Objectifs & Relation client</h2>
        <button mat-flat-button color="primary" (click)="save()" [disabled]="readonly">
          <mat-icon>save</mat-icon> {{ readonly ? 'Lecture seule' : 'Enregistrer' }}
        </button>
      </div>

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
    </div>
  `,
  styles: [`
    :host { display: block; padding: 24px; }

    .tab-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 28px;
    }
    .tab-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }

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
  `],
})
export class ObjectifsTabComponent implements OnInit, OnChanges {
  @Input() clientId!: number;
  @Input() exerciceId!: number;
  @Input() readonly = false;
  private fb = inject(FormBuilder);
  private service = inject(ObjectifsService);
  private toast = inject(ToastService);

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

  ngOnInit() { this.load(); }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['exerciceId'] || changes['clientId']) && this.clientId != null && this.exerciceId != null) {
      this.load();
    }
  }

  private load() {
    if (!this.clientId || this.exerciceId == null) return;
    this.service.get(this.clientId, this.exerciceId).subscribe(data => {
      if (data) this.form.patchValue(data);
    });
  }

  save() {
    if (this.readonly) return;
    this.service.save(this.clientId, this.exerciceId, this.form.value).subscribe(() => {
      this.toast.success('Objectifs enregistrés');
    });
  }
}
