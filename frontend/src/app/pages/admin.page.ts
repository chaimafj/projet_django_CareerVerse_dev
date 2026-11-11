import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { ApiService, errorMessage } from '../core/api.service';
import { TranslatePipe } from '../core/locale.service';
import { AuthService } from '../core/auth.service';
import { CourseSummary, LabSummary, Progress, User } from '../core/models';
import { AppIconComponent } from '../widgets/app-icon.component';

type AdminModuleKey = 'staff' | 'catalog' | 'content' | 'monitoring';

type AdminModule = {
  key: AdminModuleKey;
  title: string;
  subtitle: string;
  icon: 'user' | 'book' | 'lab' | 'sparkles';
  category: string;
  cardTitle: string;
  description: string;
  features: string[];
  cta: string;
  headline: string;
  summary: string;
};

type AdminUserRow = Pick<User, 'id' | 'email' | 'name' | 'is_staff' | 'is_superuser'> & { is_active: boolean };

@Component({
  standalone: true,
  imports: [CommonModule, TranslatePipe, IonicModule, AppIconComponent],
  styleUrl: './admin.page.scss',
  template: `
    <section class="admin-page">
      <header class="admin-header">
        <div>
          <span class="eyebrow">{{ 'ADMINISTRATION' | t }}</span>
          <h1>{{ 'CareerVerse admin' | t }}</h1>
        </div>
        <div class="admin-header-meta">
          <span class="status-tag"><app-icon name="shield" /> {{ 'Admin connected' | t }}</span>
          <strong>{{ auth.user()?.name || 'Administrator' }}</strong>
        </div>
      </header>

      <div class="admin-shell">
        <aside class="admin-menu">
          <h2>{{ 'Admin modules' | t }}</h2>
          <nav class="admin-menu-list" aria-label="Administration navigation">
            @for (item of modules; track item.key) {
              <button
                type="button"
                class="menu-item"
                [class.active]="activeModule() === item.key"
                (click)="selectModule(item.key)"
              >
                <span class="menu-ico"><app-icon [name]="item.icon" /></span>
                <span>
                  <strong>{{ item.title | t }}</strong>
                  <small>{{ item.subtitle | t }}</small>
                </span>
              </button>
            }
          </nav>
        </aside>

        <main class="admin-content">
          <section class="overview-card hero-card">
            <div>
              <span class="eyebrow accent">{{ 'ADMIN OVERVIEW' | t }}</span>
              <h2>{{ currentModule().headline }}</h2>
              <p>{{ currentModule().summary }}</p>
            </div>
            <button type="button" class="primary-action" (click)="openCurrentAdminSection()">
              {{ currentModule().cta }} <span aria-hidden="true">→</span>
            </button>
          </section>

          @if (loading()) {
            <div class="data-panel loading-panel">
              <p>Chargement des données admin…</p>
            </div>
          } @else if (loadError()) {
            <div class="data-panel error-panel">
              <p>{{ loadError() }}</p>
            </div>
          } @else {
            @switch (activeModule()) {
              @case ('staff') {
                <section class="data-panel">
                  <div class="panel-header">
                    <div>
                      <span class="eyebrow">{{ 'UTILISATEURS' | t }}</span>
                      <h3>{{ 'Gestion des comptes' | t }}</h3>
                    </div>
                    <button type="button" class="secondary-action">{{ 'Ajouter' | t }}</button>
                  </div>
                  <div class="table-wrap">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Nom</th>
                          <th>Staff</th>
                          <th>Superuser</th>
                          <th>Actif</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (user of users(); track user.id) {
                          <tr>
                            <td>{{ user.email }}</td>
                            <td>{{ user.name || '—' }}</td>
                            <td><span class="status-pill" [class.enabled]="user.is_staff">{{ user.is_staff ? 'Oui' : 'Non' }}</span></td>
                            <td><span class="status-pill" [class.enabled]="user.is_superuser">{{ user.is_superuser ? 'Oui' : 'Non' }}</span></td>
                            <td><span class="status-pill" [class.enabled]="user.is_active">{{ user.is_active ? 'Oui' : 'Non' }}</span></td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </section>
              }
              @case ('catalog') {
                <section class="data-grid-two">
                  <div class="data-panel">
                    <div class="panel-header">
                      <div>
                        <span class="eyebrow">{{ 'COURS' | t }}</span>
                        <h3>{{ 'Catalogue des cours' | t }}</h3>
                      </div>
                    </div>
                    <div class="table-wrap slim">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Cours</th>
                            <th>Carrière</th>
                            <th>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (course of courses(); track course.id) {
                            <tr>
                              <td>{{ course.title }}</td>
                              <td>{{ course.career_title }}</td>
                              <td><span class="status-pill" [class.enabled]="!course.locked">{{ course.locked ? 'Verrouillé' : 'Ouvert' }}</span></td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div class="data-panel">
                    <div class="panel-header">
                      <div>
                        <span class="eyebrow">{{ 'LABS' | t }}</span>
                        <h3>{{ 'Missions & labs' | t }}</h3>
                      </div>
                    </div>
                    <div class="table-wrap slim">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Lab</th>
                            <th>Niveau</th>
                            <th>Questions</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (lab of labs(); track lab.id) {
                            <tr>
                              <td>{{ lab.title }}</td>
                              <td>{{ lab.level }}</td>
                              <td>{{ lab.question_count }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              }
              @case ('content') {
                <section class="data-panel">
                  <div class="panel-header">
                    <div>
                      <span class="eyebrow">{{ 'CONTENUS' | t }}</span>
                      <h3>{{ 'Questions & exercices' | t }}</h3>
                    </div>
                  </div>
                  <div class="table-wrap">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Lab</th>
                          <th>Questions</th>
                          <th>Temps</th>
                          <th>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (lab of labs(); track lab.id) {
                          <tr>
                            <td>{{ lab.title }}</td>
                            <td>{{ lab.question_count }}</td>
                            <td>{{ lab.expected_seconds }}s</td>
                            <td><span class="status-pill" [class.enabled]="!lab.locked">{{ lab.locked ? 'Premium' : 'Public' }}</span></td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </section>
              }
              @default {
                <section class="data-panel">
                  <div class="panel-header">
                    <div>
                      <span class="eyebrow">{{ 'SUIVI' | t }}</span>
                      <h3>{{ 'Progression & scores' | t }}</h3>
                    </div>
                  </div>
                  <div class="performance-summary">
                    <div class="metric-box">
                      <span>Labs validés</span>
                      <strong>{{ progress()?.completed_labs ?? 0 }}</strong>
                    </div>
                    <div class="metric-box">
                      <span>Score moyen</span>
                      <strong>{{ progress()?.average_score ? (progress()?.average_score ?? 0) + '%' : '—' }}</strong>
                    </div>
                    <div class="metric-box">
                      <span>Cours terminés</span>
                      <strong>{{ progress()?.completed_courses ?? 0 }}</strong>
                    </div>
                  </div>
                  <div class="table-wrap">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Carrière</th>
                          <th>Lab</th>
                          <th>Score</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (result of progress()?.results ?? []; track result.id) {
                          <tr>
                            <td>{{ result.career_title }}</td>
                            <td>{{ result.lab_title }}</td>
                            <td>{{ result.score }}%</td>
                            <td>{{ result.completed_at | date:'shortDate' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </section>
              }
            }
          }
        </main>
      </div>
    </section>
  `,
})
export class AdminPage {
  readonly auth = inject(AuthService);
  readonly api = inject(ApiService);
  readonly activeModule = signal<AdminModuleKey>('staff');
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly users = signal<AdminUserRow[]>([]);
  readonly labs = signal<LabSummary[]>([]);
  readonly courses = signal<CourseSummary[]>([]);
  readonly progress = signal<Progress | null>(null);

  readonly modules: AdminModule[] = [
    {
      key: 'staff',
      title: 'Utilisateurs',
      subtitle: 'Comptes & permissions',
      icon: 'user',
      category: 'Gestion des utilisateurs',
      cardTitle: 'Gérer les comptes utilisateur',
      description: 'Créer, modifier, activer ou bloquer les comptes étudiants et staff.',
      features: [
        'Filtrer par email, nom, staff, superuser, actif/inactif',
        'Gérer les permissions, groupes et accès',
        'Voir et modifier les profils étudiants et leurs données',
      ],
      cta: 'Ouvrir',
      headline: 'Le système de gestion des utilisateurs.',
      summary: 'L’admin permet de gérer les comptes, les profils étudiants, les permissions et les accès selon le rôle.',
    },
    {
      key: 'catalog',
      title: 'Catalogue',
      subtitle: 'Métiers, cours & labs',
      icon: 'book',
      category: 'Gestion du catalogue',
      cardTitle: 'Administrer le catalogue pédagogique',
      description: 'Ajouter, modifier et organiser les métiers, cours et labs.',
      features: [
        'Ajouter et modifier les carrières et leurs attributs',
        'Gérer slug, résumé, catégorie, outils, intérêts et salaire',
        'Relier chaque carrière aux cours et missions associées',
      ],
      cta: 'Ouvrir catalogue',
      headline: 'Piloter le catalogue de formation.',
      summary: 'L’admin permet de gérer les métiers, les parcours et les contenus pédagogiques associés à chaque opportunité.',
    },
    {
      key: 'content',
      title: 'Contenus',
      subtitle: 'Questions & exercices',
      icon: 'lab',
      category: 'Gestion des contenus',
      cardTitle: 'Créer et éditer les contenus de formation',
      description: 'Gérer les questions, options, lab et activités interactives.',
      features: [
        'Créer des questions de quiz, code, architecture, evidence et sequence',
        'Définir la compétence visée et le type d’exercice',
        'Associer les contenus aux labs et aux parcours pédagogiques',
      ],
      cta: 'Gérer contenu',
      headline: 'Construire des parcours d’apprentissage solides.',
      summary: 'Les contenus pédagogiques sont centralisés pour organiser les acquis, les activités et les évaluations du programme.',
    },
    {
      key: 'monitoring',
      title: 'Suivi & scores',
      subtitle: 'Progression & analytics',
      icon: 'sparkles',
      category: 'Suivi des résultats',
      cardTitle: 'Surveiller les progrès et les scores',
      description: 'Suivre les résultats, les tentatives et la progression globale des apprenants.',
      features: [
        'Consulter scores, tentatives et validations',
        'Vérifier les résultats des labs et des cours',
        'Suivre la progression et identifier les points bloquants',
      ],
      cta: 'Voir statistiques',
      headline: 'Comprendre la progression des apprenants.',
      summary: 'L’admin permet de suivre les performances, repérer les écarts et mesurer la réussite des parcours.',
    }
  ];

  constructor() {
    effect(() => {
      const currentUser = this.auth.user();
      if (!currentUser?.is_staff) {
        this.users.set([]);
        this.labs.set([]);
        this.courses.set([]);
        this.progress.set(null);
        return;
      }
      void this.loadAdminData();
    });
  }

  get currentModule(): () => AdminModule {
    return () => this.modules.find((module) => module.key === this.activeModule()) ?? this.modules[0];
  }

  private async loadAdminData() {
    if (!this.auth.user()?.is_staff) {
      return;
    }
    this.loading.set(true);
    this.loadError.set('');
    try {
      const [users, labs, courses, progress] = await Promise.all([
        this.api.get<AdminUserRow[]>('admin/users/'),
        this.api.get<LabSummary[]>('labs/'),
        this.api.get<CourseSummary[]>('courses/'),
        this.api.get<Progress>('progress/'),
      ]);
      this.users.set(users);
      this.labs.set(labs);
      this.courses.set(courses);
      this.progress.set(progress);
    } catch (error) {
      this.loadError.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  selectModule(moduleKey: AdminModuleKey) {
    this.activeModule.set(moduleKey);
  }

  openAdminSection(moduleKey: AdminModuleKey) {
    this.selectModule(moduleKey);
  }

  openCurrentAdminSection() {
    this.selectModule(this.activeModule());
  }
}
