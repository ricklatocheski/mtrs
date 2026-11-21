# Validação — 20/11/2026

A base anterior foi validada com **39 testes de regras, persistência, autenticação e SQL e 12 cenários únicos de navegador aprovados**, incluindo execuções focadas com Supabase real. Compilação TypeScript e build Vite de produção verificados na entrega.

## Cobertura

- CSV: separadores, acentos, múltiplas codificações, aspas, campos multilinha, cabeçalhos e extras; XLS/XLSX com abas, datas e zeros à esquerda.
- Filtros de situação e gerador, classificação exclusiva, contagens, valores GRC, identificadores e origens divergentes.
- Reservas, expiração, liberação, confirmação, versão concorrente, auditoria, reimportação, backup e neutralização de fórmulas na exportação.
- IndexedDB concorrente e SQL PostgreSQL WASM/PGlite: RLS, RPC atômico, identidade, proibição de escrita direta e de chamada do RPC interno.
- Importação automática sem confirmação, seleção de aba, erro de arquivo inválido, avanço e clique duplo protegido.
- Cópia dos cinco campos principais comparada ao clipboard. Gerador e situação recolhidos. Somente Confirmar baixa realizada conclui; fechar libera reserva.
- Persistência, atualização em outra aba, exportação CSV/XLSX e backup JSON; layout móvel e navegação.
- Login inválido, painel protegido, administrador real cadastra operador, operador entra sem permissão administrativa, administrador bloqueia e novo acesso é recusado.
- Avanço de 24 horas retorna ao login. SQL valida sessão original, sessão revogada, bloqueio e proteção do último administrador.

## Animação do login

- Olhos seguem o ponteiro; senha oculta ou revelada mantém o gesto de privacidade. A tela não inclui controle de pausa.
- Gesto de recolher botão abre conta aleatória. Resposta incorreta não inicia requisição de autenticação; foco permanece no campo de resposta. Voltar preserva campos; trocar conta limpa a resposta.
- Somente resposta correta inicia login real. Credenciais inválidas continuam recusadas; sessão e perfil são verificados pelo banco. Sucesso exibe confirmação e abre o painel.
- Movimento reduzido e Enter no celular validados, sem transbordamento horizontal após correção de largura do grid.
- Não houve benchmark de FPS em equipamento físico. O personagem usa SVG/CSS e atualizações de transformação sem estado React por movimento.

## Ambiente real e limites

Projeto Guararapes-MTR ativo em rickatocheski; migrations aplicadas e função de cadastro publicada. Login real confirmou prazo de 24 horas. Leitura anônima e token revogado foram recusados. Nenhum relatório real foi enviado ao Supabase. Importações de navegador usam modo local isolado. Contas sintéticas de QA permanecem bloqueadas após a validação de cadastro.

O relatório operacional fornecido foi validado localmente em revisões anteriores, inclusive filtros, mapeamento, exportações e acompanhamento. Nenhum relatório, senha ou dado pessoal entrou no Git. Imagens de demonstração usam dados sintéticos.

Advisores Supabase revisados: o aviso de [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) corresponde ao bootstrap privado, intencionalmente inacessível a clientes. Os sete avisos de [SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) correspondem aos RPCs autorizados: validam sessão e vínculo e, quando necessário, administrador; o RPC interno não tem execução pública. A [proteção adicional contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) está desativada no provedor. O cadastro exige senha de 10 a 128 caracteres. Não houve auditoria independente.

Não houve deploy na conta Netlify, benchmark de carga ou teste entre dispositivos físicos. O ZIP inclui dist e configuração de publicação. Limites: importação 30 MB, backup 50 MB, snapshot compartilhado 40 MB. O sistema não integra o portal MTR: conclusão é declaração manual do operador.

## Correção de marca e ponteiro

Cena substituída pelo símbolo original da Guararapes, com articulação somente do olho. Cinco testes focados de navegador passaram: fonte original da imagem, ausência do corpo genérico, coordenadas do destaque no ponteiro, comparação dos pixels com o olhar em lados opostos, acompanhamento no formulário e no desafio, privacidade da senha, movimento reduzido e uso no celular. Movimento reduzido agora mantém o olho responsivo sem mover a cabeça. Os testes anteriores de regras e segurança não foram alterados.

## Simplificação do login

Os testes de navegador confirmaram a ausência de legendas, etiquetas, textos promocionais, rodapés e controle de pausa. O formulário, o desafio e o acompanhamento do ponteiro permanecem acessíveis no computador e no celular. As novas contas de teste foram criadas nos projetos independentes e seus logins foram validados com perfil de operador. Nenhuma senha foi incluída no código ou nos pacotes.
