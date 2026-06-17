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
   `redistribuir_conta`, `distribuir_reembolso_iva`, `pagar_dono`, `repartir_custo`,
   `transferir_cc`, `reforcar_suprimentos`, `lancar_manual`).
   O cliente cria/edita os dados operacionais e chama a RPC; nunca faz INSERT direto em
   `lancamentos`.
3. **Toda a inserção define `org_id`** (vem da sessão via `getSessaoOrg()`).
4. **Saldos negativos a vermelho** (tesouraria/suprimentos/conta-corrente negativos = dívida).
5. **RLS** isola tudo por organização: cada tabela tem a policy `org_isolation` para todos os
   comandos com `USING`/`WITH CHECK = org_id IN (select user_orgs())`. O `user_orgs()` resolve
   as orgs do utilizador via `membros`.

## Esquema (tabelas principais)

- `organizacoes (id, nome, nif, morada)` — `nif`/`morada` (dados fiscais da empresa)
  editáveis na Configuração; o `nif` valida o adquirente das faturas importadas.
- `membros (org_id, user_id, papel['dono'|'membro'])` — liga `auth.users` a orgs.
- `pessoas (id, org_id, nome)`
- `centros_custo (id, org_id, nome, gera_faturacao, dono_id→pessoas, ordem, criado_em)`
  - `gera_faturacao=false` ⇒ CC "só custos". `ordem` (smallint) controla a ordenação na UI.
- `casas (id, org_id, centro_custo_id, nome, morada, peso_base, iva_percentagem)`
  - `iva_percentagem` (acrescentada): % de IVA da casa; pré-preenche o IVA das reservas
    (IVA incluído no preço: `iva = valor × % ÷ (100+%)`).
- `reservas (id, org_id, casa_id, canal['airbnb'|'vrbo'|'proprio'|'por_fora'|'outro'],
  data_checkin, data_checkout, data_faturacao, valor_total, iva_liquidado, faturado,
  taxa_canal, comissao_stripe, liquido*, fora_sopro, ical_uid, externo_id, fonte, hospede,
  estado['ativa'|'cancelada'], editada_manual, validada, recebido, data_recebimento,
  valor_recebido)`
  - `taxa_canal`/`comissao_stripe`/`liquido`/`recebido`/`data_recebimento`/`valor_recebido`
    são **legados** (Fase 2): NÃO afetam o livro. As taxas reais entram como **custos**
    `taxa_plataforma`; os recebimentos estão na tabela `recebimentos`.
  - Índices únicos parciais `(org_id, ical_uid)` e `(org_id, externo_id)` (WHERE ... NOT NULL)
    ⇒ o upsert do supabase-js por `onConflict` NÃO funciona com eles; faz-se
    select-depois-update/insert manual.
  - **Ciclo de vida (Fase 2 — LIVRO via trigger, NÃO chamar `lancar_reserva` na app):**
    `validada=false` = rascunho (fora do livro); `validada=true` = fechada (trigger
    `reserva_ledger`). `lancar_reserva` lança, na `data_faturacao` (fallback check-in):
    **Resultado = `valor_total − iva_liquidado`** e **IVA = `−iva_liquidado`**. A
    **tesouraria vem dos `recebimentos`** (um lançamento por recebimento, na sua data);
    **as taxas de plataforma NÃO entram aqui** (são custos). `faturado` é só informativo.
    `estado='cancelada'` NÃO tira do livro — só `validada` o faz. `editada_manual` protege
    das importações.
- `recebimentos (id, org_id, reserva_id→reservas, valor, data, criado_em)` — recebimentos
  (líquidos) de cada reserva; trigger `recebimento_ledger` re-lança a reserva (se validada).
  RLS `org_isolation`.
- `fontes_reserva (id, org_id, casa_id, tipo['airbnb_ical'|'vrbo_ical'|'lodgify_api'|
  'outro_ical'], referencia, ativo)` — por casa, de onde vêm as reservas (URL iCal ou id
  de propriedade Lodgify).
- `custos (id, org_id, fornecedor, nif, descricao, data, data_pagamento, valor_base, iva,
  total*, taxa_plataforma, pago_por_tipo, pago_por_pessoa_id, pago_por_cc_id, atcud)`
  - **Modelo de pagamento (Fase 1):** "pago por" é SEMPRE um CC (o **Geral** representa a
    Sopro; já não há `'sopro'`). `centros_custo.representa_empresa=true` marca o CC da
    empresa (o Geral). `lancar_custo`: Resultado −base e IVA +iva no(s) CC(s) do custo
    (data da fatura); pagamento (na `data_pagamento`):
    - **pagador = Geral (empresa):** só **Tesouraria −total no CC do custo** — **SEM
      suprimentos** (a empresa a pagar não é financiamento externo).
    - **pagador = outro CC (com dono):** **Suprimentos +total e Tesouraria +total no CC
      pagador, Tesouraria −total no CC do custo** (pagador=CC do custo → tesourarias anulam →
      Suprimentos +).
    Sem `data_pagamento` ⇒ ainda não pago (sem pernas de pagamento). **Já não usa `cc_corrente`.**
  - **Estado pago / por pagar:** o formulário tem o toggle "Já pago"; desmarcado ⇒ grava
    sem `pago_por_cc_id` nem `data_pagamento` (custo **por pagar** — só Resultado/IVA, sem
    pagamento). A lista mostra a etiqueta "por pagar", tem filtro **"só por pagar"** e a ação
    em massa **"Marcar como pago"** (`marcarPagoCustosAction(ids, cc, data)`: define pagador +
    data e re-chama `lancar_custo`; ignora as taxas de plataforma).
  - `taxa_plataforma=true` (Airbnb/VRBO/Stripe): só Resultado −base e IVA +iva, **sem perna
    de pagamento** (já vem descontada no recebimento líquido da reserva).
  - `data_pagamento` (acrescentada): data do pagamento, separada da data da fatura.
  - `atcud` (acrescentada): chave fiscal única do documento (campo H do QR), para detetar
    faturas repetidas na importação. Índice único parcial `(org_id, atcud) WHERE atcud NOT NULL`.
  - `nif` (acrescentada): NIF do fornecedor, guardado no custo; alimenta a memória
    `fornecedores(nif→nome)`. Capturado no import e no formulário manual.
  - `toconline_id` (acrescentada): id interno do documento de compra no TOConline; chave
    de deduplicação das importações automáticas. Índice único parcial `(org_id, toconline_id)
    WHERE toconline_id NOT NULL`.
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
- `fornecedores (id, org_id, nif, nome, criado_em)` — memória NIF→nome do fornecedor
  (`unique (org_id, nif)`), preenchida ao importar faturas; pré-preenche o nome pelo NIF do
  QR na próxima importação. (Acrescentada; aditiva, RLS `org_isolation`.)
- `integracoes_toconline (org_id PK, refresh_token, access_token, expira_em, ligado_em,
  atualizado_em)` — tokens OAuth do TOConline por organização. RLS `org_isolation`. Os
  segredos só são lidos no servidor (server actions).

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
- `reforcar_suprimentos(p_cc, p_valor, p_lote?)` — inverso do `pagar_dono`: entra
  dinheiro (`tesouraria +valor` + `suprimentos +valor`). SECURITY DEFINER com guarda
  `user_orgs()`.
- `lancar_manual(p_cc, p_conta, p_valor, p_descricao?, p_lote?)` — lança a UMA conta
  (`resultado`/`iva`/`suprimentos`/`tesouraria`) do CC, valor +/− (origem='manual').
  Para acertos, comissões bancárias, etc. SECURITY DEFINER com guarda `user_orgs()`.
- `centralizar_iva(p_cc, p_valor, p_lote?)` — **Fase 3, "manter o IVA na Sopro":** o dono
  deixa o IVA na empresa. Move `p_valor` deste CC para o Geral: **IVA −valor e Tesouraria
  −valor no CC; IVA +valor e Tesouraria +valor no Geral** (CC `representa_empresa=true`).
  SECURITY DEFINER com guarda `user_orgs()`. Botão "IVA na Sopro" no detalhe do CC (escondido
  no próprio Geral).

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
  - **Só importa `status='Booked'`** (reservas confirmadas). `Open` (pedidos/enquiries) e
    `Declined` (recusadas) são ignorados — não são reservas.
- **Cancelamento:** reserva FUTURA que sai do feed → `estado='cancelada'`; PASSADA que sai →
  fica (histórico). Nunca apaga.

**REGRA TRANSVERSAL:** quando o utilizador grava uma reserva, `editada_manual=true`. Nenhuma
importação sobrepõe reservas com `editada_manual=true` (as importações propõem; as edições
mandam). A sincronização **nunca** chama `lancar_reserva` (valores por conferir → não lançar
zeros). `lancar_reserva` só é chamado ao gravar manualmente (e reserva `cancelada` não lança;
remove os lançamentos dela).

## Importação de faturas e ações em massa (Fase 2A)

- **Importar faturas** (`/custos/importar`, `ImportadorFaturas`) — dois modos:
  - **QR-Code:** o QR fiscal é lido **no browser** (jsQR; PDF via `pdf.js`). Faturas
    digitalizadas têm o QR numa camada **JBIG2/JPEG2000** → o `pdf.js` precisa do WASM:
    `getDocument({ wasmUrl: "/pdfjs/wasm/" })` (os ficheiros estão em `public/pdfjs/wasm/`,
    copiados de `pdfjs-dist`; recopiar ao atualizar o pacote). Parser em
    `src/lib/fatura-qr.ts` (A=NIF emitente, B=NIF adquirente, F=data, G=nº, H=ATCUD,
    I*/N/O=bases/IVA/total; `valorBase = total − IVA`). Leitura em `src/lib/fatura-scan.ts`.
  - **Excel/CSV:** `SheetJS` (`xlsx`), mapeamento de colunas; botão "Descarregar modelo".
    Colunas do modelo: `NIF · Fornecedor · Data · Base · IVA · Centro de custo · Pago por · ATCUD`.
    "Pago por" = "Sopro" ou nome de um CC (= pago por esse CC). Centro de custo e Pago por
    fazem match por nome.
  - **TOConline (API):** aba "Do TOConline" → botão "Puxar agora" (com filtro "desde"). A
    server action `puxarToconlineAction` (`src/lib/actions/toconline.ts`) lê os **documentos
    de compra finalizados** (`GET /api/v1/commercial_purchases_documents?filter[status]=1`,
    paginado) via OAuth2 *authorization_code* (helpers em `src/lib/toconline.ts`, só servidor),
    **deduplica por `toconline_id`** (devolve só os novos) e mapeia **só** para os campos que já
    temos (fornecedor/NIF, data, base, IVA, total, nº). Caem no **mesmo ecrã de revisão**; ao
    gravar, o `importarCustosAction` volta a deduplicar por `toconline_id`.
    **Ligação:** Configuração → "TOConline" (`LigacaoToconline`): abre o URL de autorização,
    o utilizador cola o **código** (o redirect é o do Postman, `oauth.pstmn.io`), e
    `ligarToconlineAction` troca-o por tokens guardados em `integracoes_toconline`. O
    access_token (~4 h) é renovado pelo refresh_token (~8 h) automaticamente; se o refresh
    expirar, é preciso religar. Credenciais em `.env.local`: `TOCONLINE_CLIENT_ID/_CLIENT_SECRET/
    _OAUTH_URL/_API_URL/_REDIRECT_URL`. (Não há *client_credentials* na API → não dá sync
    100% automático sem religar de vez em quando.)
  - **Seleção no ecrã de revisão:** as linhas têm caixas de seleção; a barra "Aplicar"
    afeta as **selecionadas** (ou todas, se nada selecionado) — define CC, casa e quem pagou.
- **Gravação** (`importarCustosAction`, `src/lib/actions/importar-custos.ts`): por cada custo
  cria o registo + **uma alocação 100% no CC** escolhido (casa opcional), chama `lancar_custo`
  e arquiva o documento. O ficheiro é **carregado para o bucket pelo browser** (cliente
  Supabase) e a action só liga a linha em `documentos` (evita o limite de body das server
  actions). Guarda o `nif` no custo e memoriza `fornecedores(nif→nome)` com **"primeiro nome
  fica"** (`upsert ignoreDuplicates` — se o NIF já é conhecido, mantém o nome guardado e ignora
  o do ficheiro). **Deteta duplicados por ATCUD** (BD + lote); marca a vermelho faturas cujo
  adquirente (B) ≠ `organizacoes.nif`. *(Ponto 1 — leitura por IA de faturas sem QR — fica por
  preencher; o ecrã de revisão já está pronto a recebê-la.)*
- **Formulário manual de custos** (`FormularioCusto`) também captura **NIF** (auto-preenche o
  nome pelo NIF conhecido) e **ATCUD/código** (deteta duplicados; aceita códigos estrangeiros
  tal como estão). O `lancar_custo` e a memória `fornecedores` funcionam igual ao import.
- **Ações em massa nos custos** (`src/lib/actions/custos.ts`): `mudarPagoPorCustosAction`,
  `mudarCentroCustoCustosAction` (substitui as alocações por 100% num CC),
  `apagarCustosAction`, `duplicarCustoAction` — todas re-chamam `lancar_custo` (ou tiram os
  lançamentos, no apagar). A lista de custos mostra CC/casa, etiqueta "sem fatura", filtros
  (CC, casa, sem-fatura) e exporta para `.xlsx`.
- **Ações em massa nas reservas** (`src/lib/actions/reservas.ts`): `validarReservasAction(ids)`
  e `validarFaturarReceberAction(ids)` (valida + fatura + recebido com
  `data_recebimento = check-in`). A tabela tem filtro de validação (Todas/Por validar/Validadas).

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
  `reservas`, `custos`, `custos/importar`, `lancamentos`, `documentos`, `config`.
  - `lancamentos`: livro completo (de `lancamentos`) com filtros (CC, conta, origem, casa,
    datas, texto); linhas de custo/reserva ligam à origem por `(origem, origem_id)`. A edição
    de um custo mostra a secção "Lançamentos gerados" desse custo.
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
