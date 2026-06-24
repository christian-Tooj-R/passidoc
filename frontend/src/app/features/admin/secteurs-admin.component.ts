import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SecteurService } from '../../core/services/secteur.service';
import { ToastService } from '../../core/services/toast.service';
import { Secteur, SecteurQuestion } from '../../core/models/secteur.model';

@Component({
  selector: 'app-secteurs-admin',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatTooltipModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-header__left">
          <mat-icon class="page-icon">category</mat-icon>
          <div>
            <h1>Secteurs d'activité</h1>
            <p>Gérez les secteurs, leurs codes NAF et leurs questions spécifiques</p>
          </div>
        </div>
        <div class="page-header__right">
          <button mat-stroked-button (click)="syncAll()" [disabled]="syncing()">
            <mat-icon>sync</mat-icon>
            {{ syncing() ? 'Sync...' : 'Sync NAF (tous)' }}
          </button>
          <button mat-flat-button color="primary" (click)="openCreate()">
            <mat-icon>add</mat-icon> Nouveau secteur
          </button>
        </div>
      </div>

      <!-- ── Grille des secteurs ── -->
      @if (loading()) {
        <div class="loading-wrap">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else {
        <div class="secteurs-grid">
          @for (s of secteurs(); track s.id) {
            <div class="secteur-card" [class.inactive]="!s.isActive">

              <div class="sc-header">
                <div class="sc-icon">
                  <mat-icon>{{ s.icon || 'business' }}</mat-icon>
                </div>
                <div class="sc-info">
                  <span class="sc-label">{{ s.label }}</span>
                  <span class="sc-code">{{ s.code }}</span>
                </div>
                <div class="sc-actions">
                  <button mat-icon-button (click)="editSecteur(s)" matTooltip="Modifier">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button (click)="syncOneNaf(s)" matTooltip="Sync NAF">
                    <mat-icon>sync</mat-icon>
                  </button>
                  @if (s.isActive) {
                    <button mat-icon-button (click)="toggleActive(s)" matTooltip="Désactiver" class="btn-danger">
                      <mat-icon>visibility_off</mat-icon>
                    </button>
                  } @else {
                    <button mat-icon-button (click)="toggleActive(s)" matTooltip="Réactiver">
                      <mat-icon>visibility</mat-icon>
                    </button>
                  }
                </div>
              </div>

              <div class="sc-naf">
                @if (s.codeNaf) {
                  <span class="naf-badge">{{ s.codeNaf }}</span>
                  @if (s.codeNafLibelle) {
                    <span class="naf-libelle">{{ s.codeNafLibelle }}</span>
                  }
                } @else {
                  <span class="naf-empty">Aucun code NAF</span>
                }
              </div>

              <div class="sc-questions">
                <span class="q-count">
                  <mat-icon>quiz</mat-icon>
                  {{ (s.questions || []).length }} question(s) personnalisée(s)
                </span>
                <button mat-button class="q-manage-btn" (click)="manageQuestions(s)">
                  Gérer
                </button>
              </div>

            </div>
          }
        </div>
      }

      <!-- ── Modal création/édition ── -->
      @if (showForm()) {
        <div class="modal-backdrop" (click)="closeForm()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ editingId() ? 'Modifier' : 'Nouveau' }} secteur</h2>
              <button mat-icon-button (click)="closeForm()"><mat-icon>close</mat-icon></button>
            </div>
            <form [formGroup]="form" class="modal-body" (ngSubmit)="saveForm()">
              <mat-form-field appearance="outline" class="full">
                <mat-label>Code unique (ex: RESTAURATION)</mat-label>
                <input matInput formControlName="code" [readonly]="!!editingId()"
                       placeholder="Majuscules, sans espace" />
                <mat-hint>Non modifiable après création</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Libellé affiché</mat-label>
                <input matInput formControlName="label" placeholder="Ex: BTP" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Icône Material (nom)</mat-label>
                <mat-icon matPrefix>{{ form.value.icon || 'business' }}</mat-icon>
                <input matInput formControlName="icon"
                       placeholder="Ex: restaurant, construction, apartment..." />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Code NAF/APE (ex: 56.10A)</mat-label>
                <input matInput formControlName="codeNaf" placeholder="XX.XXX" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Libellé NAF (optionnel, auto-rempli par sync)</mat-label>
                <input matInput formControlName="codeNafLibelle" />
              </mat-form-field>

              <div class="modal-footer">
                <button mat-button type="button" (click)="closeForm()">Annuler</button>
                <button mat-flat-button color="primary" type="submit"
                        [disabled]="form.invalid || saving()">
                  {{ saving() ? 'Enregistrement...' : 'Enregistrer' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ── Modal gestion des questions ── -->
      @if (showQuestions()) {
        <div class="modal-backdrop" (click)="closeQuestions()">
          <div class="modal modal--wide" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>Questions — {{ editingSecteur()?.label }}</h2>
              <button mat-icon-button (click)="closeQuestions()"><mat-icon>close</mat-icon></button>
            </div>
            <div class="modal-body">
              <p class="q-hint">
                Ces questions s'affichent dans le questionnaire sectoriel du wizard de création de dossier
                pour les dossiers ayant ce secteur d'activité.
              </p>

              @for (q of editingQuestions(); track q.id; let i = $index) {
                <div class="q-row">
                  <div class="q-row__main">
                    <span class="q-type-badge q-type-badge--{{ q.type }}">{{ q.type }}</span>
                    <span class="q-row__label">{{ q.label }}</span>
                    @if (q.section) { <span class="q-row__section">§ {{ q.section }}</span> }
                  </div>
                  <div class="q-row__actions">
                    <button mat-icon-button (click)="editQuestion(i)"><mat-icon>edit</mat-icon></button>
                    <button mat-icon-button class="btn-danger" (click)="removeQuestion(i)"><mat-icon>delete</mat-icon></button>
                  </div>
                </div>
              }

              @if (editingQuestions().length === 0) {
                <div class="q-empty">
                  <mat-icon>quiz</mat-icon>
                  <p>Aucune question personnalisée pour ce secteur</p>
                </div>
              }

              <!-- Formulaire ajout rapide -->
              <div class="q-add-form">
                <h4>Ajouter une question</h4>
                <div class="q-add-row">
                  <mat-form-field appearance="outline" class="q-add-label">
                    <mat-label>Libellé de la question</mat-label>
                    <input matInput [(ngModel)]="newQuestion.label" />
                  </mat-form-field>
                  <select class="q-type-select" [(ngModel)]="newQuestion.type">
                    <option value="text">Texte court</option>
                    <option value="textarea">Texte long</option>
                    <option value="radio">Choix unique</option>
                    <option value="multiselect">Choix multiple</option>
                    <option value="number">Nombre</option>
                  </select>
                  <mat-form-field appearance="outline" class="q-add-section">
                    <mat-label>Section (optionnel)</mat-label>
                    <input matInput [(ngModel)]="newQuestion.section" placeholder="Ex: I — Localisation" />
                  </mat-form-field>
                </div>
                @if (newQuestion.type === 'radio' || newQuestion.type === 'multiselect') {
                  <mat-form-field appearance="outline" class="full">
                    <mat-label>Options (une par ligne : VALEUR|Libellé)</mat-label>
                    <textarea matInput rows="3" [(ngModel)]="newQuestionOptions"
                      placeholder="OPTION_A|Libellé A&#10;OPTION_B|Libellé B"></textarea>
                  </mat-form-field>
                }
                <button mat-stroked-button (click)="addQuestion()" [disabled]="!newQuestion.label">
                  <mat-icon>add</mat-icon> Ajouter
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button mat-button (click)="closeQuestions()">Fermer</button>
              <button mat-flat-button color="primary" (click)="saveQuestions()" [disabled]="savingQuestions()">
                {{ savingQuestions() ? 'Enregistrement...' : 'Enregistrer les questions' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 28px; max-width: 1200px; margin: 0 auto; }

    /* ── Header ── */
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 28px; gap: 16px;
    }
    .page-header__left { display: flex; align-items: center; gap: 14px; }
    .page-icon { font-size: 32px; width: 32px; height: 32px; color: #6366f1; }
    .page-header h1 { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
    .page-header p { font-size: 13px; color: #64748b; margin: 2px 0 0; }
    .page-header__right { display: flex; gap: 10px; align-items: center; }

    /* ── Grid ── */
    .secteurs-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .loading-wrap { display: flex; justify-content: center; padding: 60px; }

    /* ── Secteur card ── */
    .secteur-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
      padding: 18px; transition: box-shadow .2s;
    }
    .secteur-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); }
    .secteur-card.inactive { opacity: .55; border-style: dashed; }

    .sc-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .sc-icon {
      width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
      background: #e0e7ff; display: flex; align-items: center; justify-content: center;
    }
    .sc-icon mat-icon { color: #4f46e5; font-size: 20px; width: 20px; height: 20px; }
    .sc-info { flex: 1; min-width: 0; }
    .sc-label { display: block; font-size: 13.5px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sc-code { display: block; font-size: 11px; color: #94a3b8; font-family: monospace; }
    .sc-actions { display: flex; gap: 2px; flex-shrink: 0; }

    .sc-naf {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 8px 10px; background: #f8fafc; border-radius: 8px; margin-bottom: 10px;
      min-height: 36px;
    }
    .naf-badge { font-size: 12px; font-weight: 700; color: #1565C0; background: #e8f0fe; padding: 2px 8px; border-radius: 20px; }
    .naf-libelle { font-size: 12px; color: #475569; }
    .naf-empty { font-size: 12px; color: #94a3b8; font-style: italic; }

    .sc-questions { display: flex; align-items: center; justify-content: space-between; }
    .q-count { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
    .q-count mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .q-manage-btn { font-size: 12px !important; padding: 0 10px !important; height: 28px !important; color: #4f46e5 !important; }

    .btn-danger { color: #dc2626 !important; }

    /* ── Modal ── */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal {
      background: #fff; border-radius: 20px; width: 90vw; max-width: 500px;
      max-height: 90vh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
    }
    .modal--wide { max-width: 720px; }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 0; margin-bottom: 4px;
    }
    .modal-header h2 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
    .modal-body { padding: 16px 24px; display: flex; flex-direction: column; gap: 4px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 24px 20px; }
    .full { width: 100%; }

    /* ── Questions ── */
    .q-hint { font-size: 12.5px; color: #64748b; margin-bottom: 12px; line-height: 1.5; }
    .q-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 10px;
      margin-bottom: 6px; gap: 12px;
    }
    .q-row__main { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .q-row__label { font-size: 13px; font-weight: 500; color: #1e293b; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .q-row__section { font-size: 11px; color: #94a3b8; flex-shrink: 0; }
    .q-row__actions { display: flex; gap: 2px; flex-shrink: 0; }
    .q-type-badge {
      font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px;
      flex-shrink: 0;
    }
    .q-type-badge--text, .q-type-badge--textarea { background: #f0fdf4; color: #166534; }
    .q-type-badge--radio { background: #eff6ff; color: #1d4ed8; }
    .q-type-badge--multiselect { background: #fdf4ff; color: #7e22ce; }
    .q-type-badge--number { background: #fff7ed; color: #c2410c; }
    .q-empty { text-align: center; padding: 24px; color: #94a3b8; }
    .q-empty mat-icon { font-size: 32px; width: 32px; height: 32px; display: block; margin: 0 auto 8px; }

    .q-add-form { background: #f8fafc; border-radius: 12px; padding: 16px; margin-top: 16px; }
    .q-add-form h4 { font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 12px; }
    .q-add-row { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
    .q-add-label { flex: 2; min-width: 200px; }
    .q-add-section { flex: 1; min-width: 160px; }
    .q-type-select {
      height: 56px; border: 1px solid #cbd5e1; border-radius: 4px;
      padding: 0 12px; font-size: 14px; background: #fff; cursor: pointer;
    }
  `],
})
export class SecteursAdminComponent implements OnInit {
  private service = inject(SecteurService);
  private toast   = inject(ToastService);
  private fb      = inject(FormBuilder);

  secteurs  = signal<Secteur[]>([]);
  loading   = signal(true);
  syncing   = signal(false);
  saving    = signal(false);
  showForm  = signal(false);
  editingId = signal<number | null>(null);

  showQuestions    = signal(false);
  editingSecteur   = signal<Secteur | null>(null);
  editingQuestions = signal<SecteurQuestion[]>([]);
  savingQuestions  = signal(false);

  newQuestion: Partial<SecteurQuestion> & { type: SecteurQuestion['type'] } = { type: 'text', label: '', section: '' };
  newQuestionOptions = '';

  form = this.fb.group({
    code:           ['', Validators.required],
    label:          ['', Validators.required],
    icon:           [''],
    codeNaf:        [''],
    codeNafLibelle: [''],
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.service.getAll(true).subscribe({ next: list => { this.secteurs.set(list); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ code: '', label: '', icon: '', codeNaf: '', codeNafLibelle: '' });
    this.form.get('code')!.enable();
    this.showForm.set(true);
  }

  editSecteur(s: Secteur) {
    this.editingId.set(s.id);
    this.form.patchValue({ code: s.code, label: s.label, icon: s.icon, codeNaf: s.codeNaf ?? '', codeNafLibelle: s.codeNafLibelle ?? '' });
    this.form.get('code')!.disable();
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); }

  saveForm() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const dto = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, v ?? undefined])
    ) as Partial<Secteur>;
    const obs = this.editingId()
      ? this.service.update(this.editingId()!, dto)
      : this.service.create(dto);
    obs.subscribe({
      next: () => { this.toast.success('Secteur enregistré'); this.closeForm(); this.load(); this.saving.set(false); },
      error: () => this.saving.set(false),
    });
  }

  toggleActive(s: Secteur) {
    if (s.isActive) {
      this.service.delete(s.id).subscribe(() => { this.toast.success('Secteur désactivé'); this.load(); });
    } else {
      this.service.update(s.id, { isActive: true }).subscribe(() => { this.toast.success('Secteur réactivé'); this.load(); });
    }
  }

  syncOneNaf(s: Secteur) {
    this.service.syncNaf(s.id).subscribe(updated => {
      this.secteurs.update(list => list.map(x => x.id === updated.id ? updated : x));
      this.toast.success(`NAF synchronisé : ${updated.codeNafLibelle || '(aucun libellé trouvé)'}`);
    });
  }

  syncAll() {
    this.syncing.set(true);
    this.service.syncAll().subscribe({
      next: ({ synced, errors }) => { this.toast.success(`${synced} secteur(s) synchronisé(s), ${errors} erreur(s)`); this.load(); this.syncing.set(false); },
      error: () => this.syncing.set(false),
    });
  }

  manageQuestions(s: Secteur) {
    this.editingSecteur.set(s);
    this.editingQuestions.set(JSON.parse(JSON.stringify(s.questions ?? [])));
    this.showQuestions.set(true);
    this.newQuestion = { type: 'text', label: '', section: '' };
    this.newQuestionOptions = '';
  }

  closeQuestions() { this.showQuestions.set(false); }

  addQuestion() {
    if (!this.newQuestion.label) return;
    const id = `q_${Date.now()}`;
    const q: SecteurQuestion = {
      id,
      label:   this.newQuestion.label!,
      type:    this.newQuestion.type,
      section: this.newQuestion.section || undefined,
    };
    if ((q.type === 'radio' || q.type === 'multiselect') && this.newQuestionOptions.trim()) {
      q.options = this.newQuestionOptions.trim().split('\n').map(line => {
        const [value, ...rest] = line.split('|');
        return { value: value.trim(), label: rest.join('|').trim() || value.trim() };
      });
    }
    this.editingQuestions.update(list => [...list, q]);
    this.newQuestion = { type: 'text', label: '', section: '' };
    this.newQuestionOptions = '';
  }

  editQuestion(i: number) {
    // future: open inline edit form
    const q = this.editingQuestions()[i];
    this.newQuestion = { ...q };
    this.newQuestionOptions = q.options?.map(o => `${o.value}|${o.label}`).join('\n') ?? '';
    this.editingQuestions.update(list => list.filter((_, idx) => idx !== i));
  }

  removeQuestion(i: number) {
    this.editingQuestions.update(list => list.filter((_, idx) => idx !== i));
  }

  saveQuestions() {
    const s = this.editingSecteur();
    if (!s) return;
    this.savingQuestions.set(true);
    this.service.update(s.id, { questions: this.editingQuestions() }).subscribe({
      next: updated => {
        this.secteurs.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.toast.success('Questions enregistrées');
        this.closeQuestions();
        this.savingQuestions.set(false);
      },
      error: () => this.savingQuestions.set(false),
    });
  }
}
