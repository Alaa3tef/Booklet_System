# منظومة إنتاج البوكليت — Exam Booklet System (Angular 20 + PrimeNG)

A pixel-inspired Angular 20 (standalone components, signals) + PrimeNG 19 UI
template recreating the Ministry of Education "Exam Booklet Production
System" screens — starting with **إعداد بيانات اللجان للمادة** (Committee
Setup for a Subject): RTL layout, dark navy sidebar, ministry header, 4-step
wizard, Excel upload zone, committee preview table, and role/notes/result
side panels.

## Tech stack

- **Angular 20** — standalone components, new control-flow syntax (`@for`, `@if`), signals
- **PrimeNG 19** (`@primeng/themes` Aura preset) — Select, Table, Button, Tag
- **PrimeIcons**
- **SCSS** with CSS custom properties for the Ministry of Education color palette
- Full **RTL** (`dir="rtl"`, `lang="ar"`), Cairo font from Google Fonts

## Project structure

```
exam-booklet-system/
├── angular.json
├── package.json
├── tsconfig*.json
├── public/                          # static assets copied as-is (favicon, etc.)
├── src/
│   ├── index.html                   # dir="rtl" lang="ar", Cairo font
│   ├── main.ts
│   ├── styles.scss                  # global theme variables + PrimeNG overrides
│   └── app/
│       ├── app.component.ts/html/scss
│       ├── app.config.ts            # providers: router, animations, PrimeNG theme
│       ├── app.routes.ts
│       ├── core/
│       │   ├── models/               # NavItem, CommitteeRow, SelectOption, StepItem
│       │   └── services/             # (ready for API integration)
│       ├── layout/
│       │   ├── sidebar/              # dark navy nav with expandable groups
│       │   ├── header/               # ministry header + breadcrumb bar
│       │   └── main-layout/          # shell combining sidebar + header + router-outlet
│       ├── shared/
│       │   ├── workflow-step-layout/ # reusable hero + mini-nav + summary-bar shell
│       │   ├── workflow-mini-nav/    # the small in-card nav (الرئيسية→التقارير)
│       │   └── styles/               # _workflow-panel.scss shared partial
│       └── features/
│           ├── dashboard/            # placeholder landing page
│           ├── committee-setup/      # "إعداد بيانات اللجان" screen
│           └── workflow/             # the 5 process-stage screens
│               ├── planning/         # 01 · Planning  (مستخدم الإعداد)
│               ├── printing/         # 02 · Printing  (مستخدم الطباعة)
│               ├── quality/          # 03 · Quality   (مستخدم الجودة)
│               ├── packing/          # 04 · Packing   (مستخدم التغليف)
│               └── archiving/        # 05 · Archiving (مستخدم التخزين)
└── src/assets/
```

## Getting started

### Prerequisites
- [Node.js 20+](https://nodejs.org/)
- Angular CLI: `npm install -g @angular/cli`

### 1. Install dependencies
```bash
cd exam-booklet-system
npm install
```

### 2. Run the dev server
```bash
npm start
```
Visit `http://localhost:4200/committees/setup` to see the Committee Setup
screen from the reference design.

### 3. Build for production
```bash
npm run build
```
Output goes to `dist/exam-booklet-system`.

## What's implemented

- **Sidebar** (`app-sidebar`) — logo/title, expandable "إدارة البيانات
  الأساسية" group (المحافظات / المواد / إدارة اللجان — active state),
  top-level items (الرئيسية, إنتاج الملفات, المتابعة والتقارير, إدارة
  المستخدمين, الإعدادات), and a footer tagline.
- **Header** (`app-header`) — Ministry of Education brand block, slogan,
  notification bell with badge, user avatar/name/role, and a breadcrumb bar
  driven by an `@Input() breadcrumbs` array.
- **Committee Setup page** (`app-committee-setup`):
  - Hero banner with role title, gear icon, description, and a checklist card.
  - 4-step wizard (اختيار المحافظة والمادة → رفع ملف اللجان → مراجعة
    البيانات → إنشاء الملفات) with active/done/pending states driven by a
    `signal<StepItem[]>`.
  - Governorate / Subject / Round dropdowns (`p-select`) bound with
    `[(ngModel)]`.
  - Excel upload zone: native file input styled as a button, uploaded-file
    chip with size, and a "download template" action.
  - Committee preview table (`p-table`) with a status pill column (صحيح/خطأ),
    computed totals (عدد اللجان / عدد البوكليتات) via Angular `computed()`.
  - Cancel / "تم إنشاء الملفات" actions.
  - Side column: دور المستخدم (role card), الخيارات المتاحة (checklist),
    ملاحظة (Excel column requirements), and a conditional النتيجة success card.

## Workflow stage pages (01–05)

Five numbered process-stage screens, matching the reference designs, all
built on one shared component so the hero banner / mini in-card nav /
bottom "الوظيفة · الأساسي · خيارات النظام · النتيجة" bar stay consistent:

| # | Route | Component | Theme | Key interaction |
|---|---|---|---|---|
| 01 | `/workflow/planning` | `PlanningComponent` | blue | Governorate/Subject selects → "تحويل إلى جاهز للطباعة" |
| 02 | `/workflow/printing` | `PrintingComponent` | green | Governorate/Subject selects → "تم الانتهاء من الطباعة" |
| 03 | `/workflow/quality` | `QualityComponent` | navy | QR scan block → "تم المراجعة" / "مرفوض" |
| 04 | `/workflow/packing` | `PackingComponent` | purple | QR scan block → "تم التغليف" |
| 05 | `/workflow/archiving` | `ArchivingComponent` | teal | المنطقة/الرف/الخانة selects + QR scan → "تأكيد التخزين" |

Shared building blocks:

- **`app-workflow-step-layout`** (`shared/workflow-step-layout`) — renders
  the numbered gradient hero banner (color driven by a `theme` input:
  `blue`/`green`/`navy`/`purple`/`teal`), the white main panel (mini-nav +
  projected `[panel-content]`), and the 4-column summary bar (function /
  essentials list / projected `[system-options]` buttons / result). Each
  stage component only supplies its own form fields, table and buttons via
  content projection — no duplicated banner/summary markup.
- **`app-workflow-mini-nav`** (`shared/workflow-mini-nav`) — the small
  vertical icon list (الصفحة الرئيسية → التقارير) shown inside every stage
  card, with the active item highlighted in the page's theme color.
- **`shared/styles/_workflow-panel.scss`** — shared field-grid/table-section
  styles imported by each stage's own `.scss` file.

The sidebar's الإعداد / الطباعة / الجودة / التغليف / التخزين items now link
to these five routes, and the dashboard has quick-link buttons to all five.

## Wiring to a real backend

Every place you'd plug in an API call is already isolated:

- `CommitteeSetupComponent.onFileSelected()` — replace the local file read
  with an upload to your backend (e.g. multipart POST to
  `/api/committees/import`).
- `CommitteeSetupComponent.downloadTemplate()` — point to your template
  download endpoint.
- `CommitteeSetupComponent.createFiles()` — call the "generate booklet
  files" endpoint and update `filesGenerated`/`steps` from the response.
- `rows`, `governorates`, `subjects`, `rounds` — currently static signals/
  arrays; swap for `HttpClient` calls in a service under `core/services/`.

## Notes

- This was generated as a standalone Angular 20 project scaffold (not run
  through `ng new`/`npm install` in this environment, so no `node_modules`
  is bundled). Run `npm install` locally before `npm start`.
- The visual design (colors, spacing, RTL layout, Cairo font) is a close
  recreation of the provided reference screenshot, built with hand-written
  SCSS rather than a pre-made admin template.
