# Especificação — Exportar relatório, categorização de cartão, comparativo e despesas do Asaas

**Data:** 2026-05-22
**Status:** Aprovado para planejamento

## Contexto

App de finanças da Fysi (Next.js + Supabase). A usuária pediu quatro melhorias.
Problemas atuais identificados no código:

1. **Sem exportação.** Não há como tirar o Panorama da tela para guardar ou apresentar.
2. **Despesa de cartão mal categorizada.** A importação (IA em `parse-statement` ou CSV)
   grava apenas categorias genéricas (`food`, `subscriptions`, `other`…), nunca uma
   categoria no padrão da empresa (Marketing, Ferramentas, Equipe…). O `/categorizar`
   (modo despesa) só enxerga `category='other'`, então gastos de cartão importados como
   `subscriptions` ficam invisíveis lá e aparecem soltos no Panorama. Não há separação
   entre o que saiu no cartão e o que saiu da conta.
3. **Comparativo anual errado.** No Panorama, o modo "Este ano" soma os 12 meses cheios
   de cada ano (`panorama/page.tsx`, ramo `period === 'year'` de `fetchData`). Em maio,
   compara 5 meses com dados de 2026 contra 12 meses cheios de 2025 — injusto.
4. **Despesas do Asaas ausentes.** O backfill do Asaas
   (`api/asaas/[id]/backfill/route.ts`) importa apenas pagamentos recebidos
   (`/payments`, status `RECEIVED`/`RECEIVED_IN_CASH`). Pagamentos feitos pelo Asaas
   (equipe — Leo, Sara) nunca entram no app. Consequência: o lucro no Panorama está
   **superestimado** (entra a receita do Asaas, não sai nenhuma despesa do Asaas).

## Objetivos

- Exportar o Panorama em PDF.
- Fazer despesas de cartão pararem de cair em "Outros" e serem categorizáveis por origem.
- Tornar o comparativo do Panorama útil: evolução mês a mês + comparação ano a ano do
  mesmo período.
- Trazer as despesas pagas pelo Asaas para o app, corrigindo o lucro.

## Fora de escopo

- Date-picker de intervalo de datas livre no Panorama (a usuária escolheu o gráfico de
  tendência).
- Importar taxas do Asaas como despesa — só contam pagamentos a terceiros.
- Tela de revisão antes de importar as despesas do Asaas (a exclusão da Fysi é automática).
- Exportar em Excel/CSV (só PDF).
- Mudanças no schema do banco — as colunas necessárias já existem em `transactions`
  (`integration_id`, `external_id`, `credit_card_id`, `account_id`, `custom_category`).

---

## Funcionalidade 1 — Exportar PDF do Panorama

**Arquivos:** `src/app/(dashboard)/panorama/page.tsx`, `src/app/globals.css`.

Abordagem: folha de estilo de impressão + `window.print()`. Não usar `html2canvas`/`jspdf`
— o app usa Tailwind v4 com cores `oklch`, que quebram a captura por imagem.

- Botão **"Exportar PDF"** no cabeçalho do Panorama, ao lado do alternador de período.
  `onClick` chama `window.print()`.
- Bloco `@media print` em `globals.css`:
  - Esconde sidebar, menu mobile, o alternador de período, o botão "Exportar PDF" e a
    grade de atalhos. Onde possível usar a variante `print:hidden` do Tailwind nos
    elementos; o resto via seletores no `@media print`.
  - `print-color-adjust: exact` para que as cores dos gráficos e cards saiam no PDF.
  - `break-inside: avoid` nos cards, para não cortar um card no meio entre páginas.
  - Conteúdo ocupa a largura total (remove o deslocamento da sidebar do layout do
    dashboard).
- Cabeçalho visível só na impressão: "Panorama — {período} · gerado em {data}".
- O PDF reflete o que estiver na tela no momento — inclui o gráfico de tendência e o card
  de despesa por origem (Funcionalidades 2 e 3).

---

## Funcionalidade 2 — Categorização de despesas de cartão

### 2a — Auto-categorização na importação

**Arquivos:** `src/lib/transactions.ts`, `src/app/(dashboard)/import/page.tsx`.

- Nova função em `transactions.ts`: `inferCategoriesFromHistory(descriptions: string[])`.
  Faz **uma** consulta carregando todas as despesas com `custom_category` preenchida
  (`description`, `custom_category`, `subcategory`), monta um mapa por "chave de lojista"
  (reaproveitando a lógica de `extractExpenseKey` de `bulk-categorize.ts`) e, para cada
  descrição recebida, devolve a categoria encontrada (ou nada). Uma query só — evita N
  consultas por importação.
- No `import/page.tsx`, após o parsing (IA ou CSV), rodar `inferCategoriesFromHistory`
  sobre as descrições. Quando houver correspondência, a transação já aparece na tabela
  de revisão com `category='custom'` + `custom_category` sugerida (o badge de categoria
  existente mostra a sugestão). A usuária revisa e importa normalmente.

### 2b — `/categorizar` passa a enxergar despesas de cartão

**Arquivos:** `src/lib/bulk-categorize.ts`, `src/app/(dashboard)/categorizar/page.tsx`.

- `getUncategorizedExpenses`: trocar o filtro atual
  (`category.eq.other,and(category.eq.custom,custom_category.is.null)`) por
  `.is('custom_category', null)` — qualquer despesa sem categoria da empresa, seja qual
  for a `category` embutida. O filtro `fromDate` continua limitando o volume.
- Adicionar o parâmetro `origin: 'all' | 'card' | 'account' | 'asaas'` a
  `getUncategorizedExpenses`. A consulta passa a selecionar também `credit_card_id` e
  `integration_id` e filtra:
  - `card` → `credit_card_id` não nulo;
  - `asaas` → `integration_id` não nulo;
  - `account` → ambos nulos;
  - `all` → sem filtro.
- `categorizar/page.tsx`: no modo "Despesas", adicionar um alternador
  **Tudo / Cartão / Conta / Asaas** que controla o `origin`.

### 2c — Card "Despesa por origem" no Panorama

**Arquivo:** `src/app/(dashboard)/panorama/page.tsx`, `src/types/index.ts`.

- Adicionar `integration_id: string | null` à interface `Transaction` em `types/index.ts`
  (a coluna já existe no banco; só falta no tipo).
- Novo card "Despesa por origem" no Panorama. A partir das despesas do período
  (`currentTx`), classificar cada uma:
  - **Cartão** → `credit_card_id` não nulo;
  - **Asaas** → `integration_id` não nulo;
  - **Conta** → os demais.
- Exibir três linhas com valor e percentual, no mesmo estilo visual dos breakdowns
  existentes (ponto colorido + barra de proporção + valor).

---

## Funcionalidade 3 — Comparativo no Panorama

**Arquivo:** `src/app/(dashboard)/panorama/page.tsx`.

### 3a — Gráfico de tendência

- Nova seção "Evolução" com um `BarChart` (recharts; adicionar `BarChart`/`Bar`/`XAxis`/
  `YAxis`/`CartesianGrid`/`Legend` aos imports do Panorama).
- Mostra os últimos **6 meses** com três barras por mês: Receita, Despesa, Lucro.
- Alternador **6 / 12 meses**.
- Carrega os dados buscando cada mês com `getTransactions({ month, year })` em
  `Promise.all` e somando receita/despesa/lucro por mês. Sempre visível,
  independentemente do alternador "Este mês / Este ano".

### 3b — Correção do comparativo anual

- No ramo `period === 'year'` de `fetchData`, trocar os 12 meses cheios por
  **Jan até o mês atual** nos dois anos: `meses = 1..mêsAtual` para o ano corrente e
  `1..mêsAtual` para o ano anterior.
- Rótulos passam a ser explícitos: `periodLabel` → "Jan–Mai 2026";
  `prevPeriodLabel` → "Jan–Mai 2025" (mês abreviado via `getMonthName(mês).slice(0,3)`).

---

## Funcionalidade 4 — Importar despesas do Asaas

**Arquivos:** `src/lib/asaas/client.ts`, novo
`src/app/api/asaas/[id]/backfill-expenses/route.ts`, `src/lib/asaas/integrations.ts`,
`src/app/(dashboard)/settings/integrations/page.tsx`.

### Cliente Asaas

- Em `client.ts`, adicionar a interface `AsaasTransfer` e a função `listTransfers`.
- Endpoint: `GET /transfers`. Parâmetros de consulta usados: `dateCreated[ge]`,
  `dateCreated[le]`, `limit`, `offset`. Paginação reaproveita o `paginate` existente.
- Campos do objeto Transfer relevantes: `id`, `dateCreated`, `effectiveDate`, `status`,
  `type` (`PIX` | `TED` | `INTERNAL`…), `value`, `netValue`, `transferFee`,
  `description`, `bankAccount` (com `ownerName`, `cpfCnpj`, `bank`), `pixAddressKey`.
- Valores de `status`: `PENDING`, `BANK_PROCESSING`, `DONE`, `FAILED`, `CANCELLED`,
  `BLOCKED`.

### Rota de backfill de despesas

Nova rota `POST /api/asaas/[id]/backfill-expenses`, espelhando a estrutura de
`backfill/route.ts` (autenticação, carregar integração, `createAdminClient`, paginação,
upsert em lotes de 100). Lógica:

- Itera as transferências e considera **apenas `status === 'DONE'`** (dinheiro que
  efetivamente saiu).
- **Exclui transferências para a própria Fysi**: pular quando `bankAccount.ownerName`
  casar com `/fysi/i` (cobre "Fysi Lab Digital"). São movimentação interna, não despesa.
- **Não importa taxas**: a despesa registrada é `amount = transfer.value` (o pagamento ao
  terceiro). `transferFee`, se houver, vai apenas no campo `notes` como informação — não
  vira lançamento nem entra no `amount`.
- Para cada transferência válida, montar a transação:
  - `type='expense'`, `amount = transfer.value`;
  - `description = bankAccount.ownerName ?? transfer.description ?? 'Transferência Asaas'`;
  - `date = effectiveDate ?? dateCreated`;
  - `category='other'`, `custom_category=null` (assim aparece no `/categorizar`);
  - `account_id = integration.account_id`;
  - `integration_id = integration.id`, `external_id = transfer.id`;
  - `payment_method = type === 'PIX' ? 'pix' : 'transfer'`;
  - `notes` registra origem e taxa.
- Upsert com `onConflict: 'integration_id,external_id'` — idempotente, pode rodar várias
  vezes sem duplicar. Ids de transferência (`tra_`) não colidem com ids de cobrança
  (`pay_`).
- Resposta: `{ imported, ignoredFysi, failed }`.

### Cliente e UI

- `integrations.ts`: adicionar `runExpenseBackfill(id)`, chamando a nova rota.
- `settings/integrations/page.tsx`: botão **"Importar despesas (transferências)"** ao
  lado do backfill atual de receitas. Ao concluir, mostra
  "X despesas importadas, Y transferências para a Fysi ignoradas".

### Resultado

As despesas entram sem categoria e aparecem no `/categorizar` (Funcionalidade 2b)
agrupadas por destinatário — Leo e Sara são enviados para "Equipe" em um clique cada.
O lucro do Panorama deixa de estar superestimado.

---

## Faseamento

1. **Comparativo do Panorama** (3a + 3b) — independente, alto valor imediato.
2. **Categorização de cartão** (2a + 2b + 2c).
3. **Despesas do Asaas** (Funcionalidade 4).
4. **Exportar PDF** (Funcionalidade 1) — por último, para o PDF já capturar as novas
   seções do Panorama.

## Riscos e pontos de atenção

- **Double-count com o extrato bancário:** se um pagamento saiu do Asaas, ele não aparece
  no extrato da conta Inter — não há duplicação. A exclusão das transferências para a
  Fysi evita contar como despesa o dinheiro que só foi movido para a conta da empresa.
- **Despesas do Asaas já lançadas à mão:** o upsert deduplica por `external_id`, não
  contra lançamentos manuais. Se a usuária já registrou algum pagamento da equipe
  manualmente, pode haver duplicata — revisar no `/transactions` após o primeiro import.
- **Volume de requisições no Panorama:** o gráfico de tendência soma 6–12 buscas mensais;
  o Panorama já faz até 24 no modo anual, então é aceitável.
- **Identificação da Fysi por nome:** a exclusão usa correspondência com `/fysi/i` no
  nome do destinatário. Se houver transferências internas com outro nome, podem escapar
  do filtro — verificável na primeira execução pelo número de itens ignorados.
