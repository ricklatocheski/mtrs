# Validação da entrega — 20/11/2026

O repositório `ricklatocheski/mtrs` foi consultado e clonado antes da implementação. Estava vazio. A logo original foi copiada sem alterações de proporção ou transparência. O catálogo PDF foi consultado como referência de marca e materiais; não integra o repositório nem o pacote.

Resultado final: **27 testes automatizados de regras/persistência/SQL e 2 testes de navegador aprovados. Build de produção concluído.**

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

Comandos reproduzíveis estão no README e no package.json. O lockfile faz parte da entrega.

## Dependências externas e limites

**Relatório operacional:** o CSV real citado no pedido não estava entre os arquivos disponibilizados. Os anexos acessíveis foram o texto do pedido, a logo PNG e o catálogo PDF. Portanto, não foi executado teste com o relatório real. Use a prévia e confira os totais antes de confirmar o primeiro lote real.

**Supabase hospedado:** não foram fornecidos URL, chave pública, workspace nem contas de um ambiente de teste. O SQL foi executado localmente em PostgreSQL WASM, mas login Supabase, publicação Realtime, comportamento com falhas reais de rede e sincronização entre dispositivos físicos dependem da configuração descrita no README. A instrução `alter publication supabase_realtime` é específica do Supabase e foi omitida apenas no teste local PGlite.

**Netlify:** configuração e build estático incluídos. Não foi realizado deploy na conta Netlify. O fallback de rotas está definido tanto no netlify.toml quanto em dist/_redirects.

**Capacidade:** limite de importação 30 MB, backup 50 MB e documento compartilhado 40 MB. A base compartilhada usa um snapshot JSONB com versão por workspace, apropriado para equipes pequenas. Não foi realizado benchmark de carga ou auditoria de segurança independente. Todos os membros de um workspace podem operar todos os seus MTRs.

**Escopo:** o sistema não tem integração eletrônica com o portal MTR. Uma conclusão indica apenas declaração do operador. Nunca foram enviados relatórios operacionais ao GitHub.
