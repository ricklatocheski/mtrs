# Guararapes — Controle de MTR

Sistema de apoio à conferência e acompanhamento manual de baixas de Manifestos de Transporte de Resíduos. Interface em português, logo original fornecida e identidade em verde-floresta, madeira e branco.

A sidebar reproduz o painel de erros de lançamento: fundo grafite, logo no topo, rótulo Recebimento, mesmos espaçamentos e destaque do menu ativo em verde-oliva com texto dourado e chevron. Os links são os do controle de MTR. Em tablets, vira uma faixa de ícones; no celular, a navegação fica na barra inferior, como na referência. A janela de importação também segue essa referência visual: fundo desfocado, faixa de madeira com a marca à esquerda e área clara com as etapas de relatório, revisão e confirmação à direita. No celular, a faixa decorativa é ocultada para priorizar a operação.

**A confirmação registra a declaração do operador. O sistema não acessa nem confirma baixas no portal oficial e nunca altera a situação original do relatório.**

## Executar no computador

Requer Node.js 22.12+ ou 24 LTS, npm e um navegador moderno (Chrome, Edge, Firefox ou Safari). Na primeira instalação é necessária conexão para obter as dependências.

```powershell
npm ci
npm run dev
```

Abra o endereço informado pelo Vite. Para testar o build entregue:

```powershell
npm ci
npm run preview
```

Não abra `dist/index.html` diretamente por `file://`: use um servidor HTTP ou publique `dist` na Netlify. IndexedDB e a área de transferência dependem do contexto do navegador; a cópia funciona em HTTPS ou localhost. As fontes DM Sans e Manrope estão incluídas localmente, com licenças OFL em public/fonts.

## Operação

1. Clique em **Importar relatório** ou arraste o arquivo na área de importação. Aceita CSV, XLS e XLSX, até 30 MB. Em arquivos com várias abas, selecione a aba desejada.
2. Confira a prévia, as contagens e as inconsistências. O processamento acontece no navegador, sem IA externa. CSV aceita separador detectado automaticamente (incluindo `;`), aspas, aspas duplicadas e quebras dentro de campos. A detecção de codificação tenta BOM UTF-16, UTF-8 estrito e Windows-1252; é possível selecionar outra codificação na tela.
3. Confirme a importação. Reimportar um MTR existente conserva dados vigentes, estado e conclusões. Novas origens são anexadas e divergências ficam sinalizadas. Os sete campos originais ficam nas origens (`raw`); dados normalizados para operação ficam em `data`.
4. Inicie a conferência. Abrir um MTR reserva o atendimento por cinco minutos. **Abrir, copiar, aguardar, pular e navegar nunca concluem um documento.** A reserva expirada volta a contar como pendente; use **Reservar para conferir** para retomá-la.
5. Realize a baixa no portal oficial. Só então clique em **Confirmar baixa realizada**. A conclusão é registrada em verde, os contadores são atualizados e o próximo documento disponível é aberto.
6. **Pular por enquanto** libera o MTR e o mantém pendente. **Anterior** volta ao documento anterior visitado. **Desfazer última conclusão** cancela a última conclusão da sessão, e **Reabrir** permite retomar qualquer concluído. Todas essas ações geram histórico.
7. Divergências impedem uma nova conclusão até que uma origem elegível seja escolhida em **Origens e histórico**. A escolha não apaga nenhuma origem e não modifica conclusões antigas.

Em **Todos os MTRs**, busque pelo conteúdo, filtre por estado, período de **emissão**, gerador ou lote e abra qualquer documento. A tabela é paginada em 25 registros. O histórico mostra até 500 resultados por busca; a exportação inclui todos os eventos.

## Regras de leitura e contagem

Cabeçalhos obrigatórios: `MTR Nº`, `Situação`, `Data de Emissão`, `Motorista`, `Placa`, `Gerador Nome`, `Observações do Gerador`. A ordem não importa; espaços, caixa e acentuação simples são normalizados. Cabeçalhos obrigatórios repetidos são rejeitados. Colunas extras, inclusive `Destinador Nome`, são ignoradas.

Cada linha não vazia é classificada uma única vez, nesta ordem:

1. **Inconsistência:** MTR vazio ou não composto de dígitos, data inválida, situação vazia ou gerador vazio.
2. **Ignorado por situação:** situação normalizada diferente de `Salvo`.
3. **Ignorado pelo gerador:** gerador normalizado igual a `GUARARAPES PAINEIS S/A`, aceitando S/A, S.A., SA e espaços equivalentes.
4. **Elegível:** primeira ocorrência do MTR vira um documento único. As demais ocorrências elegíveis incrementam duplicidades.

Equação auditável: **linhas lidas = únicos elegíveis + duplicidades elegíveis + ignorados por situação + ignorados pelo gerador + inconsistências**. Essas contagens são do lote, antes de mesclar com a base. O número de documentos acrescentados pode ser menor quando os MTRs já existem.

A comparação de gerador nunca usa Destinador Nome e não exclui empresas só por conterem Guararapes: `INDUSTRIA DE COMPENSADOS GUARARAPES` e `Industria de Compensados Guararapes Ltda` permanecem elegíveis. Se o mesmo MTR aparece em origens divergentes, inclusive em uma linha ignorada, o documento é sinalizado e todas essas origens são preservadas para revisão.

Motorista, placa e observações vazios ou só com espaços são exibidos como **GRC**, sem alterar o conteúdo original. Datas são normalizadas para DD/MM/AAAA; seriais Excel e o calendário 1904 são considerados. O serial fictício de 29/02/1900 é rejeitado por não representar uma data real.

O número do MTR é tratado como texto; zeros de células de texto e de formatos Excel como `000000` são mantidos. Se o arquivo já perdeu zeros ou precisão ao salvar um número, esses dígitos não podem ser recuperados. Para identificadores longos, a coluna deve ser texto na origem. Notação científica textual é enviada para inconsistências.

## Persistência, backup e exportação

O modo local funciona sem Supabase: IndexedDB guarda a base e transações de escrita serializam alterações. BroadcastChannel atualiza abas da mesma origem. O operador local é identificado por navegador e aba; não equivale a uma identidade autenticada. Recarregar a aba preserva a identificação da reserva. Use uma aba principal por operador.

Os dados pertencem à **origem do navegador**: trocar domínio, porta, perfil ou navegador cria outro armazenamento. Não há envio dos relatórios ao GitHub. Limpar dados do navegador apaga a base local.

Em **Exportar**, escolha pendentes (inclui em conferência), concluídos, todos ou histórico. CSV usa UTF-8 com BOM e `;`; XLSX mantém identificadores como texto. Campos capazes de iniciar fórmulas recebem apóstrofo protetor. Os sete campos e acompanhamento são incluídos; no histórico, eles representam os dados vigentes, e as origens ficam no backup completo.

Em **Configurações**, exporte backup JSON. Para restaurar, selecione o arquivo, confira o resumo e confirme a mesclagem. O schema, estados, datas e identificadores são validados antes de qualquer escrita. A mesclagem conserva o acompanhamento dos registros existentes. Substituição integral é permitida apenas no modo local, com seleção explícita e confirmação adicional. Faça um backup atual antes de substituir. No modo compartilhado, eventos vindos de backup ficam identificados como informação importada e não como ações autenticadas do servidor.

## Ativar Supabase compartilhado

1. Crie um projeto Supabase. Execute **uma vez** `supabase/setup.sql` no SQL Editor.
2. Em **Authentication > Users**, crie ou convide os operadores. Configure a senha de cada conta pelos recursos de autenticação do Supabase. O aplicativo usa login com e-mail e senha e não permite autoatribuição de acesso.
3. No SQL Editor, crie o workspace e copie o UUID retornado:

```sql
insert into public.mtr_workspaces(name)
values ('Guararapes — MTR') returning id;

insert into public.mtr_members(workspace_id,user_id)
values ('UUID_WORKSPACE','UUID_USUARIO');
```

4. Cadastre cada operador autorizado em `mtr_members`. Operadores do mesmo workspace têm acesso de leitura e operação à base inteira. Gerencie vínculos exclusivamente pelo administrador; a aplicação não pode criar membros.
5. Copie `.env.example` para `.env.local` e preencha URL do projeto, chave **anon/publishable** e UUID do workspace. Nunca use `service_role`, segredo JWT ou senha de banco no frontend.

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
VITE_SUPABASE_WORKSPACE_ID=UUID_WORKSPACE
```

6. Reinicie `npm run dev`, ou refaça o build. Abra **Configurações > Compartilhado** e entre com a conta autorizada.
7. A base compartilhada começa separada da local. Para transferir, exporte backup local, mude de modo e restaure por **mesclagem**. Não há envio implícito dos dados locais.

O workspace usa um documento JSONB com versão. Cada RPC bloqueia a linha e compara a versão antes de aplicar a alteração. Reservas, conclusões, identidade e horário são validados no servidor. Escrita direta nas tabelas é negada; RLS permite leitura somente aos membros. Eventos autenticados são produzidos pelo servidor. Realtime assina mudanças da linha do workspace e recarrega a base confirmada. O frontend só confirma sucesso depois da resposta do RPC. Erros de rede e versão ficam visíveis com opção de nova tentativa. Após um timeout, consulte o estado confirmado antes de repetir a ação: a operação pode ter chegado ao servidor.

Reservas expiram em cinco minutos e são reavaliadas pelo servidor. A conclusão exige reserva ativa e ausência de divergência. Outro operador não pode assumir reserva ativa. A mesma conta em dois dispositivos continua protegida contra dupla conclusão pelo controle de versão e pela validação do estado.

Essa arquitetura prioriza integridade e simplicidade para uma equipe pequena: alterações simultâneas em MTRs distintos também podem causar conflito de versão, exigindo nova tentativa. O limite é 40 MB por documento compartilhado; lotes grandes e histórico longo devem ser arquivados externamente com backup ou migrados para tabelas normalizadas. Não foi configurado um projeto Supabase hospedado nesta entrega; autenticação, rede e Realtime reais precisam ser validados no ambiente da organização.

Referências: [funções e RPC](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## GitHub e Netlify

O repositório informado estava vazio na análise inicial. O código é destinado a `https://github.com/ricklatocheski/mtrs`. Nenhum relatório operacional ou catálogo PDF integra o projeto. Os recursos visuais incluem a logo original e uma textura de madeira recortada do catálogo fornecido, reutilizada do painel de referência do usuário. Os exemplos e testes são sintéticos.

Para enviar este ZIP a outro checkout, extraia, execute os comandos abaixo no diretório do projeto e ajuste a branch conforme seu fluxo:

```powershell
git init
git add .
git commit -m "Implementa controle de MTR"
git branch -M main
git remote add origin https://github.com/ricklatocheski/mtrs.git
git push -u origin main
```

Se o repositório remoto já tiver commits, clone primeiro e copie os arquivos por cima, sem sobrescrever `.git` ou usar push forçado. O `.gitignore` exclui `.env`, dependências, resultados de teste e `dist`. O ZIP inclui `dist` para publicação imediata; no GitHub/Netlify ele é gerado pelo build.

Na Netlify, escolha **Add new project > Import an existing project**, conecte o repositório e use o `netlify.toml`: comando `npm ci && npm run build`, diretório `dist`. Para modo compartilhado, adicione as três variáveis `VITE_*` nas variáveis de build e faça novo deploy. Sem elas, o frontend abre normalmente em modo local. As rotas `/fila`, `/registros`, `/historico` e `/config` recebem fallback SPA para `index.html`.

Para publicação manual, envie a pasta `dist` inteira à Netlify Drop. Um arquivo `_redirects` também está em `dist`, garantindo as rotas nesse tipo de upload. Não houve deploy automático na Netlify durante esta entrega.

## Verificações

```powershell
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Consulte `VALIDACAO.md` para resultados e limitações. As dependências têm versões exatas resolvidas no `package-lock.json`; use `npm ci` para reproduzir a instalação.

## Organização

- `src/importer.ts`: leitura e classificação auditável.
- `src/domain.ts`: estados, regras de acompanhamento, mesclagem e validação de backup.
- `src/storage.ts`: IndexedDB, atualização entre abas, autenticação e RPC Supabase.
- `src/exporter.ts`: CSV, XLSX e backup JSON.
- `src/App.tsx`, `src/styles.css`: interface responsiva.
- `supabase/setup.sql`: tabelas, RLS, RPC atômico e publicação Realtime.
- `tests/`: regras e SQL em PostgreSQL WASM/PGlite, com dados sintéticos.
- `e2e/`: fluxo completo no Chromium.
- `examples/`: relatório sintético para demonstração, nunca carregado automaticamente.

Não adicione relatórios reais, backups operacionais, credenciais ou nomes de motoristas ao Git. GitHub é exclusivamente versionamento do código.
