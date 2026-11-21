# Guararapes — Controle de MTR

Painel em português para acompanhar baixas de Manifestos de Transporte de Resíduos. Sidebar grafite com detalhes dourados, logo original e janela de conferência inspirada no painel de erros de lançamento.

## Operação

1. Entre com usuário e senha. Em **Importar relatório**, selecione ou solte CSV, XLS ou XLSX (até 30 MB). Havendo várias abas, escolha uma.
2. O sistema reconhece as linhas, importa e abre automaticamente a conferência no primeiro pendente do lote. Não há prévia, confirmação intermediária nem opções de codificação.
3. Copie MTR, data de emissão, motorista, placa e observações do gerador. Nome do gerador e situação original ficam recolhidos em **Informações do documento** e preservados no histórico.
4. Faça a baixa no portal oficial e clique em **Confirmar baixa realizada**. O próximo MTR aparece na mesma janela. Copiar, abrir ou fechar nunca conclui um documento. Não há botões de pular, anterior ou desfazer nessa janela.
5. Fechar libera sua reserva e preserva o progresso. Reimportar conserva conclusões e origens. Divergências são revisadas em **Origens e histórico**. Lote sem elegíveis não abre documentos de outro lote.

**O sistema registra a declaração do operador; não acessa nem efetua baixas no portal oficial.** A situação original do relatório nunca é alterada.

## Login e cadastros

O projeto exclusivo **Guararapes-MTR** está ativo na organização **rickatocheski**. O primeiro administrador já foi criado. Sua senha inicial é entregue em arquivo privado separado do ZIP e do GitHub. Após entrar, altere-a em **Cadastros > Minha conta**.

Somente administradores cadastram usuários e bloqueiam ou reativam contas. Novos usuários ficam disponíveis imediatamente como operadores. Senhas não aparecem na lista. Não há cadastro público no painel.

A sessão dura no máximo **24 horas a partir do login original**. Renovar o token não amplia esse prazo. O banco valida a sessão original do Supabase em cada acesso e mutação. Usuário bloqueado, sem vínculo, com sessão expirada ou revogada não acessa a base. A interface verifica o servidor ao retornar à aba e periodicamente, e encerra o acesso ao atingir o prazo. O botão Sair revoga a sessão atual.

O build de produção exige autenticação. A demonstração local existe apenas no servidor de desenvolvimento em loopback. A variável VITE_ALLOW_LOCAL_PREVIEW=true habilita explicitamente essa opção em um build de teste em loopback; deixe ausente na publicação. A base local usa IndexedDB e não é enviada automaticamente ao workspace. Trocar domínio, porta ou perfil do navegador cria outra base local.

## Executar e publicar

Requer Node.js 22.12+ ou 24 LTS e npm. Execute npm ci e npm run dev. Para gerar produção: npm run build; para servir a pasta dist: npm run preview. Não abra index.html diretamente por file://. A cópia para clipboard requer HTTPS ou localhost. Fontes locais e suas licenças ficam em public/fonts.

O build usa os identificadores públicos de src/backend.ts. As três variáveis de .env.example permitem apontar para outro projeto. Nunca coloque service_role, senha de banco ou segredo JWT no frontend. Sem configuração válida, produção bloqueia o acesso.

Na Netlify, importe o repositório e use netlify.toml: npm ci && npm run build, pasta dist. Para publicação manual, envie dist inteira. O fallback SPA também está em dist/_redirects. Não houve deploy na conta Netlify nesta revisão. Ao mudar de projeto Supabase, ajuste também os destinos HTTPS/WSS do CSP em netlify.toml.

## Guardião animado no login

O próprio símbolo dourado fornecido é usado na cena: rosto de perfil, cocar, círculo e proporções originais. Apenas o olho é articulado sobre a imagem; o personagem genérico foi substituído. O olho segue o ponteiro em todas as etapas em que está descoberto, inclusive no desafio; o rosto reage ao foco, cobre os olhos ao digitar ou revelar a senha e faz um gesto para recolher o botão de entrada. Em seguida, apresenta uma conta aleatória de soma ou subtração, sem resultados negativos. Há retorno ao login, troca de conta e correção de resposta sem perder as credenciais digitadas. Após o desafio, o Supabase valida as credenciais e o vínculo antes de liberar o painel, com uma confirmação animada.

O desafio é uma interação visual local; não é um CAPTCHA nem substitui autenticação, RLS ou as validações de sessão do servidor. Não registra respostas nem senhas no armazenamento do aplicativo. O login persistente válido continua respeitando o prazo original de 24 horas.

Movimento usa SVG e CSS, sem nova dependência ou serviço externo. O ponteiro atualiza somente transformações em refs, limitado a um requestAnimationFrame por quadro; não há renderização React por movimento nem loop ocioso. O movimento respeita prefers-reduced-motion, conforme a [documentação MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion). Teclado e celular mantêm o mesmo fluxo com foco automático na resposta.

## Infraestrutura Supabase

O ambiente entregue já recebeu as migrations e a função de cadastro. Para recriar em outro projeto:

1. Execute supabase/setup.sql, supabase/migrations/002_access.sql e 003_registration.sql, nessa ordem.
2. Crie o workspace em mtr_workspaces e configure URL, chave pública e UUID no build.
3. Publique supabase/functions/mtr-users com verify_jwt=false conforme supabase/config.toml. O handler valida sua própria identidade e autorização administrativa no servidor. Chaves privilegiadas ficam exclusivamente na função.
4. Para inicializar o primeiro administrador, gere um segredo aleatório de 32 bytes. Insira somente seu SHA-256 em mtr_bootstrap e invoque a ação bootstrap com workspace, username, password e token. O código de handler.ts define o contrato. A inicialização só funciona uma vez e apaga o hash ao concluir. No ambiente entregue, ela já foi consumida.
5. Cadastre os demais operadores pelo painel autenticado.

O workspace usa JSONB com versão. Cada RPC bloqueia a linha, compara a versão e valida sessão, identidade e reserva antes de escrever. Escrita direta é negada; RLS permite leitura apenas a membros ativos com sessão válida. Realtime recarrega o estado confirmado. Reservas duram cinco minutos. Outro operador não assume reserva ativa, e o controle de versão evita dupla conclusão. Após timeout, consulte o estado antes de repetir a ação.

A arquitetura atende equipes pequenas. Alterações simultâneas em documentos diferentes também podem exigir nova tentativa. Limite de 40 MB por snapshot compartilhado. Faça backups regulares. Todos os operadores do workspace podem operar seus MTRs; apenas administradores gerenciam contas.

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


## Backup e exportação

Em **Exportar**, escolha pendentes (inclui em conferência), concluídos, todos ou histórico. CSV usa UTF-8 com BOM e `;`; XLSX mantém identificadores como texto. Campos capazes de iniciar fórmulas recebem apóstrofo protetor. Os sete campos e acompanhamento são incluídos; no histórico, eles representam os dados vigentes, e as origens ficam no backup completo.

Em **Configurações**, exporte backup JSON. Para restaurar, selecione o arquivo, confira o resumo e confirme a mesclagem. O schema, estados, datas e identificadores são validados antes de qualquer escrita. A mesclagem conserva o acompanhamento dos registros existentes. Substituição integral é permitida apenas no modo local, com seleção explícita e confirmação adicional. Faça um backup atual antes de substituir. No modo compartilhado, eventos vindos de backup ficam identificados como informação importada e não como ações autenticadas do servidor.


## Verificação e código

Execute npm test, npm run test:e2e e npm run build. Os testes de login real usam MTR_TEST_ADMIN_PASSWORD, fornecida apenas no ambiente do processo. Sem ela, dois cenários reais são ignorados. Não grave senhas em comandos versionados.

- src/importer.ts: leitura e classificação.
- src/domain.ts e supabase/setup.sql: acompanhamento, reservas e validações atômicas.
- src/AuthGate.tsx e src/UserAccounts.tsx: login e cadastros.
- src/AnimatedLogin.tsx, src/LoginGuardian.tsx, src/guardian.css: personagem e sequência animada.
- src/ConferenceDialog.tsx: conferência e cópia.
- supabase/migrations e supabase/functions/mtr-users: autorização no banco e cadastro administrativo.
- tests e e2e: exemplos sintéticos e verificações; examples contém relatório de demonstração.

Repositório: https://github.com/ricklatocheski/mtrs. Nenhum relatório operacional, backup real ou credencial integra o Git ou o ZIP. Os recursos visuais usam a logo fornecida e a textura de madeira do painel de referência. Consulte VALIDACAO.md para resultados e limites.

## Ajuste do símbolo e do ponteiro

O olhar usa a posição real do olho no SVG, com deslocamento visível da pupila. O cursor original é preservado, sem bolinha ou destaque sobre os campos. Na preferência de movimento reduzido, a cabeça fica parada e a resposta direta do olho continua ativa, sem transição. No campo de senha, o gesto de privacidade continua cobrindo o olho.

## Login simplificado

A tela inicial mostra a marca, o símbolo com olhar responsivo e o formulário de usuário e senha. Textos promocionais, etiquetas de ambiente, aviso de sessão, legenda junto ao símbolo e botão de pausa foram retirados. O olho reage ao ponteiro sem animação de piscar contínua; a preferência de movimento reduzido continua respeitada. A validade de 24 horas continua sendo aplicada pelo servidor. Contas de teste foram criadas separadamente para cada projeto, como operadores; suas senhas ficam apenas no arquivo privado entregue ao usuário.

O destaque circular do ponteiro foi ocultado. O movimento do olho continua seguindo a posição do mouse normalmente.
