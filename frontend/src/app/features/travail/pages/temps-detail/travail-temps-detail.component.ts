import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { Subject, takeUntil } from 'rxjs';
import { SaisieTempsService, LigneRapportDetail, MISSION_CODES } from '../../../../core/services/saisie-temps.service';
import { toLocalIso } from '../../../../core/services/date.util';
import { ClientsService } from '../../../../core/services/clients.service';
import { UsersService } from '../../../../core/services/users.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { Client } from '../../../../core/models/client.model';
import { User } from '../../../../core/models/user.model';
import { formatHeures } from '../../../../core/services/duree.util';
import { SaisieEditFormComponent, SaisieEditSeed, SaisieEditResult } from '../../shared/saisie-edit-form.component';
import {
  DIMENSIONS, Dimension, Groupe, LIBELLES_PRESENCE, REGROUPEMENT_TEMPOLIA, definirLibellesLieu,
  formatEuros, grouper, libelleDimension, libelleMission, recapitulatif, totaux, trierLignes,
} from '../../shared/rapport-temps.util';
import { EnteteRapport, exporterExcel, exporterPdf } from '../../shared/rapport-temps.export';

type Presence = LigneRapportDetail['presence'];
type Preset = 'annee' | 'annee-1' | 'mois' | 'mois-1' | '30j' | '12m' | '';

/**
 * « Détail des temps passés » — reproduction enrichie du rapport Tempolia utilisé par AFYM
 * (regroupements Présence > Client/TNF > Affaire, lignes de détail, sous-totaux Temps et
 * PV Col, récapitulatif général), avec regroupements au choix sur 3 niveaux, filtres
 * multiples, sections repliables et exports PDF / Excel.
 */
@Component({
  selector: 'app-travail-temps-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatDatepickerModule, MatSelectModule, SaisieEditFormComponent],
  template: `
<div class="page">

  <!-- ── En-tête ── -->
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon"><mat-icon>manage_search</mat-icon></div>
      <div>
        <h1 class="pg-title">Détail des temps passés</h1>
        <p class="pg-sub">{{ lignesVue().length }} ligne(s) · {{ periodeLibelle() }} · par {{ tenantSvc.nomSociete() }}</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn-export" (click)="exportExcel()" [disabled]="lignesVue().length === 0">
        <mat-icon>table_view</mat-icon> Excel
      </button>
      <button class="btn-export btn-export--pdf" (click)="exportPdf()" [disabled]="lignesVue().length === 0">
        <mat-icon>picture_as_pdf</mat-icon> PDF
      </button>
    </div>
  </div>

  <!-- ── Paramètres du rapport ── -->
  <div class="params">
    <div class="params__row">
      <div class="fb-field">
        <label class="fb-label">Période</label>
        <select class="fb-select" [(ngModel)]="preset" (ngModelChange)="appliquerPreset()">
          <option value="annee">Année en cours</option>
          <option value="annee-1">Année précédente</option>
          <option value="12m">12 derniers mois</option>
          <option value="mois">Mois en cours</option>
          <option value="mois-1">Mois précédent</option>
          <option value="30j">30 derniers jours</option>
          <option value="">Personnalisée</option>
        </select>
      </div>
      <div class="fb-field">
        <label class="fb-label">Du</label>
        <input type="date" class="fb-input" [(ngModel)]="dateDebut" (ngModelChange)="preset = ''" />
      </div>
      <div class="fb-field">
        <label class="fb-label">Au</label>
        <input type="date" class="fb-input" [(ngModel)]="dateFin" (ngModelChange)="preset = ''" />
      </div>
      <div class="fb-field">
        <label class="fb-label">&nbsp;</label>
        <button type="button" class="fb-cal-btn" matTooltip="Choisir une période sur un calendrier" (click)="rangePicker.open()">
          <mat-icon>calendar_month</mat-icon>
        </button>
        <mat-date-range-input class="fb-range-hidden" [rangePicker]="rangePicker">
          <input matStartDate [(ngModel)]="rangeStart" name="rangeStart" (dateChange)="onRangeChange()">
          <input matEndDate   [(ngModel)]="rangeEnd"   name="rangeEnd"   (dateChange)="onRangeChange()">
        </mat-date-range-input>
        <mat-date-range-picker #rangePicker></mat-date-range-picker>
      </div>
      @if (authSvc.isAdmin()) {
        <div class="fb-field fb-field--multi">
          <label class="fb-label">Collaborateurs</label>
          <mat-select class="fb-mselect" multiple [(ngModel)]="collaborateurIds" placeholder="Tous" panelClass="rt-panel">
            @for (u of usersTries(); track u.id) {
              <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
            }
          </mat-select>
        </div>
      }
      <div class="fb-field fb-field--multi">
        <label class="fb-label">Clients</label>
        <mat-select class="fb-mselect" multiple [(ngModel)]="clientIds" placeholder="Tous" panelClass="rt-panel"
                    (openedChange)="clientFiltre = ''">
          <div class="rt-search" (keydown)="$event.stopPropagation()">
            <input [(ngModel)]="clientFiltre" placeholder="Rechercher un client…" (click)="$event.stopPropagation()" />
          </div>
          @for (c of clientsFiltres(); track c.id) {
            <mat-option [value]="c.id">{{ c.nom }}</mat-option>
          }
        </mat-select>
      </div>
      <div class="fb-actions">
        <button class="fb-btn-apply" (click)="load()"><mat-icon>refresh</mat-icon> Appliquer</button>
      </div>
    </div>

    <div class="params__row">
      <div class="fb-field fb-field--multi">
        <label class="fb-label">Affaires</label>
        <mat-select class="fb-mselect" multiple [(ngModel)]="affaires" (ngModelChange)="recalculer()" placeholder="Toutes" panelClass="rt-panel">
          @for (a of affairesDisponibles(); track a) {
            <mat-option [value]="a">{{ a === '—' ? 'Sans affaire' : a }}</mat-option>
          }
        </mat-select>
      </div>
      <div class="fb-field fb-field--multi">
        <label class="fb-label">Tâches</label>
        <mat-select class="fb-mselect" multiple [(ngModel)]="missions" (ngModelChange)="recalculer()" placeholder="Toutes" panelClass="rt-panel">
          @for (m of missionCodes; track m.code) {
            <mat-option [value]="m.code">{{ m.code }} — {{ m.label }}</mat-option>
          }
          <mat-option value="—">Sans tâche</mat-option>
        </mat-select>
      </div>
      <div class="fb-field">
        <label class="fb-label">Présence</label>
        <div class="seg">
          @for (p of presences; track p.key) {
            <button type="button" class="seg__btn seg__btn--{{ p.key }}" [class.seg__btn--on]="presenceActive(p.key)"
                    (click)="togglePresence(p.key)">{{ p.label }}</button>
          }
        </div>
      </div>
      <div class="fb-field fb-field--grow">
        <label class="fb-label">Recherche</label>
        <input class="fb-input" style="width:100%" [(ngModel)]="recherche" (ngModelChange)="recalculer()"
               placeholder="Libellé, client, collaborateur, affaire…" />
      </div>
    </div>

    <div class="params__row params__row--grp">
      <mat-icon class="params__ico">account_tree</mat-icon>
      @for (n of [0, 1, 2]; track n) {
        <div class="fb-field">
          <label class="fb-label">Regroupement {{ n + 1 }}</label>
          <select class="fb-select" [ngModel]="regroupementAu(n)" (ngModelChange)="setRegroupement(n, $event)">
            <option value="">—</option>
            @for (d of dimensions; track d.key) {
              <option [value]="d.key" [disabled]="dimensionPrise(d.key, n)">{{ d.label }}</option>
            }
          </select>
        </div>
      }
      <div class="fb-field">
        <label class="fb-label">Lignes de détail</label>
        <div class="seg">
          <button type="button" class="seg__btn" [class.seg__btn--on]="detail" (click)="detail = true">Oui</button>
          <button type="button" class="seg__btn" [class.seg__btn--on]="!detail" (click)="detail = false">Non</button>
        </div>
      </div>
      <div class="fb-field">
        <label class="fb-label">Tri des lignes</label>
        <select class="fb-select" [(ngModel)]="tri" (ngModelChange)="recalculer()">
          <option value="collaborateur">Collaborateur puis date</option>
          <option value="date">Date</option>
        </select>
      </div>
      <button class="fb-btn-clear" (click)="reinitialiser()" matTooltip="Revenir à la présentation Tempolia et vider les filtres">
        Réinitialiser
      </button>
    </div>
  </div>

  <!-- ── Rappel des restrictions (bandeau Tempolia « Restreindre le rapport ») ── -->
  @if (restrictions().length) {
    <div class="restr">
      <mat-icon>filter_alt</mat-icon>
      <div>@for (r of restrictions(); track r) { <div>{{ r }}</div> }</div>
    </div>
  }

  <!-- ── Totaux ── -->
  @if (lignesVue().length > 0) {
    <div class="kpis">
      <div class="kpi kpi--fact"><div class="kpi__v">{{ fh(totalPresence('FACTURABLE')) }}</div><div class="kpi__l">Facturable</div></div>
      <div class="kpi kpi--nf"><div class="kpi__v">{{ fh(totalPresence('NON_FACTURABLE')) }}</div><div class="kpi__l">Non facturable</div></div>
      <div class="kpi kpi--abs"><div class="kpi__v">{{ fh(totalPresence('ABSENCE')) }}</div><div class="kpi__l">Absence</div></div>
      <div class="kpi kpi--tot"><div class="kpi__v">{{ fh(totalGeneral().heures) }}</div><div class="kpi__l">Temps total</div></div>
      <div class="kpi kpi--pv"><div class="kpi__v">{{ fe(totalGeneral().pv) }} €</div><div class="kpi__l">PV Col</div></div>
      <div class="kpi kpi--taux" matTooltip="Temps facturable ÷ temps de présence (facturable + non facturable)">
        <div class="kpi__v">{{ tauxFacturable() }} %</div><div class="kpi__l">Taux facturable</div>
      </div>
    </div>
  }

  <!-- ── Édition / duplication ── -->
  @if (editing()) {
    <app-saisie-edit-form
      [clients]="clients" [mode]="editMode()" [seed]="editSeed()"
      [submitting]="saving()" [apiError]="editError()"
      (save)="onSaveEdit($event)" (cancel)="closeEdit()" />
  }

  <!-- ── Rapport ── -->
  <div class="report">
    @if (loading()) {
      <div class="empty-state"><mat-icon>hourglass_empty</mat-icon><p>Chargement…</p></div>
    } @else if (lignesVue().length === 0) {
      <div class="empty-state"><mat-icon>timer_off</mat-icon><p>Aucun temps pour ces critères</p></div>
    } @else {
      @if (groupes().length) {
        <div class="report__tools">
          <button class="tb-btn" (click)="toutDeplier()"><mat-icon>unfold_more</mat-icon> Tout déplier</button>
          <button class="tb-btn" (click)="toutReplier()"><mat-icon>unfold_less</mat-icon> Replier au 1er niveau</button>
        </div>
        @for (g of groupes(); track g.chemin) {
          <ng-container *ngTemplateOutlet="groupeTpl; context: { $implicit: g }" />
        }
      } @else {
        <ng-container *ngTemplateOutlet="tableTpl; context: { $implicit: lignesVue(), titre: null }" />
      }

      <div class="grand-total">
        <span>Total général</span>
        <span class="grand-total__v">{{ fh(totalGeneral().heures) }}</span>
        <span class="grand-total__v">{{ fe(totalGeneral().pv) }} €</span>
      </div>

      <!-- Récapitulatif général -->
      <h2 class="recap-title">Récapitulatif général</h2>
      <div class="recaps">
        @for (r of recaps(); track r.titre) {
          <div class="recap">
            <div class="recap__hd">{{ r.titre }}</div>
            <table class="recap__tbl">
              <thead><tr><th></th><th class="num">Temps</th><th class="num">Part</th><th class="num">PV Col</th></tr></thead>
              <tbody>
                @for (l of r.lignes; track l.libelle) {
                  <tr>
                    <td>{{ l.libelle }}</td>
                    <td class="num">{{ fh(l.heures) }}</td>
                    <td class="num"><span class="part"><span class="part__bar" [style.width.%]="l.part * 100"></span>{{ (l.part * 100) | number:'1.0-0' }} %</span></td>
                    <td class="num">{{ fe(l.pv) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    }
  </div>
</div>

<!-- Groupe récursif -->
<ng-template #groupeTpl let-g>
  <section class="grp grp--n{{ g.niveau > 3 ? 3 : g.niveau }}">
    <header class="grp__hd" (click)="toggle(g.chemin)">
      <mat-icon class="grp__chev">{{ estReplie(g.chemin) ? 'chevron_right' : 'expand_more' }}</mat-icon>
      <span class="grp__lbl">{{ libelleDimension(g.dimension) }} : <strong>{{ g.libelle }}</strong></span>
      @if (g.dimension === 'affaire' && g.lignes[0]?.affaireEtat) {
        <span class="etat etat--{{ g.lignes[0].affaireEtat }}" [matTooltip]="g.lignes[0].affaireEtat === 'O' ? 'Affaire ouverte' : 'Affaire clôturée'">{{ g.lignes[0].affaireEtat }}</span>
      }
      <span class="grp__nb">{{ g.lignes.length }} ligne(s)</span>
      <span class="grp__tot">{{ fh(g.totalHeures) }}</span>
      <span class="grp__tot grp__tot--pv">{{ fe(g.totalPv) }} €</span>
    </header>
    @if (!estReplie(g.chemin)) {
      <div class="grp__body">
        @if (g.enfants.length) {
          @for (e of g.enfants; track e.chemin) {
            <ng-container *ngTemplateOutlet="groupeTpl; context: { $implicit: e }" />
          }
        } @else if (detail) {
          <ng-container *ngTemplateOutlet="tableTpl; context: { $implicit: g.lignes, titre: g.libelle, groupe: g }" />
        }
      </div>
    }
  </section>
</ng-template>

<!-- Table des lignes de détail -->
<ng-template #tableTpl let-lignes let-titre="titre" let-groupe="groupe">
  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th><th>Collaborateur</th><th>Présence</th><th>Client / TNF</th><th>Affaire</th>
          <th class="c">État</th><th>Tâche</th><th class="th-lib">Libellé</th>
          <th class="num">Temps</th><th class="num">PV Col</th><th></th>
        </tr>
      </thead>
      <tbody>
        @for (r of lignes; track r.source + r.id) {
          <tr class="data-row" [class.data-row--abs]="r.source === 'ABSENCE'">
            <td class="td-date">{{ formatDate(r.date) }}</td>
            <td class="td-collab">{{ r.collaborateur }}</td>
            <td><span class="pres pres--{{ r.presence }}">{{ libellePresence(r.presence) }}</span></td>
            <td class="td-client">{{ r.clientTnf }}</td>
            <td class="td-mono">{{ r.affaire ?? '—' }}</td>
            <td class="c">@if (r.affaireEtat) { <span class="etat etat--{{ r.affaireEtat }}">{{ r.affaireEtat }}</span> }</td>
            <td><span class="mission" [matTooltip]="libelleMission(r.missionCode)">{{ r.missionCode ?? '—' }}</span></td>
            <td class="td-lib">{{ r.libelle ?? '—' }}</td>
            <td class="num td-temps">{{ fh(r.dureeHeures) }}</td>
            <td class="num td-pv" [class.td-pv--zero]="!r.pv"
                [matTooltip]="r.tauxHoraire ? (fe(r.tauxHoraire) + ' €/h' + (r.tauxFige ? ' (figé à la saisie)' : ' (tarif actuel, non figé)')) : 'Aucun prix de vente horaire'">
              {{ fe(r.pv) }}
            </td>
            <td class="td-actions">
              @if (r.source === 'SAISIE') {
                @if (r.isLocked) {
                  <mat-icon class="lock" title="Verrouillée">lock</mat-icon>
                } @else if (isMine(r)) {
                  <button class="td-act" (click)="startEdit(r)" title="Modifier"><mat-icon>edit</mat-icon></button>
                  <button class="td-act" (click)="startDuplicate(r)" title="Dupliquer"><mat-icon>content_copy</mat-icon></button>
                  <button class="td-act td-act--del" (click)="supprimer(r)" title="Supprimer"><mat-icon>delete_outline</mat-icon></button>
                }
              }
            </td>
          </tr>
        }
        @if (titre) {
          <tr class="sub-total">
            <td colspan="8">Total {{ titre }}</td>
            <td class="num">{{ fh(groupe.totalHeures) }}</td>
            <td class="num">{{ fe(groupe.totalPv) }}</td>
            <td></td>
          </tr>
        }
      </tbody>
    </table>
  </div>
</ng-template>
  `,
  styles: [`
    .page { display:flex; flex-direction:column; height:100%; min-height:0; overflow:auto; }

    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 0; flex-shrink:0; gap:12px; flex-wrap:wrap; }
    .pg-header__left { display:flex; align-items:center; gap:14px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:linear-gradient(135deg,#db2777,#9d174d); box-shadow:0 4px 14px rgba(219,39,119,.3); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }
    .header-actions { display:flex; align-items:center; gap:10px; }
    .btn-export { display:flex; align-items:center; gap:6px; padding:9px 18px; border-radius:9px; border:1.5px solid #bbf7d0; background:#fff; color:#15803d; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; }
    .btn-export--pdf { border-color:#fbcfe8; color:#be185d; }
    .btn-export mat-icon { font-size:16px; width:16px; height:16px; }
    .btn-export:hover:not(:disabled) { box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .btn-export:disabled { opacity:.5; cursor:not-allowed; }

    .params { background:#fff; margin:16px 28px 0; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); border:1px solid #f1f5f9; padding:14px 20px; display:flex; flex-direction:column; gap:12px; flex-shrink:0; }
    .params__row { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; }
    .params__row--grp { padding-top:12px; border-top:1px dashed #e2e8f0; }
    .params__ico { color:#94a3b8; align-self:center; }
    .fb-field { display:flex; flex-direction:column; gap:4px; position:relative; }
    .fb-field--grow { flex:1; min-width:200px; }
    .fb-field--multi { min-width:170px; max-width:240px; }
    .fb-label { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .fb-input, .fb-select { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none; font-family:inherit; min-width:130px; box-sizing:border-box; }
    .fb-input:focus, .fb-select:focus { border-color:#db2777; box-shadow:0 0 0 3px rgba(219,39,119,.12); }
    .fb-mselect { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; display:flex; align-items:center; box-sizing:border-box; background:#fff; }
    .fb-actions { display:flex; gap:8px; align-self:flex-end; margin-left:auto; }
    .fb-btn-apply { height:36px; background:#db2777; color:#fff; border:none; border-radius:7px; padding:0 16px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; }
    .fb-btn-apply mat-icon { font-size:16px; width:16px; height:16px; }
    .fb-btn-apply:hover { background:#be185d; }
    .fb-btn-clear { height:36px; background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; border-radius:7px; padding:0 14px; font-size:13px; cursor:pointer; margin-left:auto; }
    .fb-btn-clear:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }
    .fb-cal-btn { height:36px; width:36px; border:1px solid #e2e8f0; border-radius:7px; background:#fff; color:#db2777; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .fb-cal-btn mat-icon { font-size:18px; width:18px; height:18px; }
    .fb-range-hidden { position:absolute; width:0; height:0; overflow:hidden; opacity:0; pointer-events:none; }

    .seg { display:flex; gap:3px; background:#f1f5f9; border-radius:7px; padding:3px; height:36px; box-sizing:border-box; }
    .seg__btn { border:none; background:transparent; border-radius:5px; padding:0 11px; font-size:12.5px; font-weight:600; color:#64748b; cursor:pointer; white-space:nowrap; }
    .seg__btn--on { background:#334155; color:#fff; }
    .seg__btn--FACTURABLE.seg__btn--on { background:#db2777; }
    .seg__btn--NON_FACTURABLE.seg__btn--on { background:#64748b; }
    .seg__btn--ABSENCE.seg__btn--on { background:#0891b2; }

    .restr { display:flex; gap:10px; margin:12px 28px 0; padding:10px 16px; background:#fdf2f8; border:1px solid #fbcfe8; border-radius:10px; font-size:12.5px; color:#831843; }
    .restr mat-icon { color:#db2777; font-size:18px; width:18px; height:18px; }

    .kpis { display:flex; gap:12px; padding:14px 28px 0; flex-wrap:wrap; flex-shrink:0; }
    .kpi { flex:1; min-width:130px; border-radius:12px; padding:13px 16px; border:1px solid transparent; }
    .kpi__v { font-size:21px; font-weight:800; font-family:monospace; line-height:1.1; }
    .kpi__l { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; opacity:.75; margin-top:3px; }
    .kpi--fact { background:#fdf2f8; border-color:#fbcfe8; color:#be185d; }
    .kpi--nf   { background:#f8fafc; border-color:#e2e8f0; color:#475569; }
    .kpi--abs  { background:#ecfeff; border-color:#a5f3fc; color:#0e7490; }
    .kpi--tot  { background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8; }
    .kpi--pv   { background:#f0fdf4; border-color:#bbf7d0; color:#15803d; }
    .kpi--taux { background:#faf5ff; border-color:#e9d5ff; color:#7e22ce; }

    .report { padding:14px 28px 28px; }
    .report__tools { display:flex; gap:8px; margin-bottom:10px; }
    .tb-btn { height:30px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0 10px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:4px; color:#374151; }
    .tb-btn mat-icon { font-size:15px; width:15px; height:15px; }
    .tb-btn:hover { background:#fce7f3; border-color:#fbcfe8; color:#be185d; }

    .grp { border-left:3px solid #db2777; margin-bottom:10px; padding-left:8px; }
    .grp .grp { margin:8px 0 8px 4px; }
    .grp--n2 { border-left-color:#64748b; }
    .grp--n3 { border-left-color:#16a34a; }
    .grp__hd { display:flex; align-items:center; gap:8px; padding:9px 14px; border-radius:6px; cursor:pointer; user-select:none; font-size:13px; }
    .grp--n1 > .grp__hd { background:#fdf2f8; border:1px solid #fbcfe8; color:#9d174d; }
    .grp--n2 > .grp__hd { background:#f1f5f9; border:1px solid #e2e8f0; color:#1e293b; }
    .grp--n3 > .grp__hd { background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; }
    .grp__chev { font-size:18px; width:18px; height:18px; }
    .grp__lbl { flex:1; }
    .grp__nb { font-size:11px; opacity:.7; }
    .grp__tot { font-family:monospace; font-weight:800; min-width:72px; text-align:right; }
    .grp__tot--pv { min-width:100px; }
    .grp__body { padding-top:6px; }

    .etat { display:inline-block; font-size:10.5px; font-weight:800; padding:1px 7px; border-radius:10px; }
    .etat--O { background:#dcfce7; color:#15803d; }
    .etat--C { background:#e2e8f0; color:#475569; }

    .table-wrap { overflow-x:auto; }
    .data-table { width:100%; border-collapse:collapse; font-size:12.5px; }
    .data-table thead { background:#33333f; }
    .data-table th { color:#fff; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; padding:9px 10px; text-align:left; white-space:nowrap; }
    .data-table th.num, .num { text-align:right; }
    .c { text-align:center; }
    .data-table tbody tr.data-row:nth-child(even) { background:#f8fafc; }
    .data-table tbody tr.data-row:hover { background:#fdf2f8; }
    .data-row--abs { color:#0e7490; }
    .data-table td { padding:6px 10px; color:#374151; border-bottom:1px solid #f1f5f9; vertical-align:top; }
    .td-date { white-space:nowrap; font-variant-numeric:tabular-nums; }
    .td-collab, .td-client { white-space:nowrap; color:#475569; }
    .td-mono { font-family:monospace; white-space:nowrap; }
    .td-lib { min-width:260px; color:#334155; line-height:1.35; }
    .th-lib { min-width:260px; }
    .td-temps { font-family:monospace; font-weight:700; color:#0f172a; white-space:nowrap; }
    .td-pv { font-family:monospace; white-space:nowrap; }
    .td-pv--zero { color:#cbd5e1; }
    .pres { font-size:11px; font-weight:600; white-space:nowrap; }
    .pres--FACTURABLE { color:#be185d; }
    .pres--NON_FACTURABLE { color:#64748b; }
    .pres--ABSENCE { color:#0e7490; }
    .mission { font-family:monospace; font-weight:700; font-size:11.5px; }
    .td-actions { text-align:right; white-space:nowrap; }
    .td-act { background:none; border:none; cursor:pointer; color:#94a3b8; padding:3px; border-radius:5px; display:inline-flex; }
    .td-act mat-icon, .lock { font-size:16px; width:16px; height:16px; }
    .lock { color:#94a3b8; }
    .td-act:hover { color:#be185d; background:#fce7f3; }
    .td-act--del:hover { color:#dc2626; background:#fee2e2; }
    .sub-total td { font-weight:800; background:#f0fdf4; color:#166534; border-top:1px solid #bbf7d0; font-family:inherit; }
    .sub-total td.num { font-family:monospace; }

    .grand-total { display:flex; align-items:center; gap:16px; padding:11px 16px; margin-top:12px; border-radius:8px; background:#fdf2f8; border:1px solid #f9a8d4; color:#9d174d; font-weight:800; font-size:14px; }
    .grand-total span:first-child { flex:1; }
    .grand-total__v { font-family:monospace; min-width:90px; text-align:right; }

    .recap-title { font-size:15px; font-weight:800; color:#0f172a; margin:24px 0 10px; padding-left:10px; border-left:4px solid #db2777; }
    .recaps { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:14px; }
    .recap { background:#fff; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }
    .recap__hd { padding:9px 14px; font-weight:700; font-size:12.5px; background:#f8fafc; border-bottom:1px solid #e2e8f0; color:#334155; }
    .recap__tbl { width:100%; border-collapse:collapse; font-size:12.5px; }
    .recap__tbl th { font-size:10.5px; color:#64748b; font-weight:700; text-transform:uppercase; padding:6px 12px; }
    .recap__tbl td { padding:6px 12px; border-top:1px solid #f1f5f9; }
    .recap__tbl td.num { font-family:monospace; white-space:nowrap; }
    .part { position:relative; display:inline-block; min-width:60px; }
    .part__bar { position:absolute; left:0; bottom:-2px; height:3px; background:#f9a8d4; border-radius:2px; max-width:100%; }

    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px 28px; color:#94a3b8; gap:12px; }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; opacity:.3; }
    .empty-state p { font-size:14px; margin:0; }

    ::ng-deep .rt-panel .rt-search { padding:8px 12px; border-bottom:1px solid #f1f5f9; position:sticky; top:0; background:#fff; z-index:1; }
    ::ng-deep .rt-panel .rt-search input { width:100%; height:32px; border:1px solid #e2e8f0; border-radius:6px; padding:0 8px; font-size:13px; box-sizing:border-box; outline:none; }
  `],
})
export class TravailTempsDetailComponent implements OnInit, OnDestroy {
  private svc        = inject(SaisieTempsService);
  private clientsSvc = inject(ClientsService);
  private usersSvc   = inject(UsersService);
  authSvc            = inject(AuthService);
  tenantSvc          = inject(TenantService);
  private _d$        = new Subject<void>();

  readonly dimensions = DIMENSIONS;
  readonly missionCodes = MISSION_CODES;
  readonly presences: { key: Presence; label: string }[] = [
    { key: 'FACTURABLE', label: 'Facturable' },
    { key: 'NON_FACTURABLE', label: 'Non fact.' },
    { key: 'ABSENCE', label: 'Absence' },
  ];

  loading    = signal(true);
  lignes     = signal<LigneRapportDetail[]>([]);
  lignesVue  = signal<LigneRapportDetail[]>([]);
  groupes    = signal<Groupe[]>([]);
  replies    = signal<Set<string>>(new Set());
  clients: Client[] = [];
  users: User[]     = [];

  // Paramètres chargés côté serveur
  preset: Preset = 'annee';
  dateDebut = '';
  dateFin   = '';
  collaborateurIds: number[] = [];
  clientIds: number[] = [];
  clientFiltre = '';
  rangeStart: Date | null = null;
  rangeEnd:   Date | null = null;

  // Paramètres appliqués à l'écran
  affaires: string[] = [];
  missions: string[] = [];
  presencesActives = new Set<Presence>(['FACTURABLE', 'NON_FACTURABLE', 'ABSENCE']);
  recherche = '';
  regroupements: Dimension[] = [...REGROUPEMENT_TEMPOLIA];
  detail = true;
  tri: 'collaborateur' | 'date' = 'collaborateur';

  // Édition / duplication
  editing   = signal(false);
  editMode  = signal<'edit' | 'duplicate'>('edit');
  editSeed  = signal<SaisieEditSeed | null>(null);
  editingId = signal<number | null>(null);
  saving    = signal(false);
  editError = signal('');

  ngOnInit() {
    // Regroupement « Pôle de travail » : libellés des pôles du cabinet (cahier v2 #5).
    definirLibellesLieu({ EST: this.tenantSvc.poleLabel('EST'), OUEST: this.tenantSvc.poleLabel('OUEST') });
    this.appliquerPreset(false);
    this.clientsSvc.getAll().pipe(takeUntil(this._d$)).subscribe(c => this.clients = c);
    this.usersSvc.getAll().pipe(takeUntil(this._d$)).subscribe(u => this.users = u);
    this.load();
  }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }

  // ── Chargement / calcul ──

  load() {
    this.loading.set(true);
    this.svc.getRapportDetail({
      dateDebut: this.dateDebut || undefined,
      dateFin: this.dateFin || undefined,
      collaborateurIds: this.authSvc.isAdmin() ? this.collaborateurIds : undefined,
      clientIds: this.clientIds,
    }).pipe(takeUntil(this._d$)).subscribe({
      next: ({ lignes }) => { this.lignes.set(lignes); this.loading.set(false); this.recalculer(); },
      error: () => { this.lignes.set([]); this.loading.set(false); this.recalculer(); },
    });
  }

  recalculer() {
    const q = this.recherche.trim().toLowerCase();
    const vue = this.lignes().filter(l =>
      this.presencesActives.has(l.presence)
      && (!this.affaires.length || this.affaires.includes(l.affaire ?? '—'))
      && (!this.missions.length || this.missions.includes(l.missionCode ?? '—'))
      && (!q || [l.libelle, l.clientTnf, l.collaborateur, l.affaire, l.missionCode].some(v => (v ?? '').toLowerCase().includes(q))),
    );
    const triees = trierLignes(vue, this.tri);
    this.lignesVue.set(triees);
    this.groupes.set(grouper(triees, this.regroupements, this.tri));
  }

  appliquerPreset(recharger = true) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const iso = (d: Date) => toLocalIso(d);
    const plages: Record<Exclude<Preset, ''>, [Date, Date]> = {
      'annee':   [new Date(y, 0, 1), now],
      'annee-1': [new Date(y - 1, 0, 1), new Date(y - 1, 11, 31)],
      '12m':     [new Date(y, m - 11, 1), now],
      'mois':    [new Date(y, m, 1), now],
      'mois-1':  [new Date(y, m - 1, 1), new Date(y, m, 0)],
      '30j':     [new Date(y, m, now.getDate() - 30), now],
    };
    if (!this.preset) return;
    const [d, f] = plages[this.preset];
    this.dateDebut = iso(d);
    this.dateFin = iso(f);
    if (recharger) this.load();
  }

  onRangeChange() {
    if (!this.rangeStart || !this.rangeEnd) return;
    this.preset = '';
    this.dateDebut = toLocalIso(this.rangeStart);
    this.dateFin   = toLocalIso(this.rangeEnd);
    this.load();
  }

  reinitialiser() {
    this.preset = 'annee';
    this.collaborateurIds = [];
    this.clientIds = [];
    this.affaires = [];
    this.missions = [];
    this.presencesActives = new Set(['FACTURABLE', 'NON_FACTURABLE', 'ABSENCE']);
    this.recherche = '';
    this.regroupements = [...REGROUPEMENT_TEMPOLIA];
    this.detail = true;
    this.tri = 'collaborateur';
    this.replies.set(new Set());
    this.appliquerPreset();
  }

  // ── Regroupements / filtres écran ──

  setRegroupement(niveau: number, valeur: string) {
    const r = [...this.regroupements];
    if (!valeur) r.splice(niveau);          // vider un niveau vide aussi les suivants
    else r[niveau] = valeur as Dimension;
    this.regroupements = r.filter(Boolean).slice(0, 3);
    this.replies.set(new Set());
    this.recalculer();
  }

  regroupementAu(niveau: number): string {
    return this.regroupements[niveau] ?? '';
  }

  dimensionPrise(d: Dimension, niveau: number): boolean {
    return this.regroupements.some((x, i) => x === d && i !== niveau);
  }

  presenceActive(p: Presence) { return this.presencesActives.has(p); }

  togglePresence(p: Presence) {
    const s = new Set(this.presencesActives);
    if (s.has(p)) { if (s.size > 1) s.delete(p); } else s.add(p);
    this.presencesActives = s;
    this.recalculer();
  }

  affairesDisponibles(): string[] {
    const set = new Set(this.lignes().filter(l => l.source === 'SAISIE').map(l => l.affaire ?? '—'));
    return [...set].sort((a, b) => b.localeCompare(a));
  }

  usersTries(): User[] {
    return [...this.users].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'fr', { sensitivity: 'base' }));
  }

  clientsFiltres(): Client[] {
    const t = this.clientFiltre.trim().toLowerCase();
    const tries = [...this.clients].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
    // Les clients déjà cochés restent visibles même s'ils ne correspondent pas à la recherche.
    return t ? tries.filter(c => c.nom.toLowerCase().includes(t) || this.clientIds.includes(c.id)) : tries;
  }

  // ── Sections repliables ──

  estReplie(chemin: string) { return this.replies().has(chemin); }

  toggle(chemin: string) {
    const s = new Set(this.replies());
    s.has(chemin) ? s.delete(chemin) : s.add(chemin);
    this.replies.set(s);
  }

  toutDeplier() { this.replies.set(new Set()); }

  toutReplier() { this.replies.set(new Set(this.groupes().map(g => g.chemin))); }

  // ── Totaux / récapitulatifs ──

  totalGeneral() { return totaux(this.lignesVue()); }

  totalPresence(p: Presence) { return totaux(this.lignesVue().filter(l => l.presence === p)).heures; }

  tauxFacturable(): number {
    const f = this.totalPresence('FACTURABLE');
    const presence = f + this.totalPresence('NON_FACTURABLE');
    return presence ? Math.round((f / presence) * 100) : 0;
  }

  recaps() {
    const lignes = this.lignesVue();
    return [
      { titre: 'Par présence', lignes: recapitulatif(lignes, 'presence') },
      { titre: 'Par collaborateur', lignes: recapitulatif(lignes, 'collaborateur') },
      { titre: 'Par tâche', lignes: recapitulatif(lignes, 'mission') },
    ];
  }

  restrictions(): string[] {
    const r: string[] = [];
    const noms = (ids: number[], liste: { id: number }[], nom: (x: any) => string) =>
      ids.map(id => liste.find(x => x.id === id)).filter(Boolean).map(nom).join(', ');
    if (this.collaborateurIds.length) r.push(`Restreindre le rapport aux ${this.collaborateurIds.length} collaborateur(s) sélectionné(s) : ${noms(this.collaborateurIds, this.users, u => `${u.firstName} ${u.lastName}`)}`);
    if (this.clientIds.length) r.push(`Restreindre le rapport aux ${this.clientIds.length} client(s) sélectionné(s) : ${noms(this.clientIds, this.clients, c => c.nom)}`);
    if (this.affaires.length) r.push(`Restreindre le rapport aux ${this.affaires.length} affaire(s) sélectionnée(s) : ${this.affaires.map(a => a === '—' ? 'sans affaire' : a).join(', ')}`);
    if (this.missions.length) r.push(`Tâches : ${this.missions.map(m => m === '—' ? 'sans tâche' : m).join(', ')}`);
    if (this.presencesActives.size < 3) r.push(`Présence : ${[...this.presencesActives].map(p => LIBELLES_PRESENCE[p]).join(', ')}`);
    if (this.recherche.trim()) r.push(`Recherche : « ${this.recherche.trim()} »`);
    return r;
  }

  periodeLibelle(): string {
    if (!this.dateDebut && !this.dateFin) return 'toutes dates';
    return `du ${this.formatDate(this.dateDebut)} au ${this.formatDate(this.dateFin)}`;
  }

  // ── Exports ──

  private entete(): EnteteRapport {
    return {
      cabinet: this.tenantSvc.nomSociete(),
      periode: this.periodeLibelle(),
      regroupements: this.regroupements.length ? this.regroupements.map(d => this.libelleDimension(d)).join(', ') : 'Aucun',
      detail: this.detail,
      restrictions: this.restrictions(),
    };
  }

  exportPdf()   { exporterPdf(this.groupes(), this.lignesVue(), this.entete()); }
  exportExcel() { exporterExcel(this.groupes(), this.lignesVue(), this.entete()); }

  // ── Affichage ──

  libelleDimension(d: Dimension): string { return libelleDimension(d); }
  libellePresence(p: Presence) { return LIBELLES_PRESENCE[p]; }
  libelleMission(c: string | null) { return libelleMission(c); }
  fh(h: number) { return formatHeures(h); }
  fe(n: number | null) { return formatEuros(n); }

  formatDate(d: string): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  isMine(r: LigneRapportDetail): boolean {
    const me = this.authSvc.currentUser();
    return !!me && r.collaborateurId === me.id;
  }

  // ── Édition ──

  private seedDe(r: LigneRapportDetail): SaisieEditSeed {
    return {
      date: r.date, clientId: r.clientId ?? null, missionCode: r.missionCode ?? null,
      dureeHeures: r.dureeHeures, type: r.presence === 'FACTURABLE' ? 'FACTURABLE' : 'NON_FACTURABLE',
      categorie: (r.categorie as any) ?? null, commentaire: r.libelle ?? null,
      heureDebut: r.heureDebut ?? null, heureFin: r.heureFin ?? null, affaire: r.affaire ?? null,
      lieuTravail: r.lieuTravail ?? null,
    };
  }

  startEdit(r: LigneRapportDetail) {
    this.editMode.set('edit');
    this.editingId.set(r.id);
    this.editError.set('');
    this.editSeed.set(this.seedDe(r));
    this.editing.set(true);
  }

  startDuplicate(r: LigneRapportDetail) {
    this.editMode.set('duplicate');
    this.editingId.set(null);
    this.editError.set('');
    this.editSeed.set(this.seedDe(r));
    this.editing.set(true);
  }

  closeEdit() {
    this.editing.set(false);
    this.editingId.set(null);
    this.editError.set('');
  }

  onSaveEdit(result: SaisieEditResult) {
    this.saving.set(true);
    this.editError.set('');
    const id = this.editingId();
    const obs = (this.editMode() === 'edit' && id !== null)
      ? this.svc.update(id, result)
      : this.svc.create(result);
    obs.pipe(takeUntil(this._d$)).subscribe({
      next: () => { this.saving.set(false); this.closeEdit(); this.load(); },
      error: (err) => {
        this.saving.set(false);
        this.editError.set(err?.error?.message || 'Erreur lors de l\'enregistrement — réessayez.');
      },
    });
  }

  supprimer(r: LigneRapportDetail) {
    if (!confirm(`Supprimer cette saisie du ${this.formatDate(r.date)} (${this.fh(r.dureeHeures)}) ?`)) return;
    this.svc.delete(r.id).pipe(takeUntil(this._d$)).subscribe({
      next: () => { this.lignes.update(rows => rows.filter(x => !(x.source === 'SAISIE' && x.id === r.id))); this.recalculer(); },
    });
  }
}
