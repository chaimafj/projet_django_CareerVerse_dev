import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { ApiService, errorMessage } from '../core/api.service';
import { TranslatePipe } from '../core/locale.service';
import { AuthService } from '../core/auth.service';
import { CourseSummary, Progress, User } from '../core/models';
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

type AdminUserRow = Pick<User, 'id' | 'email' | 'name' | 'role' | 'is_staff' | 'is_superuser'> & { is_active: boolean };

type AdminUserDraft = {
  email: string;
  name: string;
  password: string;
  role: User['role'];
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
};

type AdminCareerRow = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  tools: string[];
  interests: string[];
  salary: string;
  education: string;
  outlook: string;
};

type AdminCareerDraft = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  tools: string;
  interests: string;
  salary: string;
  education: string;
  outlook: string;
};

type AdminLabRow = {
  id: number;
  career_id: number;
  career_title: string;
  title: string;
  level: number;
  scenario: string;
  objectives: string[];
  expected_seconds: number;
  is_premium: boolean;
  question_count: number;
};

type AdminLabDraft = {
  career_id: string;
  title: string;
  level: number;
  scenario: string;
  objectives: string;
  expected_seconds: number;
  is_premium: boolean;
};

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
              <button type="button" class="menu-item" [class.active]="activeModule() === item.key" (click)="selectModule(item.key)">
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
              <p>{{ 'Loading admin data...' | t }}</p>
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
                    <button type="button" class="secondary-action" (click)="openUserForm()">{{ 'Ajouter' | t }}</button>
                  </div>

                  @if (userFormOpen()) {
                    <form class="user-form" (submit)="saveUser($event)">
                      <div class="form-grid">
                        <label>
                          <span>Email</span>
                          <input type="email" [value]="userDraft().email" (input)="updateUserDraft('email', $any($event.target).value)" required />
                        </label>
                        <label>
                          <span>Nom</span>
                          <input type="text" [value]="userDraft().name" (input)="updateUserDraft('name', $any($event.target).value)" required />
                        </label>
                        <label>
                          <span>Mot de passe</span>
                          <input type="password" [value]="userDraft().password" (input)="updateUserDraft('password', $any($event.target).value)" [required]="editingUserId() === null" />
                        </label>
                        <div class="toggle-row">
                          <label class="toggle-box">
                            <span>Rôle</span>
                            <select [value]="userDraft().role" (change)="updateUserDraft('role', $any($event.target).value)">
                              <option value="student">Étudiant</option>
                              <option value="editor">Éditeur de contenu</option>
                              <option value="admin">Administrateur</option>
                            </select>
                          </label>
                          <label class="toggle-box">
                            <input type="checkbox" [checked]="userDraft().is_staff" (change)="updateUserDraft('is_staff', $any($event.target).checked)" />
                            <span>Staff</span>
                          </label>
                          <label class="toggle-box">
                            <input type="checkbox" [checked]="userDraft().is_superuser" (change)="updateUserDraft('is_superuser', $any($event.target).checked)" />
                            <span>Superuser</span>
                          </label>
                          <label class="toggle-box">
                            <input type="checkbox" [checked]="userDraft().is_active" (change)="updateUserDraft('is_active', $any($event.target).checked)" />
                            <span>Actif</span>
                          </label>
                        </div>
                      </div>

                      @if (formError()) {
                        <p class="form-error">{{ formError() }}</p>
                      }

                      <div class="form-actions">
                        <button type="button" class="ghost-action" (click)="closeUserForm()">Annuler</button>
                        <button type="submit" class="primary-action" [disabled]="savingUser()">{{ savingUser() ? 'Enregistrement…' : (editingUserId() !== null ? 'Enregistrer les changements' : 'Créer le compte') }}</button>
                      </div>
                    </form>
                  }

                  <div class="table-wrap">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Nom</th>
                          <th>Rôle</th>
                          <th>Superuser</th>
                          <th>Actif</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (user of users(); track user.id) {
                          <tr>
                            <td>{{ user.email }}</td>
                            <td>{{ user.name || '—' }}</td>
                            <td>{{ user.role }}</td>
                            <td><span class="status-pill" [class.enabled]="user.is_superuser">{{ user.is_superuser ? 'Oui' : 'Non' }}</span></td>
                            <td><span class="status-pill" [class.enabled]="user.is_active">{{ user.is_active ? 'Oui' : 'Non' }}</span></td>
                            <td class="table-actions">
                              <button type="button" class="ghost-action" (click)="editUser(user)">Modifier</button>
                              <button type="button" class="danger-btn" (click)="deleteUser(user.id, user.name || user.email)">Supprimer</button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </section>
              }
              @case ('catalog') {
                <section class="data-panel">
                  <div class="panel-header">
                    <div>
                      <span class="eyebrow">{{ 'CATALOGUE' | t }}</span>
                      <h3>{{ 'Gestion du catalogue' | t }}</h3>
                    </div>
                    <button type="button" class="secondary-action" (click)="openCareerForm()">{{ 'Ajouter un métier' | t }}</button>
                  </div>

                  @if (careerFormOpen()) {
                    <form class="user-form" (submit)="saveCareer($event)">
                      <div class="form-grid">
                        <label>
                          <span>Slug</span>
                          <input type="text" [value]="careerDraft().slug" (input)="updateCareerDraft('slug', $any($event.target).value)" required />
                        </label>
                        <label>
                          <span>Titre</span>
                          <input type="text" [value]="careerDraft().title" (input)="updateCareerDraft('title', $any($event.target).value)" required />
                        </label>
                        <label>
                          <span>Catégorie</span>
                          <input type="text" [value]="careerDraft().category" (input)="updateCareerDraft('category', $any($event.target).value)" required />
                        </label>
                        <label>
                          <span>Salaire</span>
                          <input type="text" [value]="careerDraft().salary" (input)="updateCareerDraft('salary', $any($event.target).value)" required />
                        </label>
                        <label class="full-width">
                          <span>Résumé</span>
                          <input type="text" [value]="careerDraft().summary" (input)="updateCareerDraft('summary', $any($event.target).value)" required />
                        </label>
                        <label class="full-width">
                          <span>Description</span>
                          <textarea rows="4" [value]="careerDraft().description" (input)="updateCareerDraft('description', $any($event.target).value)" required></textarea>
                        </label>
                        <label>
                          <span>Outils</span>
                          <input type="text" [value]="careerDraft().tools" (input)="updateCareerDraft('tools', $any($event.target).value)" />
                        </label>
                        <label>
                          <span>Intérêts</span>
                          <input type="text" [value]="careerDraft().interests" (input)="updateCareerDraft('interests', $any($event.target).value)" />
                        </label>
                        <label>
                          <span>Éducation</span>
                          <input type="text" [value]="careerDraft().education" (input)="updateCareerDraft('education', $any($event.target).value)" required />
                        </label>
                        <label>
                          <span>Perspectives</span>
                          <input type="text" [value]="careerDraft().outlook" (input)="updateCareerDraft('outlook', $any($event.target).value)" required />
                        </label>
                      </div>

                      @if (formError()) {
                        <p class="form-error">{{ formError() }}</p>
                      }

                      <div class="form-actions">
                        <button type="button" class="ghost-action" (click)="closeCareerForm()">Annuler</button>
                        <button type="submit" class="primary-action" [disabled]="savingCareer()">{{ savingCareer() ? 'Enregistrement…' : (editingCareerId() !== null ? 'Enregistrer les changements' : 'Créer le métier') }}</button>
                      </div>
                    </form>
                  }

                  <div class="table-wrap slim">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Métier</th>
                          <th>Catégorie</th>
                          <th>Salaire</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (career of careers(); track career.id) {
                          <tr>
                            <td>{{ career.title }}</td>
                            <td>{{ career.category }}</td>
                            <td>{{ career.salary }}</td>
                            <td class="table-actions">
                              <button type="button" class="ghost-action" (click)="editCareer(career)">Modifier</button>
                              <button type="button" class="danger-btn" (click)="deleteCareer(career.id, career.title)">Supprimer</button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </section>
              }
              @case ('content') {
                <section class="data-panel">
                  <div class="panel-header">
                    <div>
                      <span class="eyebrow">{{ 'CONTENUS' | t }}</span>
                      <h3>{{ 'Gestion des contenus & lab' | t }}</h3>
                    </div>
                    <button type="button" class="secondary-action" (click)="openLabForm()">{{ 'Ajouter un lab' | t }}</button>
                  </div>

                  @if (labFormOpen()) {
                    <form class="user-form" (submit)="saveLab($event)">
                      <div class="form-grid">
                        <label>
                          <span>Carrière</span>
                          <select [value]="labDraft().career_id" (change)="updateLabDraft('career_id', $any($event.target).value)" required>
                            <option value="">Sélectionner</option>
                            @for (career of careers(); track career.id) {
                              <option [value]="career.id">{{ career.title }}</option>
                            }
                          </select>
                        </label>
                        <label>
                          <span>Titre</span>
                          <input type="text" [value]="labDraft().title" (input)="updateLabDraft('title', $any($event.target).value)" required />
                        </label>
                        <label>
                          <span>Niveau</span>
                          <select [value]="labDraft().level" (change)="updateLabDraft('level', +$any($event.target).value)">
                            <option [value]="1">Beginner</option>
                            <option [value]="2">Intermediate</option>
                            <option [value]="3">Advanced</option>
                          </select>
                        </label>
                        <label>
                          <span>Temps (s)</span>
                          <input type="number" min="30" [value]="labDraft().expected_seconds" (input)="updateLabDraft('expected_seconds', +$any($event.target).value)" required />
                        </label>
                        <label class="full-width">
                          <span>Scénario</span>
                          <textarea rows="3" [value]="labDraft().scenario" (input)="updateLabDraft('scenario', $any($event.target).value)"></textarea>
                        </label>
                        <label class="full-width">
                          <span>Objectifs</span>
                          <input type="text" [value]="labDraft().objectives" (input)="updateLabDraft('objectives', $any($event.target).value)" />
                        </label>
                        <div class="toggle-row">
                          <label class="toggle-box">
                            <input type="checkbox" [checked]="labDraft().is_premium" (change)="updateLabDraft('is_premium', $any($event.target).checked)" />
                            <span>Premium</span>
                          </label>
                        </div>
                      </div>

                      @if (formError()) {
                        <p class="form-error">{{ formError() }}</p>
                      }

                      <div class="form-actions">
                        <button type="button" class="ghost-action" (click)="closeLabForm()">Annuler</button>
                        <button type="submit" class="primary-action" [disabled]="savingLab()">{{ savingLab() ? 'Enregistrement…' : (editingLabId() !== null ? 'Enregistrer les changements' : 'Créer le lab') }}</button>
                      </div>
                    </form>
                  }

                  <div class="table-wrap">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Lab</th>
                          <th>Carrière</th>
                          <th>Niveau</th>
                          <th>Questions</th>
                          <th>Accès</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (lab of labs(); track lab.id) {
                          <tr>
                            <td>{{ lab.title }}</td>
                            <td>{{ lab.career_title }}</td>
                            <td>{{ labLevelLabel(lab.level) }}</td>
                            <td>{{ lab.question_count }}</td>
                            <td><span class="status-pill" [class.enabled]="!lab.is_premium">{{ lab.is_premium ? 'Premium' : 'Public' }}</span></td>
                            <td class="table-actions">
                              <button type="button" class="ghost-action" (click)="editLab(lab)">Modifier</button>
                              <button type="button" class="danger-btn" (click)="deleteLab(lab.id, lab.title)">Supprimer</button>
                            </td>
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
  readonly careers = signal<AdminCareerRow[]>([]);
  readonly labs = signal<AdminLabRow[]>([]);
  readonly courses = signal<CourseSummary[]>([]);
  readonly progress = signal<Progress | null>(null);
  readonly userFormOpen = signal(false);
  readonly careerFormOpen = signal(false);
  readonly labFormOpen = signal(false);
  readonly editingUserId = signal<number | null>(null);
  readonly editingCareerId = signal<number | null>(null);
  readonly editingLabId = signal<number | null>(null);
  readonly savingUser = signal(false);
  readonly savingCareer = signal(false);
  readonly savingLab = signal(false);
  readonly formError = signal('');
  readonly userDraft = signal<AdminUserDraft>({
    email: '',
    name: '',
    password: '',
    role: 'student',
    is_staff: false,
    is_superuser: false,
    is_active: true,
  });
  readonly careerDraft = signal<AdminCareerDraft>({
    slug: '',
    title: '',
    summary: '',
    description: '',
    category: '',
    tools: '',
    interests: '',
    salary: '',
    education: '',
    outlook: '',
  });
  readonly labDraft = signal<AdminLabDraft>({
    career_id: '',
    title: '',
    level: 1,
    scenario: '',
    objectives: '',
    expected_seconds: 180,
    is_premium: false,
  });

  readonly modules: AdminModule[] = [
    { key: 'staff', title: 'Utilisateurs', subtitle: 'Comptes & permissions', icon: 'user', category: 'Gestion des utilisateurs', cardTitle: 'Gérer les comptes utilisateur', description: 'Créer, modifier, activer ou bloquer les comptes étudiants et staff.', features: ['Filtrer par email, nom, staff, superuser, actif/inactif', 'Gérer les permissions, groupes et accès', 'Voir et modifier les profils étudiants et leurs données'], cta: 'Ouvrir', headline: 'Le système de gestion des utilisateurs.', summary: 'L’admin permet de gérer les comptes, les profils étudiants, les permissions et les accès selon le rôle.' },
    { key: 'catalog', title: 'Catalogue', subtitle: 'Métiers, cours & labs', icon: 'book', category: 'Gestion du catalogue', cardTitle: 'Administrer le catalogue pédagogique', description: 'Ajouter, modifier et organiser les métiers, cours et labs.', features: ['Ajouter et modifier les carrières et leurs attributs', 'Gérer slug, résumé, catégorie, outils, intérêts et salaire', 'Relier chaque carrière aux cours et missions associées'], cta: 'Ouvrir catalogue', headline: 'Piloter le catalogue de formation.', summary: 'L’admin permet de gérer les métiers, les parcours et les contenus pédagogiques associés à chaque opportunité.' },
    { key: 'content', title: 'Contenus', subtitle: 'Questions & exercices', icon: 'lab', category: 'Gestion des contenus', cardTitle: 'Créer et éditer les contenus de formation', description: 'Gérer les questions, options, lab et activités interactives.', features: ['Créer des questions de quiz, code, architecture, evidence et sequence', 'Définir la compétence visée et le type d’exercice', 'Associer les contenus aux labs et aux parcours pédagogiques'], cta: 'Gérer contenu', headline: 'Construire des parcours d’apprentissage solides.', summary: 'Les contenus pédagogiques sont centralisés pour organiser les acquis, les activités et les évaluations du programme.' },
    { key: 'monitoring', title: 'Suivi & scores', subtitle: 'Progression & analytics', icon: 'sparkles', category: 'Suivi des résultats', cardTitle: 'Surveiller les progrès et les scores', description: 'Suivre les résultats, les tentatives et la progression globale des apprenants.', features: ['Consulter scores, tentatives et validations', 'Vérifier les résultats des labs et des cours', 'Suivre la progression et identifier les points bloquants'], cta: 'Voir statistiques', headline: 'Comprendre la progression des apprenants.', summary: 'L’admin permet de suivre les performances, repérer les écarts et mesurer la réussite des parcours.' },
  ];

  constructor() {
    effect(() => {
      const currentUser = this.auth.user();
      if (!currentUser?.is_staff) {
        this.users.set([]);
        this.careers.set([]);
        this.labs.set([]);
        this.courses.set([]);
        this.progress.set(null);
        return;
      }
      void this.loadAdminData();
    });
  }

  labLevelLabel(level: number): string {
    return {
      1: 'Beginner',
      2: 'Intermediate',
      3: 'Advanced',
    }[level] ?? 'Beginner';
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
      const [users, careers, labs, courses, progress] = await Promise.all([
        this.api.get<AdminUserRow[]>('admin/users/'),
        this.api.get<AdminCareerRow[]>('admin/careers/'),
        this.api.get<AdminLabRow[]>('admin/labs/'),
        this.api.get<CourseSummary[]>('courses/'),
        this.api.get<Progress>('progress/'),
      ]);
      this.users.set(users);
      this.careers.set(careers);
      this.labs.set(labs);
      this.courses.set(courses);
      this.progress.set(progress);
      if (!this.labDraft().career_id && careers[0]) {
        this.labDraft.update((draft) => ({ ...draft, career_id: String(careers[0].id) }));
      }
    } catch (error) {
      this.loadError.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  openUserForm(user?: AdminUserRow) {
    this.formError.set('');
    if (user) {
      this.editingUserId.set(user.id);
      this.userDraft.set({
        email: user.email,
        name: user.name,
        password: '',
        role: user.role,
        is_staff: user.is_staff,
        is_superuser: user.is_superuser ?? false,
        is_active: user.is_active,
      });
    } else {
      this.editingUserId.set(null);
      this.userDraft.set({ email: '', name: '', password: '', role: 'student', is_staff: false, is_superuser: false, is_active: true });
    }
    this.userFormOpen.set(true);
  }

  closeUserForm() {
    this.userFormOpen.set(false);
    this.editingUserId.set(null);
    this.formError.set('');
  }

  openCareerForm(career?: AdminCareerRow) {
    this.formError.set('');
    if (career) {
      this.editingCareerId.set(career.id);
      this.careerDraft.set({
        slug: career.slug,
        title: career.title,
        summary: career.summary,
        description: career.description,
        category: career.category,
        tools: career.tools.join(', '),
        interests: career.interests.join(', '),
        salary: career.salary,
        education: career.education,
        outlook: career.outlook,
      });
    } else {
      this.editingCareerId.set(null);
      this.careerDraft.set({
        slug: '', title: '', summary: '', description: '', category: '', tools: '', interests: '', salary: '', education: '', outlook: '',
      });
    }
    this.careerFormOpen.set(true);
  }

  closeCareerForm() {
    this.careerFormOpen.set(false);
    this.editingCareerId.set(null);
    this.formError.set('');
  }

  openLabForm(lab?: AdminLabRow) {
    this.formError.set('');
    if (lab) {
      this.editingLabId.set(lab.id);
      this.labDraft.set({
        career_id: String(lab.career_id),
        title: lab.title,
        level: Number(lab.level),
        scenario: lab.scenario,
        objectives: lab.objectives.join(', '),
        expected_seconds: lab.expected_seconds,
        is_premium: lab.is_premium,
      });
    } else {
      this.editingLabId.set(null);
      const defaultCareer = this.careers()[0]?.id ? String(this.careers()[0].id) : '';
      this.labDraft.set({ career_id: defaultCareer, title: '', level: 1, scenario: '', objectives: '', expected_seconds: 180, is_premium: false });
    }
    this.labFormOpen.set(true);
  }

  closeLabForm() {
    this.labFormOpen.set(false);
    this.editingLabId.set(null);
    this.formError.set('');
  }

  updateUserDraft<T extends keyof AdminUserDraft>(key: T, value: AdminUserDraft[T]) {
    this.userDraft.update((draft) => ({ ...draft, [key]: value }));
  }

  updateCareerDraft<T extends keyof AdminCareerDraft>(key: T, value: AdminCareerDraft[T]) {
    this.careerDraft.update((draft) => ({ ...draft, [key]: value }));
  }

  updateLabDraft<T extends keyof AdminLabDraft>(key: T, value: AdminLabDraft[T]) {
    this.labDraft.update((draft) => ({ ...draft, [key]: value }));
  }

  async saveUser(event: Event) {
    event.preventDefault();
    const draft = this.userDraft();
    if (this.savingUser()) return;
    this.savingUser.set(true);
    this.formError.set('');
    try {
      const payload = {
        email: draft.email.trim(),
        name: draft.name.trim(),
        password: draft.password,
        role: draft.role,
        is_staff: draft.is_staff,
        is_superuser: draft.is_superuser,
        is_active: draft.is_active,
      };
      if (this.editingUserId() !== null) {
        const userId = this.editingUserId()!;
        await this.api.patch<AdminUserRow>(`admin/users/${userId}/`, { ...payload, password: draft.password || undefined });
      } else {
        await this.api.post<AdminUserRow>('admin/users/', payload);
      }
      this.closeUserForm();
      await this.loadAdminData();
    } catch (error) {
      this.formError.set(errorMessage(error));
    } finally {
      this.savingUser.set(false);
    }
  }

  editUser(user: AdminUserRow) {
    this.openUserForm(user);
  }

  async saveCareer(event: Event) {
    event.preventDefault();
    const draft = this.careerDraft();
    if (this.savingCareer()) return;
    this.savingCareer.set(true);
    this.formError.set('');
    try {
      const tools = draft.tools.split(',').map((item) => item.trim()).filter(Boolean);
      const interests = draft.interests.split(',').map((item) => item.trim()).filter(Boolean);
      const payload = {
        slug: draft.slug.trim(),
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        description: draft.description.trim(),
        category: draft.category.trim(),
        tools,
        interests,
        salary: draft.salary.trim(),
        education: draft.education.trim(),
        outlook: draft.outlook.trim(),
      };
      if (this.editingCareerId() !== null) {
        await this.api.patch<AdminCareerRow>(`admin/careers/${this.editingCareerId()}/`, payload);
      } else {
        await this.api.post<AdminCareerRow>('admin/careers/', payload);
      }
      this.closeCareerForm();
      await this.loadAdminData();
    } catch (error) {
      this.formError.set(errorMessage(error));
    } finally {
      this.savingCareer.set(false);
    }
  }

  editCareer(career: AdminCareerRow) {
    this.openCareerForm(career);
  }

  async saveLab(event: Event) {
    event.preventDefault();
    const draft = this.labDraft();
    if (this.savingLab()) return;
    this.savingLab.set(true);
    this.formError.set('');
    try {
      const objectives = draft.objectives
        .split(/\r?\n|,/) 
        .map((item) => item.trim())
        .filter(Boolean);
      const payload = {
        career_id: Number(draft.career_id),
        title: draft.title.trim(),
        level: Number(draft.level),
        scenario: draft.scenario.trim(),
        objectives,
        expected_seconds: Number(draft.expected_seconds),
        is_premium: draft.is_premium,
      };
      if (this.editingLabId() !== null) {
        await this.api.patch<AdminLabRow>(`admin/labs/${this.editingLabId()}/`, payload);
      } else {
        await this.api.post<AdminLabRow>('admin/labs/', payload);
      }
      this.closeLabForm();
      await this.loadAdminData();
    } catch (error) {
      this.formError.set(errorMessage(error));
    } finally {
      this.savingLab.set(false);
    }
  }

  editLab(lab: AdminLabRow) {
    this.openLabForm(lab);
  }

  async deleteUser(userId: number, userName: string) {
    if (this.auth.user()?.id === userId) {
      this.formError.set('Vous ne pouvez pas supprimer votre propre compte administrateur.');
      return;
    }
    const confirmed = window.confirm(`Supprimer le compte ${userName} ?`);
    if (!confirmed) return;
    this.formError.set('');
    try {
      await this.api.delete(`admin/users/${userId}/`);
      await this.loadAdminData();
    } catch (error) {
      this.formError.set(errorMessage(error));
    }
  }

  async deleteCareer(careerId: number, careerTitle: string) {
    const confirmed = window.confirm(`Supprimer le métier ${careerTitle} ?`);
    if (!confirmed) return;
    this.formError.set('');
    try {
      await this.api.delete(`admin/careers/${careerId}/`);
      await this.loadAdminData();
    } catch (error) {
      this.formError.set(errorMessage(error));
    }
  }

  async deleteLab(labId: number, labTitle: string) {
    const confirmed = window.confirm(`Supprimer le lab ${labTitle} ?`);
    if (!confirmed) return;
    this.formError.set('');
    try {
      await this.api.delete(`admin/labs/${labId}/`);
      await this.loadAdminData();
    } catch (error) {
      this.formError.set(errorMessage(error));
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
