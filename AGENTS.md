<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (Next 16, App Router) has breaking changes — `cookies()`/`headers()`/`params`
are async, the middleware convention is now `src/proxy.ts` (not `middleware.ts`), and
Tailwind is v4 (CSS-based config via `@theme` in `globals.css`, no `tailwind.config.js`).
Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Sopro — Gestão de Alojamento Local

App **Next.js (App Router, TypeScript) + Tailwind v4 + Supabase** (auth + `@supabase/ssr`),
**multi-tenant** (isolamento por organização via RLS), para gestão de alojamento local.

> Nota: este ficheiro foi reconstruído (o CLAUDE.md original foi sobrescrito por engano
> durante o `create-next-app` no arranque). Reflete o estado real do backend e do frontend.

## Backend Supabase — JÁ EXISTE, não recriar o esquema

- **Project ref:** `lemvpivjmokeecorrczn`
- **URL:** `https://lemvpivjmokeecorrczn.supabase.co`
- **Chave publicável (frontend):** `sb_publishable_qLqC3H5l8FJzQpxD0BC9VA_3cxaVoWq`
  - Está em `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
  - **NUNCA** usar a `service_role` no frontend.
- Organização de exemplo: **Sopro Vertical**.

## Regras de ouro (invioláveis)

1. **Saldos vêm SEMPRE das views** — nunca recalcular no cliente.
2. **Escrever no livro é SÓ via RPC** (`lancar_custo`, `lancar_reserva`,
   `redistribuir_conta`, `distribuir_reembolso_iva`, `pagar_dono`, `repartir_custo`).
   O cliente cria/edita os dados operacionais e chama a RPC; nunca faz INSERT direto em
   `lancamentos`.
3. **Toda a inserção define `org_id`** (vem da sessão via `getSessaoOrg()`).
4. **Saldos negativos a vermelho** (tesouraria/suprimentos/conta-corrente negativos = dívida).
5. **RLS** isola tudo por organização: cada tabela tem a policy `org_isolation` para todos os
   comandos com `USING`/`WITH CHECK = org_id IN (select user_orgs())`. O `user_orgs()` resolve
   as orgs do utilizador via `membros`.

## Esquema (tabelas principais)

- `organizacoes (id, nome)`
- `membros (org_id, user_id, papel['dono'|'membro'])` — liga `auth.users` a orgs.
- `pessoas (id, org_id, nome)`
- `centros_custo (id, org_id, nome, gera_faturacao, dono_id→pessoas, ordem, criado_em)`
  - `gera_faturacao=false` ⇒ CC "só custos". `ordem` (smallint) controla a ordenação na UI.
- `casas (id, org_id, centro_custo_id, nome, morada, peso_base, iva_percentagem)`
  - `iva_percentagem` (acrescentada): % de IVA da casa; pré-preenche o IVA das reservas
    (IVA incluído no preço: `iva = valor × % ÷ (100+%)`).
- `reservas (id, org_id, casa_id, canal['airbnb'|'vrbo'|'proprio'|'por_fora'|'outro'],
  data_checkin, data_checkout, valor_total, iva_liquidado, faturado, taxa_canal,
  comissao_stripe, liquido*, fora_sopro, ical_uid, externo_id, fonte, hospede,
  estado['ativa'|'cancelada'], editada_manual, validada, recebido, data_recebimento)`
  - Índices únicos parciais `(org_id, ical_uid)` e `(org_id, externo_id)` (WHERE ... NOT NULL)
    ⇒ o upsert do supabase-js por `onConflict` NÃO funciona com eles; faz-se
    select-depois-update/insert manual.
  - **Ciclo de vida (LIVRO via trigger, NÃO chamar `lancar_reserva` na app):** `validada=false`
    = rascunho (fora do livro); `validada=true` = fechada (o trigger `reserva_ledger` lança).
    Resultado e IVA entram ao validar; a **tesouraria só entra se `recebido=true`**
    (na `data_recebimento`). `estado='cancelada'` NÃO tira do livro — só `validada`/valor o fazem.
    `editada_manual` só protege das importações.
- `fontes_reserva (id, org_id, casa_id, tipo['airbnb_ical'|'vrbo_ical'|'lodgify_api'|
  'outro_ical'], referencia, ativo)` — por casa, de onde vêm as reservas (URL iCal ou id
  de propriedade Lodgify).
- `custos (id, org_id, fornecedor, descricao, data, valor_base, iva, total*,
  pago_por_tipo['sopro'|'pessoa'|'cc'], pago_por_pessoa_id, pago_por_cc_id)`
- `alocacoes (id, org_id, custo_id, centro_custo_id, casa_id, percentagem)` — repartição do custo.
- `lancamentos (id, org_id, data, centro_custo_id, casa_id, conta, valor,
  contraparte_pessoa_id, contraparte_cc_id, origem, origem_id, lote, descricao)` — o LIVRO.
- `chaves_reparticao (id, org_id, origem_cc_id, conta['resultado'|'iva'|'suprimentos'|
  'tesouraria'], destino_cc_id, peso>0)` — usadas por `redistribuir_conta`.
- `documentos (id, org_id, entidade_tipo['reserva'|'custo'|'suprimento'], entidade_id,
  storage_path, nome_ficheiro)`
- `taxas_canal (id, org_id, canal, percentagem)` — % de taxa por canal, editável na
  Configuração; pré-preenche a taxa do canal ao criar/editar reservas. (Acrescentada pelo
  frontend; aditiva, RLS `org_isolation`.)

\* **Colunas GERADAS — nunca inserir/atualizar:** `custos.total` (= valor_base + iva) e
`reservas.liquido` (= valor_total − taxa_canal − comissao_stripe).

## Views (origem dos saldos)

- `vw_resumo_centro_custo (centro_custo_id, nome, gera_faturacao, dono_id, resultado,
  saldo_iva, saldo_suprimentos, saldo_tesouraria, saldo_cc_corrente, ordem)`
- `vw_resumo_casa (casa_id, nome, centro_custo_id, peso_base, resultado, saldo_iva)`
- `vw_suprimentos_por_pessoa (centro_custo_id, pessoa_id, saldo)`
- `vw_conta_corrente_cc (centro_custo_id, contraparte_cc_id, saldo)`

## RPCs (assinaturas)

- `lancar_custo(p_custo_id)` / `lancar_reserva(p_reserva_id)` → **idempotentes**
  (apagam os lançamentos da origem e recriam). Chamar após criar/editar.
- `repartir_custo(p_custo_id, p_centro_custo_id)` — cria alocações por casa via pesos.
- `redistribuir_conta(p_origem_cc, p_conta, p_lote?)`
- `distribuir_reembolso_iva(p_org, p_valor, p_lote?)`
- `pagar_dono(p_cc, p_valor, p_lote?)` — por CC (sem pessoa); sem travão (pode deixar
  saldos negativos: tesouraria −valor + suprimentos −valor).
- `transferir_cc(p_origem_cc, p_destino_cc, p_valor, p_lote?)` — 2 lançamentos
  `cc_corrente` simétricos (origem='manual').

## Importação de reservas (TUDO dentro da app — sem Edge Functions)

Server action **`sincronizarAction`** (`src/lib/actions/sync.ts`), disparada pelo botão
"Sincronizar agora" em `/reservas`. Lê `fontes_reserva` ativas da org e, por casa:

- **iCal** (`airbnb_ical`/`vrbo_ical`/`outro_ical`): faz `fetch` da `referencia` (URL),
  parseia os VEVENT (parser próprio em `src/lib/ical.ts`), e por `ical_uid` faz
  **select-depois-update/insert** (índice parcial não serve para `ON CONFLICT`). iCal só
  preenche datas/hospede/fonte/canal/estado — **nunca** valores financeiros nem `faturado`.
- **Lodgify** (`lodgify_api`, `referencia` = id de propriedade): do **servidor**, com
  `process.env.LODGIFY_API_KEY` (header `X-ApiKey`), GET
  `v2/reservations/bookings?includeTransactions&includeQuoteDetails` (paginado); upsert por
  `externo_id`; preenche valor_total, canal (de `source`, ex. "AirbnbIntegration"), hospede
  (nome completo), datas, estado. **Propõe** ainda `taxa_canal` (= valor × % do canal, de
  `taxas_canal`) e `iva_liquidado` (= % de IVA da casa, incluído no preço). UI: ao escolher
  fonte "Lodgify (API)", a app lista as propriedades pelo nome (`listarPropriedadesLodgify`).
- **Cancelamento:** reserva FUTURA que sai do feed → `estado='cancelada'`; PASSADA que sai →
  fica (histórico). Nunca apaga.

**REGRA TRANSVERSAL:** quando o utilizador grava uma reserva, `editada_manual=true`. Nenhuma
importação sobrepõe reservas com `editada_manual=true` (as importações propõem; as edições
mandam). A sincronização **nunca** chama `lancar_reserva` (valores por conferir → não lançar
zeros). `lancar_reserva` só é chamado ao gravar manualmente (e reserva `cancelada` não lança;
remove os lançamentos dela).

## Storage de documentos

- Bucket privado **`documentos`** (já existia) — só aceita
  `application/pdf, image/png, image/jpeg, image/webp`, máx **10 MB**; o path TEM de começar
  por `{org_id}/...` (políticas de storage por org). Acesso por URL assinado (1h).

## Arquitetura do frontend

- `src/lib/supabase/{client,server,middleware}.ts` — clientes `@supabase/ssr`.
- `src/proxy.ts` — renova sessão + protege rotas (sem sessão → `/login`).
- `src/lib/org.ts` — `getSessaoOrg()` resolve `userId`, `email`, `orgId` (via `membros`).
- `src/lib/rpc.ts` — wrappers tipados das RPCs.
- `src/lib/actions/*` — server actions (escrita; sempre com `org_id` e via RPC).
- `src/app/(app)/*` — shell autenticado (TopBar + Tabs) e ecrãs: `cc`, `cc/[id]`, `casas`,
  `reservas`, `custos`, `documentos`, `config`.
- Tokens de desenho do protótipo (`prototipo-gestao-al.jsx`) em `src/app/globals.css`.

## Como correr

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # verificação de produção
npx tsc --noEmit # typecheck
```

Login com Supabase Auth (email/password ou magic link). Depois de autenticar, o `org_id` é
resolvido via `membros`; um utilizador sem linha em `membros` não vê dados (RLS).
