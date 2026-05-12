# CLAUDE.md

> Documento de contexto para o Claude Code. Mantém estado do projeto entre sessões. Atualize quando houver mudanças estruturais relevantes.

## 1. Visão Geral do Projeto

- **Nome**: DancArte SaaS (no `package.json` aparece como `react-example`, mas o nome real está em `metadata.json` e na UI)
- **Domínio**: Sistema de gestão para escola de dança (foco em escolas com público predominantemente feminino — todas as UIs usam "aluna/turmas")
- **Objetivo de negócio**: Controle de alunos, turmas, financeiro (mensalidades + cobranças extras), frequência e agenda semanal de aulas
- **Estado atual**: Em desenvolvimento ativo / MVP. Funções de Professores, Comunicação e Relatórios são mostradas no sidebar mas exibem placeholder "Módulo em desenvolvimento" (`src/App.tsx:101-105`).
- **Usuários-alvo**: Proprietária / gestora da escola. UI fixa exibe "Amanda Venz — Proprietária" no header (`src/components/layout/Header.tsx:32-36`). Não há separação de roles no momento — qualquer usuário autenticado tem acesso completo.
- **Hospedagem**: Vercel (configurado SPA rewrite em `vercel.json`). Original gerado pelo Google AI Studio (`https://ai.studio/apps/14d2cb7c-db57-444b-8300-6c8a0433c611`).

## 2. Stack Técnica

- **Linguagem**: TypeScript 5.8 (`tsconfig.json`)
- **Frontend framework**: React 19 (`package.json:26-27`)
- **Bundler / Dev server**: Vite 6 (`vite.config.ts`)
- **Estilização**: TailwindCSS 4 via plugin Vite (`@tailwindcss/vite`), com tema customizado em `src/index.css` (cores `primary`, `secondary`, `accent`)
- **Animações**: `motion` (sucessor do framer-motion)
- **Ícones**: `lucide-react`
- **Utilitários**: `clsx` + `tailwind-merge` via helper `cn()` em `src/lib/utils.ts`
- **Backend**: **Não há backend próprio**. Todas as operações de dados vão direto do front para o **Supabase** (`@supabase/supabase-js` v2)
- **Servidor de produção**: Express 4 + `tsx` apenas para servir o build estático (`server.ts`). Os endpoints `/api/students` e `/api/stats` no `server.ts` são **mocks não utilizados** pelo frontend.
- **AI (opcional, não usado no código atual)**: `@google/genai` declarado nas deps, mas não há import em código
- **Gerenciador de pacotes**: npm (existe `package-lock.json`)
- **Runtime**: Node.js (não há `engines` no package.json)

## 3. Estrutura de Pastas

```
dancartev2/                       ← raiz real do projeto (o diretório pai apenas a contém)
├── server.ts                     # Express dev/prod server (serve Vite ou /dist)
├── index.html                    # Entry HTML (título: "My Google AI Studio App")
├── vite.config.ts                # Vite + Tailwind + alias @/* → ./
├── tsconfig.json                 # TS config (noEmit, allowImportingTsExtensions)
├── vercel.json                   # SPA rewrite
├── metadata.json                 # Nome/descrição do app
├── .env.example                  # Variáveis Gemini (legado AI Studio)
├── package.json                  # scripts: dev, build, preview, lint, start
├── ts-errors.txt                 # Log de erros TS (legado, codificado em UTF-16)
└── src/
    ├── main.tsx                  # ReactDOM bootstrap
    ├── App.tsx                   # Roteamento manual via useState (sem react-router)
    ├── index.css                 # Tailwind v4 + tema custom (@theme)
    ├── types.ts                  # Tipos legados (Student/DashboardStats) – NÃO refletem schema real
    ├── vite-env.d.ts
    ├── assets/Logotipo.png
    ├── lib/
    │   ├── supabase.ts           # Cliente Supabase (lê VITE_SUPABASE_URL/ANON_KEY)
    │   ├── useConfigOptions.ts   # Hook + seed de defaults para config_options
    │   └── utils.ts              # cn() helper
    ├── components/layout/
    │   ├── Layout.tsx            # Sidebar + Header + main
    │   ├── Sidebar.tsx           # Menu fixo (10 items)
    │   ├── SidebarItem.tsx
    │   └── Header.tsx            # Busca (não funcional), notificação, avatar, logout
    └── pages/
        ├── Login.tsx             # Supabase auth (signIn / signUp por e-mail+senha)
        ├── Dashboard.tsx         # KPIs, gráficos, agenda do dia, atividade recente
        ├── Students.tsx          # Listagem com busca/filtro
        ├── NewStudentForm.tsx    # Cadastro de aluna com upload de foto
        ├── StudentDetail.tsx     # Detalhe + Financeiro do aluno (aba "Financial")
        ├── Classes.tsx           # Grid de cards de turmas
        ├── NewClassForm.tsx      # Criação de turma + horários semanais
        ├── ClassDetail.tsx       # Detalhe da turma + matrícula de alunas
        ├── Financial.tsx         # Visão geral financeira (todos os alunos)
        ├── Attendance.tsx        # Chamada do dia + histórico
        ├── Agenda.tsx            # Grade semanal/mensal (visual estilo Google Calendar)
        └── Settings.tsx          # CRUD das categorias de config_options
```

## 4. Modelo de Domínio

> O **schema vive 100% no Supabase** — não há migrations, ORM ou models tipados versionados neste repo. Os tipos abaixo foram inferidos a partir dos `select`/`insert` em `src/pages/*`. **Há dois nomes diferentes para a tabela de matrícula (`student_classes` vs `class_students`)** — ver seção 20.

### 4.1 Alunos — tabela `students`

Inseridos em `src/pages/NewStudentForm.tsx:82-108`. Campos:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `owner_id` | uuid | FK para `auth.users.id` (multi-tenant via RLS implícita) |
| `full_name` | text | obrigatório |
| `birth_date` | date | nullable |
| `cpf` | text | nullable |
| `phone`, `whatsapp` | text | nullable |
| `email` | text | nullable |
| `photo_url` | text | URL assinada do bucket `student-photos` |
| `cep`, `street`, `number`, `neighborhood`, `city`, `state` | text | endereço |
| `enrollment_date` | date | data de matrícula |
| `plan` | text | label do `config_options` categoria `plan` (ex: "2x/semana") |
| `custom_value` | numeric | mensalidade individual em R$ |
| `due_day` | int (1–31) | dia do vencimento — em `StudentDetail.tsx:103` faz `Math.min(due_day, 28)` |
| `acquisition_channel` | text | "Instagram", "Indicação"… |
| `status` | text | "Ativo" / "Inativo" — também aparece "Cancelado"/"cancelado" filtrado em Dashboard (`Dashboard.tsx:187-189`) — **inconsistência: NewStudentForm só oferece Ativo/Inativo** |
| `responsible_name`, `responsible_cpf`, `responsible_phone` | text | dados do responsável legal (menor de idade) |
| `medical_notes`, `general_notes` | text | observações |
| `created_at` | timestamptz | usado em "Atividade Recente" |

### 4.2 Turmas — tabela `classes`

Inseridas em `src/pages/NewClassForm.tsx:62-77`:

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `owner_id` | uuid | |
| `name` | text | obrigatório (ex: "Ballet Infantil - Terça") |
| `modality` | text | label do `config_options` `modality` |
| `level` | text | "Iniciante", "Intermediário", "Avançado", "Pré-profissional", "Livre" (hardcoded em `NewClassForm.tsx:17`) |
| `teacher` | text | nome do(a) professor(a) — **NÃO há tabela `teachers`**; é apenas string livre |
| `room` | text | sala/local |
| `max_capacity` | int | default 20 |
| `min_age`, `max_age` | int | nullable |
| `is_active` | boolean | default true |

### 4.3 Horários das turmas — tabela `class_schedules`

Inseridos em `NewClassForm.tsx:82-91`. Uma turma pode ter múltiplos horários semanais.

| Campo | Tipo |
|---|---|
| `id` | uuid |
| `class_id` | uuid → `classes.id` |
| `weekday` | int (0=Domingo … 6=Sábado) |
| `start_time` | time |
| `end_time` | time |

### 4.4 Matrícula aluno↔turma — **tabelas com nomes inconsistentes**

> Ver seção 20. Dois nomes diferentes aparecem em queries do código:

- `student_classes` — usado em `Dashboard.tsx:202, 266-268, 312`, `Agenda.tsx:187`
- `class_students` — usado em `Classes.tsx:33, 104`, `ClassDetail.tsx:98-102, 113, 158`, `Attendance.tsx:158, 185`

Em ambos os usos a forma é `{ class_id, student_id, status: 'active' }`. **É necessário confirmar no Supabase qual é o nome real, ou se há de fato duas tabelas (improvável).**

### 4.5 Mensalidades — tabela `payments`

Inserido em `StudentDetail.tsx:122-130` e `Financial.tsx:159-168`:

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `owner_id`, `student_id` | uuid | |
| `reference_month` | text | Ex: "Março/2026" (mês de competência) ou descrição livre para cobranças extras |
| `due_date` | date | vencimento |
| `paid_date` | date | quando foi pago |
| `amount` | numeric | valor da cobrança |
| `paid_amount` | numeric | valor efetivamente pago (pode diferir) |
| `status` | text | `Pago` / `Pendente` / `Atrasado` / `Cancelado` |
| `payment_method` | text | "PIX", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Transferência" (hardcoded) |
| `type` | text | "Mensalidade" ou label do `config_options` `extra_charge` (Uniforme, Figurino, Evento, Material, Matrícula) |
| `description` | text | descrição da cobrança extra |
| `notes` | text | |

**Regra observada**: status passa para `Atrasado` automaticamente quando `due_date < hoje` e `status === 'Pendente'` (`Financial.tsx:97-104` — executa `update` para cada item no client side a cada render — ver seção 20).

### 4.6 Frequência — tabela `attendance`

Queried em `Attendance.tsx:157`. Schema inferido:

| Campo | Tipo | Notas |
|---|---|---|
| `class_id` | uuid | |
| `student_id` | uuid | |
| `date` | date | |
| `status` | text | `present` / `absent` / `late` / `justified` (inglês — diverge de payments que é português) |
| `notes` | text | justificativa |

### 4.7 Configurações dinâmicas — tabela `config_options`

Gerenciada em `Settings.tsx` e usada via `useConfigOptions(category)` (`src/lib/useConfigOptions.ts`). Permite que o usuário customize listas de seleção sem mexer no código.

| Campo | Tipo |
|---|---|
| `id`, `owner_id` | uuid |
| `category` | text — uma de: `modality`, `extra_charge`, `plan`, `acquisition_channel` |
| `label` | text |
| `sort_order` | int |
| `is_active` | boolean |

**Auto-seed**: se um usuário não tem opções de uma categoria, o hook insere automaticamente os defaults (`useConfigOptions.ts:12-17` e `Settings.tsx:21-26`).

### 4.8 Storage — bucket `student-photos`

Usado em `NewStudentForm.tsx:69-79`. Upload em `{user.id}/{timestamp}.{ext}` e geração de URL assinada com TTL de **1 ano**.

### 4.9 Entidades NÃO modeladas (apesar de aparecerem no menu)

- **Professores**: existe apenas como string em `classes.teacher`. Sidebar mostra item "Professores" (`Sidebar.tsx:22`) mas a rota cai no fallback "Módulo em desenvolvimento".
- **Comunicação** (WhatsApp/e-mail): só placeholder no menu.
- **Relatórios**: só placeholder no menu.
- **Eventos / apresentações / recitais**: não modelados. O conceito mais próximo é `extra_charge` tipo "Evento" / "Figurino" em `payments`.
- **Rematrícula**: não modelada explicitamente.

## 5. Fluxos Principais

1. **Login / Cadastro** (`src/pages/Login.tsx`): e-mail + senha via `supabase.auth.signInWithPassword` / `signUp`. Sem confirmação de e-mail forçada no UI.
2. **Cadastro de aluna**: form único em `NewStudentForm.tsx` → upload de foto → `students.insert`.
3. **Criação de turma**: `NewClassForm.tsx` → insere em `classes` → insere N linhas em `class_schedules` (uma por dia da semana selecionado).
4. **Matrícula em turma**: `ClassDetail.tsx` aba "Alunas" — lista todos os alunos `status='Ativo'` que ainda não estão na turma e permite adicionar.
5. **Geração em massa de mensalidades**: em `Financial.tsx` (`handleGenerate`) ou `StudentDetail.tsx` (`handleGenerate`). Usuário escolhe ano + meses + alvo (todos / individual). Sistema cria registros em `payments` com `type='Mensalidade'`, evitando duplicatas via `select` prévio.
6. **Cobrança extra**: modal "Cobrança Extra" cria N parcelas em `payments` (uma por mês de vencimento) com `type` do `config_options.extra_charge`.
7. **Registrar pagamento**: muda status para `Pago`, grava `paid_date`, `paid_amount` (= amount), `payment_method`.
8. **Chamada do dia**: `Attendance.tsx` aba "Chamada do Dia" — para cada `class_schedule` do `weekday` atual, carrega matriculados (`class_students`) e permite marcar status presente/ausente/atrasado/justificado.
9. **Agenda semanal**: `Agenda.tsx` desenha grade tipo Google Calendar com cores por modalidade. Clicar numa aula abre modal com lista de alunas matriculadas.
10. **Dashboard**: agrega KPIs (alunos ativos, receita do mês, inadimplência, ocupação média, aulas hoje), gráfico de receita de 6 meses, donut de modalidades, agenda do dia, mensalidades atrasadas e atividade recente. Recarrega a cada 5 min (`Dashboard.tsx:364`).

## 6. Arquitetura

- **Padrão**: SPA React stateful, **sem camada de domínio**. Cada `page` faz seus próprios `supabase.from(...)` diretamente. Não existe `services/`, `repositories/` nem hooks de dados genéricos (à exceção de `useConfigOptions`).
- **Estado global**: nenhum. Roteamento e seleção (selectedStudentId, selectedClassId) são `useState` em `App.tsx`.
- **Roteamento**: manual via switch encadeado em `App.tsx:66-106`. **Não usa react-router** — não há deep-linking, URLs nunca mudam, refresh perde contexto.
- **Camadas**:
  - `lib/supabase.ts` — singleton do cliente
  - `lib/useConfigOptions.ts` — único hook reusável
  - `pages/*` — concentram lógica de UI, fetching e mutations
  - `components/layout/*` — apenas chrome (sidebar, header)
- **Multi-tenancy**: implícita via `owner_id = auth.user.id` em todos os inserts. Os `select` **não filtram por `owner_id`** — depende inteiramente de **Row Level Security (RLS) no Supabase** estar configurada. Não há documentação dessa RLS no repo.
- **Nomenclatura**:
  - Arquivos e componentes: `PascalCase.tsx`
  - Hooks: `camelCase` começando com `use`
  - Tabelas Supabase: `snake_case`
  - Strings de UI: português brasileiro
  - Constantes hardcoded de UI (cores, dias, meses): definidas no topo de cada arquivo, não centralizadas

## 7. APIs e Rotas

- **Backend HTTP real**: nenhum. Os endpoints em `server.ts` (`/api/health`, `/api/students`, `/api/stats`) servem dados mock e **não são consumidos pelo frontend** — podem ser considerados código morto.
- **Rotas de UI** (são `activeTab` strings, não URLs): `dashboard`, `students`, `new-student`, `classes`, `new-class`, `financial`, `attendance`, `agenda`, `teachers` (placeholder), `communication` (placeholder), `reports` (placeholder), `settings`.
- **Acesso a dados**: cliente Supabase consumindo direto as tabelas listadas na seção 4.

## 8. Banco de Dados

- **SGBD**: PostgreSQL via Supabase.
- **Migrations**: **não existem no repo**. Schema é mantido manualmente no painel do Supabase.
- **Tabelas (resumo)**:
  - `students`, `classes`, `class_schedules`, `payments`, `attendance`, `config_options`
  - `student_classes` **e/ou** `class_students` (matrícula — ver seção 20)
- **Relações-chave**:
  - `students.owner_id → auth.users.id`
  - `classes.owner_id → auth.users.id`
  - `class_schedules.class_id → classes.id`
  - `(student_classes|class_students).{class_id, student_id} → classes.id, students.id`
  - `payments.student_id → students.id`
  - `attendance.{class_id, student_id, date}`
- **Storage**: bucket `student-photos`.

## 9. Autenticação e Autorização

- **Mecanismo**: Supabase Auth (`supabase.auth.signInWithPassword`, `signUp`, `signOut`, `onAuthStateChange`) — `src/App.tsx:30-50` e `src/pages/Login.tsx`.
- **Sessão**: gerenciada pelo SDK (cookies/localStorage). Estado de auth em `App.tsx` é a única gate — sem rota protegida, sem layout privado/público separado.
- **Roles**: nenhuma. Todo usuário autenticado vê tudo.
- **Autorização real**: depende de **Row Level Security** configurada manualmente no Supabase (esperado: `owner_id = auth.uid()`). Isso não está documentado no repo.

## 10. Integrações Externas

- **Supabase**: única integração obrigatória (DB + Auth + Storage).
- **Google Gemini (`@google/genai`)**: dependência declarada mas **sem uso no código**. Vem do template AI Studio.
- **WhatsApp / E-mail / Gateway de pagamento**: nenhuma integração. Os "métodos de pagamento" (`PIX`, `Cartão`…) são apenas labels gravados como string, sem conexão com gateway real.

## 11. Configuração e Variáveis de Ambiente

`.env.example` ainda contém apenas legados do AI Studio (`GEMINI_API_KEY`, `APP_URL`). As variáveis **realmente exigidas em runtime** estão em `src/lib/supabase.ts:3-8`:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | sim | URL do projeto Supabase (ex.: `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | sim | Chave pública anon do Supabase |
| `GEMINI_API_KEY` | não | Declarada no `.env.example` mas não usada no código |
| `APP_URL` | não | Declarada no `.env.example` mas não usada no código |
| `DISABLE_HMR` | não | Se `'true'`, desabilita HMR (workaround AI Studio) — `vite.config.ts:21` |

> **Atenção**: o `.env.example` precisa ser atualizado para refletir as variáveis Supabase reais.

## 12. Como Rodar Localmente

```bash
cd dancartev2
npm install

# Criar .env (NÃO commitar — .gitignore já cobre .env*)
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...

npm run dev      # Inicia Express + Vite middleware em http://localhost:3000
npm run build    # vite build → /dist
npm run preview  # vite preview do /dist
npm run lint     # tsc --noEmit (única "validação")
npm run start    # node server.ts (modo produção, exige dist/ pronto)
```

## 13. Testes

- **Framework de testes**: **nenhum**. Não há Jest, Vitest, Playwright, Cypress, nem pasta `__tests__` / `*.test.ts` / `*.spec.ts`.
- **Cobertura**: 0%.
- **Único "lint"**: `npm run lint` que é `tsc --noEmit` (apenas typecheck).

## 14. Convenções do Projeto

- **Linter / Formatter**: não há ESLint nem Prettier configurados.
- **TS strict**: **desligado**. `tsconfig.json` não tem `strict: true` nem `noImplicitAny`. `useDefineForClassFields: false`.
- **Estilo de código observado**:
  - Tudo em TS + JSX.
  - Componentes funcionais com `useState`/`useEffect`.
  - Estilização inline com classes Tailwind (cores `primary`, `secondary`, `accent` do `@theme` em `index.css`).
  - Funções helper (formatadores BRL, cores por modalidade) **duplicadas** em vários arquivos (`Dashboard.tsx`, `Attendance.tsx`, `Agenda.tsx`).
  - Sem barrels (`index.ts`). Imports nominais explícitos.
- **Nomes**:
  - Tabelas: `snake_case`
  - Campos de UI: `camelCase` (`studentName`, `dueDay`)
  - Constantes: `SCREAMING_SNAKE_CASE` (`MONTHS`, `WEEKDAYS`)
- **Commit conventions**: nenhuma — não é um repositório git ativo (raiz é `Is a git repository: false`).

## 15. Pontos de Atenção e Dívida Técnica

1. **Duas tabelas com mesma semântica**: `student_classes` (Dashboard, Agenda) vs `class_students` (Classes, ClassDetail, Attendance). Quase certamente bug — uma das telas pode estar lendo tabela vazia/errada. Investigar urgente no Supabase.
2. **Sem roteamento real**: `App.tsx` usa `useState` para a aba ativa — refresh de página perde contexto, sem deep-link, sem `<title>` dinâmico. Toda a navegação é client-side puro com prop drilling.
3. **`src/types.ts`** define `Student` com campos completamente diferentes do schema real (`id: number`, `class: string`, `payment: 'Em dia'…`). É legado do mock — confunde quem lê.
4. **Server.ts mock data**: endpoints `/api/students` e `/api/stats` no Express com dados estáticos não usados por ninguém. Código morto.
5. **`Financial.tsx:97-104`**: a cada render, dispara N `update` no Supabase para marcar pagamentos vencidos como `Atrasado`. Isso deveria ser um cron/trigger no Postgres (RPC) — atualmente gera escrita excessiva e race conditions.
6. **Helpers duplicados**: `MODALITY_COLORS`, `WEEKDAYS`, `MONTHS`, `fmtBRL`, `fmtTime`, `hashColor` repetidos em 3–4 arquivos. Extrair para `lib/`.
7. **Sem RLS documentada**: a segurança de multi-tenancy depende inteiramente de policies do Supabase que não estão neste repo. Um `select * from students` sem `eq('owner_id', user.id)` vazaria dados de outros tenants se a RLS estiver desligada.
8. **Sem confirmação no `delete`** (ex.: `Settings.tsx:82` apaga categoria sem prompt).
9. **`teacher` é só string**: sem tabela própria, qualquer typo cria um "novo professor" diferente. Sidebar promete módulo "Professores" inexistente.
10. **Tipos `any[]`** abundantes em queries Supabase (ex.: `Dashboard.tsx:265-280`). Sem `Database` types gerados.
11. **`ts-errors.txt`** já registra erro existente em `SidebarItem.tsx` (prop `key` não declarada em `SidebarItemProps`). Arquivo está em UTF-16, difícil de ler.
12. **`README.md`** ainda é o template original do AI Studio — não documenta o projeto real.
13. **`index.html` título**: "My Google AI Studio App" — não foi customizado.
14. **`.env.example` desatualizado** — não menciona as variáveis Supabase, só legado Gemini.
15. **Status inconsistente**: `students.status` aparece como `Ativo|Inativo` em formulários, mas Dashboard filtra também `Cancelado` (`Dashboard.tsx:187-189`); `class_students.status` é em inglês (`'active'`); `payments.status` em português (`Pago/Pendente/...`); `attendance.status` em inglês (`present/absent/...`). Dificulta queries cross-tabela.
16. **`student-photos` signed URL com TTL de 1 ano** (`NewStudentForm.tsx:77`). Não há mecanismo para renovar — após 1 ano, fotos quebram.
17. **Realtime do Supabase**: não usado em lugar nenhum — Dashboard faz polling a cada 5 min.
18. **Sem error boundaries**, sem toast global, sem confirmação de operações destrutivas em massa.

## 16. Decisões de Arquitetura Inferidas

- **"Backendless"**: optaram por Supabase para zerar manutenção de backend. Coerente com escala de uma escola pequena.
- **Config dinâmica via `config_options`**: a usuária pode editar modalidades / planos / canais sem deploy — bom UX para o domínio.
- **Sem react-router**: provavelmente para acelerar prototipagem; deve ser revisto se o produto crescer.
- **Cores por modalidade**: hardcoded em 3 arquivos como padrão visual — sugere que modalidades novas (criadas em Settings) caem num fallback de cor genérica. Decisão coerente com baixa cardinalidade do conjunto.
- **Geração de mensalidades em massa via UI**: tarefa de cron movida para o usuário, evitando jobs server-side.
- **Polling de 5 min no Dashboard**: alternativa pragmática a websockets/realtime.

## 17. Roadmap Aparente

Pelo sidebar e código:
- **Professores** (módulo a construir — virar tabela real)
- **Comunicação** (envio de avisos/WhatsApp/e-mail aos responsáveis)
- **Relatórios** (analytics estendidos)
- **Multi-usuário com roles** (proprietária, secretária, professor)
- **Deep-linking** (migrar para react-router)
- **Renovação automática de URLs de foto** ou migrar para URL pública

Nenhuma branch git ativa — não há sinais adicionais de roadmap em comentários TODO/FIXME (poucos TODOs no código).

## 18. Diretrizes para o Claude em Futuras Sessões

- **A raiz do projeto é `dancartev2/`**, não o diretório pai. Sempre operar dentro dela.
- Antes de criar/alterar query Supabase, **verificar se a tabela de matrícula é `student_classes` ou `class_students`** (ver seção 20) — perguntar ao usuário em caso de dúvida.
- Ao criar nova entidade ou tela, **espelhar o padrão de `Students.tsx` + `NewStudentForm.tsx` + `StudentDetail.tsx`** (lista + form + detalhe), não introduzir camadas de service/repository sem alinhar com o usuário.
- **Sempre usar `owner_id: user.id`** ao inserir, mesmo que RLS bloqueie — evita confusão em queries futuras.
- Para listas de seleção (modalidade, plano, etc.), **usar `useConfigOptions(category)`** em vez de hardcoded.
- **Não criar migrations locais** — não há esse fluxo. Mudanças de schema acontecem no painel Supabase; documente-as aqui.
- **Tailwind v4** — usar variáveis do `@theme` em `index.css` (`text-primary`, `bg-secondary`, etc.).
- **`npm run lint`** (apenas `tsc --noEmit`) é o único smoke test antes de entregar mudanças — rodar sempre.
- Não há testes — UI changes precisam ser **validadas manualmente no `npm run dev`**.
- Evitar duplicar helpers (cores de modalidade, formatadores) — preferir extrair para `src/lib/` quando tocar mais de um arquivo.
- **Strings em português brasileiro**, status em PT no domínio de pagamentos e EN no de frequência (manter padrão existente até decisão de unificação).
- Antes de propor refactor estrutural (roteamento, services, RLS), **explicar trade-offs e perguntar**.

## 19. Glossário de Negócio

- **Aluna / Aluno**: pessoa matriculada (UI predominantemente feminina: "Nova Aluna", "Alunas Matriculadas").
- **Turma** (`class`): combinação de modalidade + nível + horário(s) + sala + professor.
- **Modalidade**: estilo de dança (Ballet Clássico, Jazz, Contemporâneo, Hip-Hop, Sapateado, Dança do Ventre, Forró, Samba, K-Pop, Stiletto, Baby Class).
- **Nível**: Iniciante / Intermediário / Avançado / Pré-profissional / Livre.
- **Plano**: pacote de mensalidade ("1x/semana", "2x/semana", "3x/semana", "Livre").
- **Mensalidade**: pagamento mensal recorrente (`payments.type = 'Mensalidade'`).
- **Cobrança extra**: pagamento avulso ou parcelado para itens como Uniforme, Figurino, Evento, Material, Matrícula.
- **Inadimplência**: % de pagamentos com `status='Atrasado'` ou (`status='Pendente'` e `due_date < hoje`) no mês.
- **Ocupação**: razão `alunas_matriculadas / max_capacity` da turma.
- **Chamada**: registro de presença diária de uma turma.
- **Aquisição** (`acquisition_channel`): canal pelo qual o aluno chegou à escola.
- **Responsável**: adulto responsável legal/financeiro pelo aluno menor.

## 20. Alertas Encontrados Durante a Análise

1. **CRÍTICO — Inconsistência de tabela de matrícula**: o código alterna entre `student_classes` (Dashboard, Agenda) e `class_students` (Classes, ClassDetail, Attendance). **Pode causar dados inconsistentes entre telas**. Verificar no painel Supabase e padronizar.
2. **Possível write storm em `Financial.tsx:97-104`**: loop que faz `update` no Supabase a cada render para marcar pagamentos como `Atrasado`. Move para função no Postgres ou cron.
3. **`src/types.ts` legado**: tipos definidos lá não correspondem ao schema real. Pode induzir devs a erro. Remover ou substituir por tipos gerados pelo Supabase CLI.
4. **`server.ts` contém dados mock hardcoded** (`Ana Paula Oliveira`, `Beatriz Silva`, etc. — `server.ts:18-23`) — não são PII reais, mas o endpoint não é usado e deveria ser removido.
5. **Multi-tenancy depende de RLS não-documentada**: nenhum `select` filtra por `owner_id`. Se RLS estiver desligada no Supabase, **qualquer usuário vê todos os dados**. Necessário auditar policies.
6. **Signed URL de fotos com TTL de 1 ano** sem renovação — fotos quebram em 12 meses (`NewStudentForm.tsx:77`).
7. **`.gitignore` excluí `.env*` mas o arquivo `.env` real existe localmente** — confirmar que não está versionado em algum remoto eventual.
8. **README e `index.html` ainda contêm metadados do template AI Studio** — substituir antes de qualquer apresentação pública.
9. **Erro TS pré-existente** em `Sidebar.tsx:48` (prop `key` em `SidebarItemProps`) — documentado em `ts-errors.txt`.
10. **Inconsistência case-sensitive em `students.status`**: `Dashboard.tsx:187` filtra `("Inativo","inativo","Cancelado","cancelado")` — sugere que dados reais têm capitalização inconsistente, ou que houve refactor incompleto.

---
*Última atualização automática: 2026-05-11*
*Gerado a partir de varredura completa do codebase em `dancartev2/`.*
