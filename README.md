# Sopro — Gestão de Alojamento Local

App Next.js 16 (App Router, TS) + Tailwind v4 + Supabase (`@supabase/ssr`), multi-tenant.

## Arranque

```bash
npm install
cp .env.example .env.local   # preencher URL + chave publicável do Supabase
npm run dev                  # http://localhost:3000
```

Login com Supabase Auth; o `org_id` é resolvido via tabela `membros`.

## Ecrãs

Centros de custo (+ reembolso de IVA) · Detalhe do CC (casas, reservas, livro,
redistribuir conta, pagar ao dono) · Custos (CRUD) · Reservas (CRUD + importação iCal
manual e automática) · Casas (CRUD) · Documentos (upload/download) · Configuração
(pessoas, centros de custo/donos, chaves de repartição).

## Regras de ouro

- Saldos vêm sempre das **views**; escrita no livro **só via RPC**; toda a inserção define
  `org_id`; negativos a vermelho. RLS isola por organização.

## Backend

O esquema Supabase já existe — **não recriar**. Detalhes completos (tabelas, views, RPCs,
colunas geradas, Storage, Edge Function `sync-ical` + cron de iCal) em [`AGENTS.md`](./AGENTS.md).

## Scripts

```bash
npm run build      # build de produção
npx tsc --noEmit   # typecheck
npm run lint
```
