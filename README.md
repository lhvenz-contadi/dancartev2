# DancArte SaaS

Sistema de gestão para escola de dança. Stack: React 19 + Vite + TailwindCSS 4 + Supabase.

## Setup

1. `npm install`
2. Copiar `.env.example` → `.env` e preencher `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. `npm run dev`

## Scripts

- `npm run dev` — Servidor dev em `localhost:3000`
- `npm run build` — Build de produção em `/dist`
- `npm run lint` — Typecheck (`tsc --noEmit`)
- `npm run preview` — Preview do build

Para detalhes de arquitetura, ver [CLAUDE.md](CLAUDE.md).
