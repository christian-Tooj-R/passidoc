import { Component, inject, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError, takeUntil } from 'rxjs';
import { PappersService, PappersResult } from '../../../core/services/pappers.service';
import { SecteurActivite, SECTEURS_LABELS } from '../../../core/models/client.model';

@Component({
  selector: 'app-create-client-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog">
      <div class="dialog-header">
        <div class="dialog-header__icon"><mat-icon>folder_shared</mat-icon></div>
        <div>
          <h2>Nouveau dossier client</h2>
          <p>Recherchez l'entreprise pour pré-remplir la fiche</p>
        </div>
      </div>

      <div class="dialog-body">

        <!-- Recherche avec dropdown custom -->
        <div class="search-wrap">
          <div class="search-field" [class.search-field--focus]="dropdownOpen">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              #searchInput
              class="search-input"
              [formControl]="searchCtrl"
              placeholder="Nom d'entreprise ou SIREN…"
              autocomplete="off"
              (focus)="onFocus()"
              (blur)="onBlur()"
              (keydown.escape)="closeDropdown()"
              (keydown.arrowdown)="moveHighlight(1)"
              (keydown.arrowup)="moveHighlight(-1)"
              (keydown.enter)="confirmHighlight()" />
            @if (searching) {
              <mat-spinner class="search-spinner" diameter="18"></mat-spinner>
            } @else if (searchCtrl.value) {
              <button class="search-clear" (mousedown)="$event.preventDefault()" (click)="clearAll()">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>

          <!-- Dropdown des résultats -->
          @if (dropdownOpen && searchCtrl.value) {
            <div class="search-dropdown">

              @if (searching) {
                <div class="dropdown-loading">
                  <mat-spinner diameter="16"></mat-spinner>
                  <span>Recherche en cours…</span>
                </div>
              }

              @for (r of results; track r.siren; let i = $index) {
                <div class="dropdown-option"
                     [class.dropdown-option--highlighted]="highlightIndex === i"
                     (mousedown)="$event.preventDefault()"
                     (click)="onSelect(r)">
                  <div class="opt-left">
                    <div class="opt-initials">{{ r.nomEntreprise[0] }}</div>
                  </div>
                  <div class="opt-body">
                    <div class="opt-name" [innerHTML]="highlight(r.nomEntreprise)"></div>
                    <div class="opt-meta">
                      <span class="opt-siren">{{ r.siren }}</span>
                      @if (r.formeJuridique) {
                        <span class="opt-sep">·</span>
                        <span class="opt-forme">{{ r.formeJuridique }}</span>
                      }
                    </div>
                    @if (r.adresse) {
                      <div class="opt-addr">
                        <mat-icon>place</mat-icon>{{ r.adresse }}
                      </div>
                    }
                  </div>
                  <mat-icon class="opt-arrow">chevron_right</mat-icon>
                </div>
              }

              @if (!searching && hasSearched && results.length === 0) {
                <div class="dropdown-empty">
                  <mat-icon>search_off</mat-icon>
                  <span>Aucune entreprise trouvée pour « {{ searchCtrl.value }} »</span>
                </div>
              }

            </div>
          }
        </div>

        <!-- Aperçu de l'entreprise sélectionnée -->
        @if (selected) {
          <div class="preview-card">
            <div class="preview-header">
              <div class="preview-header__badge">
                <mat-icon>verified</mat-icon>
              </div>
              <div class="preview-header__text">
                <span class="preview-header__title">{{ selected.nomEntreprise }}</span>
                <span class="preview-header__siren">SIREN {{ selected.siren }}</span>
              </div>
              <button class="preview-clear" (click)="clearAll()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="preview-grid">
              <div class="preview-item">
                <label>Forme juridique</label>
                <span>{{ selected.formeJuridique || '—' }}</span>
              </div>
              <div class="preview-item">
                <label>SIRET siège</label>
                <span>{{ selected.siret || '—' }}</span>
              </div>
              <div class="preview-item full-span">
                <label>Adresse</label>
                <span>{{ selected.adresse || '—' }}</span>
              </div>
              @if (selected.dirigeants.length > 0) {
                <div class="preview-item full-span">
                  <label>Dirigeant(s)</label>
                  <span>{{ selected.dirigeants.map(d => d.prenom + ' ' + d.nom + ' (' + d.qualite + ')').join(' · ') }}</span>
                </div>
              }
            </div>
          </div>
        }

        <!-- Saisie manuelle si pas de sélection -->
        @if (!selected) {
          <mat-form-field appearance="outline" class="full">
            <mat-label>Nom du dossier (saisie manuelle)</mat-label>
            <mat-icon matPrefix>business</mat-icon>
            <input matInput [formControl]="nomManuelCtrl" placeholder="Nom si entreprise introuvable" />
          </mat-form-field>
        }

        <!-- Site -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>Site de rattachement</mat-label>
          <mat-icon matPrefix>location_on</mat-icon>
          <mat-select [formControl]="siteCtrl">
            <mat-option value="REUNION">🇷🇪 &nbsp;La Réunion</mat-option>
            <mat-option value="MADAGASCAR">🇲🇬 &nbsp;Madagascar</mat-option>
          </mat-select>
          @if (siteCtrl.touched && siteCtrl.hasError('required')) {
            <mat-error>Le site est requis</mat-error>
          }
        </mat-form-field>

        <!-- Secteur d'activité -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>Secteur d'activité (optionnel)</mat-label>
          <mat-icon matPrefix>category</mat-icon>
          <mat-select [formControl]="secteurCtrl">
            <mat-option [value]="null">— Non défini —</mat-option>
            @for (entry of secteurEntries; track entry.value) {
              <mat-option [value]="entry.value">{{ entry.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="dialog-actions">
        <button mat-stroked-button type="button" (click)="cancel()">Annuler</button>
        <button mat-flat-button class="btn-create" [disabled]="!canSubmit()" (click)="confirm()">
          <mat-icon>add</mat-icon> Créer le dossier
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog { width: 540px; max-width: 100%; }

    /* ── Header ── */
    .dialog-header { display: flex; align-items: center; gap: 16px; padding: 28px 28px 20px; border-bottom: 1px solid #f1f5f9; }
    .dialog-header__icon { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #1e40af, #3730a3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(30,64,175,.25); }
    .dialog-header__icon mat-icon { color: white; font-size: 24px; width: 24px; height: 24px; }
    .dialog-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
    .dialog-header p { font-size: 13px; color: #64748b; margin: 0; }

    .dialog-body { padding: 20px 28px; display: flex; flex-direction: column; gap: 12px; }
    .full { width: 100%; }

    /* ── Search field custom ── */
    .search-wrap { position: relative; }

    .search-field {
      display: flex; align-items: center; gap: 10px;
      background: white; border: 1.5px solid #e2e8f0;
      border-radius: 12px; padding: 0 12px;
      height: 52px;
      transition: border-color .15s, box-shadow .15s;
    }
    .search-field--focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99,102,241,.12);
    }
    .search-icon { color: #94a3b8; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .search-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 14px; font-weight: 500; color: #0f172a;
      font-family: inherit;
    }
    .search-input::placeholder { color: #94a3b8; font-weight: 400; }
    .search-spinner { flex-shrink: 0; }
    .search-clear {
      flex-shrink: 0; background: none; border: none; cursor: pointer;
      color: #94a3b8; padding: 4px; border-radius: 6px; display: flex;
      transition: color .12s, background .12s;
    }
    .search-clear:hover { color: #475569; background: #f1f5f9; }
    .search-clear mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* ── Dropdown ── */
    .search-dropdown {
      position: absolute; top: calc(100% + 6px); left: 0; right: 0;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06);
      overflow: hidden;
      z-index: 1000;
      max-height: 360px;
      overflow-y: auto;
    }

    .dropdown-loading {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 16px;
      font-size: 13px; color: #64748b;
    }

    .dropdown-option {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; cursor: pointer;
      transition: background .1s;
      border-bottom: 1px solid #f8fafc;
    }
    .dropdown-option:last-child { border-bottom: none; }
    .dropdown-option:hover, .dropdown-option--highlighted { background: #f5f3ff; }

    .opt-left { flex-shrink: 0; }
    .opt-initials {
      width: 38px; height: 38px; border-radius: 10px;
      background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
      color: #4338ca; font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      text-transform: uppercase;
    }

    .opt-body { flex: 1; min-width: 0; }
    .opt-name { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 3px; }
    .opt-name :global(mark) { background: #fef08a; color: #713f12; border-radius: 2px; padding: 0 1px; }
    .opt-meta { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }
    .opt-siren { font-size: 11px; font-weight: 700; color: #6366f1; background: #eef2ff; padding: 1px 7px; border-radius: 6px; }
    .opt-sep { color: #cbd5e1; font-size: 11px; }
    .opt-forme { font-size: 11px; color: #64748b; }
    .opt-addr {
      display: flex; align-items: center; gap: 3px;
      font-size: 11.5px; color: #94a3b8;
    }
    .opt-addr mat-icon { font-size: 12px; width: 12px; height: 12px; flex-shrink: 0; }
    .opt-arrow { color: #cbd5e1; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }

    .dropdown-empty {
      display: flex; align-items: center; gap: 8px;
      padding: 20px 16px; font-size: 13px; color: #94a3b8;
    }
    .dropdown-empty mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* ── Preview card ── */
    .preview-card {
      background: #f0fdf4; border: 1.5px solid #bbf7d0;
      border-radius: 14px; padding: 16px;
    }
    .preview-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .preview-header__badge {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      background: #dcfce7; display: flex; align-items: center; justify-content: center;
    }
    .preview-header__badge mat-icon { color: #16a34a; font-size: 20px; width: 20px; height: 20px; }
    .preview-header__text { flex: 1; min-width: 0; }
    .preview-header__title { display: block; font-size: 14px; font-weight: 700; color: #15803d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .preview-header__siren { font-size: 11px; color: #4ade80; font-weight: 600; }
    .preview-clear {
      background: none; border: none; cursor: pointer; color: #86efac;
      padding: 4px; border-radius: 6px; display: flex; transition: color .12s, background .12s;
    }
    .preview-clear:hover { color: #15803d; background: #dcfce7; }
    .preview-clear mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .preview-item { display: flex; flex-direction: column; gap: 2px; }
    .preview-item.full-span { grid-column: 1 / -1; }
    .preview-item label { font-size: 10px; font-weight: 700; color: #86efac; text-transform: uppercase; letter-spacing: 0.5px; }
    .preview-item span { font-size: 13px; color: #14532d; font-weight: 500; }

    /* ── Actions ── */
    .dialog-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: 16px 28px 24px; border-top: 1px solid #f1f5f9; }
    .btn-create { border-radius: 10px !important; font-weight: 600; background: linear-gradient(135deg, #1e40af, #3730a3) !important; display: flex; align-items: center; gap: 4px; }
    .btn-create mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class CreateClientDialogComponent implements OnInit, OnDestroy {
  private dialogRef = inject(MatDialogRef<CreateClientDialogComponent>);
  private pappers   = inject(PappersService);
  private elRef     = inject(ElementRef);
  private destroy$  = new Subject<void>();

  searchCtrl    = new FormControl('');
  nomManuelCtrl = new FormControl('');
  siteCtrl      = new FormControl('', Validators.required);
  secteurCtrl   = new FormControl<SecteurActivite | null>(null);

  readonly secteurEntries = (Object.keys(SECTEURS_LABELS) as SecteurActivite[])
    .map(v => ({ value: v, label: SECTEURS_LABELS[v] }));

  results: PappersResult[] = [];
  selected: PappersResult | null = null;
  searching     = false;
  hasSearched   = false;
  dropdownOpen  = false;
  highlightIndex = -1;

  private search$ = new Subject<string>();

  ngOnInit() {
    this.search$.pipe(
      debounceTime(180),
      distinctUntilChanged(),
      switchMap((q) => {
        if (!q || q.trim().length === 0) {
          this.results = [];
          this.hasSearched = false;
          return of([]);
        }
        this.searching = true;
        this.hasSearched = false;
        return this.pappers.search(q.trim()).pipe(catchError(() => of([])));
      }),
      takeUntil(this.destroy$),
    ).subscribe((res) => {
      this.searching = false;
      this.hasSearched = true;
      this.results = res;
      this.highlightIndex = -1;
    });

    this.searchCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      if (typeof v === 'string') this.search$.next(v);
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!this.elRef.nativeElement.contains(e.target)) this.closeDropdown();
  }

  onFocus()  { this.dropdownOpen = true; }
  onBlur()   { setTimeout(() => this.closeDropdown(), 150); }
  closeDropdown() { this.dropdownOpen = false; this.highlightIndex = -1; }

  moveHighlight(dir: number) {
    if (!this.results.length) return;
    this.highlightIndex = Math.max(0, Math.min(this.results.length - 1, this.highlightIndex + dir));
  }

  confirmHighlight() {
    if (this.highlightIndex >= 0 && this.results[this.highlightIndex]) {
      this.onSelect(this.results[this.highlightIndex]);
    }
  }

  highlight(text: string): string {
    const q = (this.searchCtrl.value ?? '').trim();
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(escaped, 'gi'), (m) => `<mark>${m}</mark>`);
  }

  onSelect(r: PappersResult) {
    this.selected = r;
    this.searchCtrl.setValue(r.nomEntreprise, { emitEvent: false });
    this.results = [];
    this.closeDropdown();
  }

  clearAll() {
    this.selected = null;
    this.searchCtrl.setValue('');
    this.results = [];
    this.hasSearched = false;
  }

  canSubmit(): boolean {
    if (!this.siteCtrl.value) return false;
    return !!(this.selected || this.nomManuelCtrl.value?.trim());
  }

  confirm() {
    if (!this.canSubmit()) return;
    this.dialogRef.close({
      nom: this.selected ? this.selected.nomEntreprise : this.nomManuelCtrl.value?.trim(),
      site: this.siteCtrl.value,
      secteurActivite: this.secteurCtrl.value ?? undefined,
      ficheData: this.selected ? {
        raisonSociale: this.selected.nomEntreprise,
        siren: this.selected.siren,
        siret: this.selected.siret,
        formeJuridique: this.selected.formeJuridique,
        adresse: this.selected.adresse,
        gerants: this.selected.dirigeants.map(d => ({
          nom: `${d.prenom} ${d.nom}`.trim(),
          qualite: d.qualite,
        })),
      } : null,
    });
  }

  cancel() { this.dialogRef.close(null); }
}
