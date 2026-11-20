# Validação da entrega — 20/11/2026

O repositório `ricklatocheski/mtrs` foi consultado e clonado antes da implementação. Estava vazio. A logo original foi copiada sem alterações de proporção ou transparência. O catálogo PDF foi consultado como referência de marca e materiais; não integra o repositório nem o pacote.

Resultado: **27 testes automatizados de regras/persistência/SQL e 6 cenários de navegador aprovados.** A cópia dos sete campos foi também revalidada em execução focada após o ajuste da situação original. **Build de produção concluído.**

## Executado com dados sintéticos

- Leitura CSV com separador `;`, aspas duplicadas, acentos, campos vazios, observações multilinha e colunas extras fora de ordem.
- Decodificação UTF-8, Windows-1252 e UTF-16 com BOM.
- Leitura de arquivos XLS e XLSX gerados nos testes, com duas abas, datas seriais e números com zeros em formato Excel.
- Cabeçalhos normalizados, colunas obrigatórias ausentes e datas inválidas.
- Inclusão somente de Salvo; exclusão de MTR recebido e Cancelado.
- Exclusão exclusivamente pelo Gerador Nome; Destinador Nome não interfere. Outras empresas Guararapes permanecem elegíveis.
- Exibição GRC sem alterar vazios originais.
- Preservação de identificadores em texto, datas brasileiras, consolidação e divergências.
- Equação de contagens e classificação exclusiva das linhas.
- Reserva, expiração, liberação, conclusão, impedimento de dupla conclusão, desfazer e reabrir.
- Reimportação e mesclagem de backup preservando conclusões existentes.
- Validação de backup e neutralização de fórmulas nas exportações.
- Escritas concorrentes no IndexedDB de teste: apenas um operador obtém a reserva.
- SQL executado em PostgreSQL WASM/PGlite: tabelas, funções PL/pgSQL, associação de operadores, RLS, proibição de escrita direta, reserva por operador, CAS por versão, dupla conclusão, auditoria com identidade do servidor e desfazer.
- RPC rejeita versão nula, ação nula, não membros e versões vencidas.
- Chromium real/Playwright: importação pela interface, contadores, cópia para clipboard, confirmação e avanço, pular, desfazer, reabrir, persistência após recarga e atualização em outra aba.
- Downloads CSV e XLSX: arquivos abertos nos testes para verificar conteúdo e número com zeros à esquerda.
- Download JSON e restauração por mesclagem pela interface.
- Layout móvel em 390 × 844, ausência de transbordamento da página e navegação direta às rotas.
- Inspeção visual do painel no computador.
- Compilação TypeScript e build Vite de produção.
- Confirmação da importação abre automaticamente uma janela de conferência no primeiro pendente do lote, sem concluir nenhum MTR.
- Número, situação original, data, motorista, placa, gerador e observações copiados individualmente, com comparação do conteúdo real do clipboard.
- Avanço para o próximo MTR dentro da mesma janela, confirmação verde do anterior e resumo ao terminar a passagem pela fila.
- Clique duplo de confirmação não conclui também o próximo documento; o foco acompanha a troca para o botão de copiar o novo MTR.
- Pular toda a fila exibe pendências e permite retomada; fechar ou pressionar Escape libera a reserva sem concluir.
- Desfazer pelo resumo final reabre o documento na janela; consulta e reabertura de concluídos pela listagem.
- Reimportar um lote já concluído preserva suas conclusões e mostra o resumo. Um lote sem elegíveis não seleciona pendentes de outro lote.
- Janela de conferência testada em viewport móvel, com ações acessíveis e faixa decorativa oculta.

Comandos reproduzíveis estão no README e no package.json. O lockfile faz parte da entrega.

## Dependências externas e limites

**Relatório operacional:** o CSV real foi recebido após a entrega inicial e validado localmente no build de produção. Foram conferidos o mapeamento das sete colunas em um arquivo com colunas extras, os filtros de situação e gerador, a prévia, a importação, os identificadores, as datas, os valores GRC, as exportações CSV/XLSX, o backup, a confirmação com avanço, o desfazer e a persistência após recarga. Uma conferência independente dos critérios confirmou as contagens. O importador existente processou o arquivo sem necessidade de alteração. Os testes ocorreram em contexto de navegador isolado e descartado ao final; não alteraram a base da prévia do usuário. Nenhum arquivo real, dado pessoal ou contagem operacional foi incluído no repositório. O resumo com as contagens foi entregue somente como arquivo local ao usuário.

Na revisão da janela de conferência, o relatório real foi novamente processado no build de produção: abertura automática no primeiro elegível do lote, cópia dos sete campos comparada ao arquivo de origem, avanço, desfazer e liberação da reserva ao fechar foram aprovados. O contexto de teste foi descartado. As imagens de prévia usam exclusivamente dados sintéticos.

**Supabase hospedado:** não foram fornecidos URL, chave pública, workspace nem contas de um ambiente de teste. O SQL foi executado localmente em PostgreSQL WASM, mas login Supabase, publicação Realtime, comportamento com falhas reais de rede e sincronização entre dispositivos físicos dependem da configuração descrita no README. A instrução `alter publication supabase_realtime` é específica do Supabase e foi omitida apenas no teste local PGlite.

**Netlify:** configuração e build estático incluídos. Não foi realizado deploy na conta Netlify. O fallback de rotas está definido tanto no netlify.toml quanto em dist/_redirects.

**Capacidade:** limite de importação 30 MB, backup 50 MB e documento compartilhado 40 MB. A base compartilhada usa um snapshot JSONB com versão por workspace, apropriado para equipes pequenas. Não foi realizado benchmark de carga ou auditoria de segurança independente. Todos os membros de um workspace podem operar todos os seus MTRs.

**Escopo:** o sistema não tem integração eletrônica com o portal MTR. Uma conclusão indica apenas declaração do operador. Nunca foram enviados relatórios operacionais ao GitHub.
