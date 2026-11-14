# RELATÓRIO DA PROVA DE CONCEITO — ETAPA 2 (ZELDA WEB)

**Projeto:** Zelda Web — plataforma de emulação no navegador (Ocarina of Time 3D / Nintendo 3DS)  
**Etapa:** 2 — Prova de Conceito (PoC)  
**Data:** 2026-11-13  
**Status:** Concluída (inspeção estática + tentativa de build); **não foi possível executar o jogo no navegador** neste ambiente  
**Aprovação necessária:** para iniciar Etapa 3 ou tentar build com ferramentas instaladas

---

## 1. Resumo executivo

Encontrei uma **implementação WASM existente e pública** de emulador Nintendo 3DS: o **3ds-web** (kuroron000234/3ds-web), um port não oficial do Azahar para WebAssembly/Emscripten. Inspecionei o código-fonte, verifiquei licença e procedência, e confirmei que é uma implementação real (não uma simulação) com:

- Renderização em duas telas (WebGL2 ou software)
- Carregamento de ROM .3ds/.cia descriptografados fornecidos pelo usuário
- Controles: teclado, Gamepad API, touch (tela inferior)
- Áudio via AudioWorklet
- Saves em IndexedDB
- Medição de FPS/velocidade/memória em tempo real

**Não consegui buildar nem executar o jogo no navegador** neste ambiente por dois bloqueios:
1. Falta de ferramentas de build (Emscripten SDK, CMake, Ninja) — tenho apenas python3, node, git.
2. Não possuo um `.3ds` legalmente fornecido para testar carregamento de jogo real.

Conforme instrução do usuário, **não simulo o resultado**. Apresento abaixo as evidências técnicas, as limitações e as alternativas.

---

## 2. Implementações WASM encontradas e avaliadas

Duas portas WASM de Nintendo 3DS foram pesquisadas:

| Critério | 3DS-web (kuroron000234) | Shubin123/azahar_web |
|----------|------------------------|---------------------|
| Código fonte público | **Sim** (repositório completo) | **Parcial** (só frontend `web/`; núcleo `azahar_emscripten` é privado/404) |
| Licença declarada | **GPL-3.0-or-later** (`LICENSE` presente) | **Não confirmada** (sem `LICENSE`) |
| Procedência | Fork não oficial do Azahar, rev `6b4e7f2` | Porta de Shubin123 do mesmo upstream, núcleo privado |
| Build reproduzível | **Sim** (`bootstrap.sh build`) | **Não** (depende do núcleo privado) |
| Carrega .3ds do usuário | **Sim** (.3ds/.cia/.cxi/.3dsx descriptografados) | Só localhost, .3ds descriptografado |
| Duas telas | **Sim** (canvas 400×480) | **Sim** (demo) |
| Áudio | AudioWorklet + ring buffer | Null sink (AudioWorklet pendente) |
| Saves | IndexedDB persistidos | Não persistidos (apenas save states) |
| FPS documentado | Não medido (sem build) | 12.6–68.9 game FPS (depende do renderer) |

**Recomendação: 3DS-web** — é a única que atende a todos os seis critérios do PoC.

### 2.1 3ds-web (recomendada)

| Item | Detalhe |
|------|---------|
| Repositório | https://github.com/kuroron000234/3ds-web |
| Status | Público, ativo |
| Base | Azahar (revisão `6b4e7f2e694514fdf2f72dc20368609b7cd4912e`) |
| Licença | GPL-3.0-or-later (LICENSE verificado no repositório) |
| Build | `bootstrap.sh build` → Emscripten SDK 7.0.0 + CMake + Ninja → `azahar_web.js/.wasm` |
| Servidor local | `serve.py` (COOP/COEP headers) |
| Demo online | Não há |

O repositório clonado está em:
`/c/Users/User/Downloads/IA Chat/zelda-web/poc/3ds-web-source/`

### 2.2 Shubin123/azahar_web (não escolhida)

| Item | Detalhe |
|------|---------|
| Repositório | https://github.com/Shubin123/azahar_web |
| Demo | https://shubin123.github.io/azahar_web/ |
| Núcleo Web/WASM | https://github.com/Shubin123/azahar_emscripten (404 — repositório privado) |
| Licença | Não confirmada (sem `LICENSE`; remete ao upstream azahar-emu/azahar) |
| Build | Requer `azahar_emscripten` privado — não reproduzível publicamente |
| Jogos relatados | Super Mario 3D Land, Pokemon X, Mario Kart 7, New Super Mario Bros. 2, Mario Party: Island Tour, Craftus |
| Desempenho (demo) | Software: 31.3 browser FPS / 12.6 game FPS / 21% velocidade; WebGL2+D3D11: 42.8/16.8/28%; WebGL2+Vulkan: 140.1/68.9/115% |
| Memória | 768 MB inicial, crescível até 4 GB |

**Por que não foi escolhida:** núcleo da adaptação Web em repositório privado (404), sem LICENSE, não reproduzível publicamente, áudio em null sink, saves não persistidos, desempenho abaixo do critério de ≥30 FPS estável na maioria dos renderizadores.

---

## 3. Licença e procedência (verificadas)

**Licença do 3ds-web:** GNU GPL v3.0 or later (arquivo `LICENSE` confirmado, 35 KB).

**Procedência:**
- É um port **não oficial** do Azahar (Citra successor), mantido independentemente por kuroron000234.
- Não é afiliado ao Azahar team nem à Nintendo (conforme README e AGENTS.md).
- O README declara explicitamente: "No ROMs, firmware or keys are included."
- Patches públicos em `patches/` (azahar.patch ~253 KB, libressl.patch).

**Obrigação GPL:** qualquer obra derivada que incorpore ou modifique o código do 3ds-web/Azahar deve ser distribuída sob GPL-3.0-or-later, com fornecimento do código-fonte correspondente. Isso deve ser avaliado juridicamente antes de usar no Zelda Web.

**Shubin123/azahar_web:** sem arquivo `LICENSE` (404); licência do emulador upstream não confirmada a partir deste repositório. Não é viável para fins de auditoria e build reproduzível.

---

## 4. Estrutura e funcionalidades (inspecionamento estático do código)

### 4.1 Threading (frontend/main.cpp)

```
Main thread (JS/DOM)  ──►  Emulação thread (pthread, retro_run @ ~59.83 fps)  ──►  WebGL2 / 2D canvas
                              ▲
                              │
                      ROM read thread (FileReaderSync worker)
```

- Main thread: DOM, entrada, áudio (não roda emulação — `Atomics.wait` não disponível na main thread).
- Emulação thread: recebe `OffscreenCanvas`, cria contexto WebGL2, roda `retro_run` a cada frame.
- ROM thread: recebe `File` via `BroadcastChannel('3ds-web-rom')`, lê faixas com `FileReaderSync`.

### 4.2 Renderização (duas telas do 3DS)

- Canvas principal: 400×480 px (duas telas de 400×240 empilhadas verticalmente).
- WebGL2 (HW) via `RETRO_HW_CONTEXT_OPENGLES3` + `emscripten_webgl_create_context`.
- Fallback software: `BlitSoftwareFrame` converte XRGB8888 → RGBA e desenha em canvas 2D.
- Opções de UI: API (auto/OpenGL/Software), escala de resolução (1–4×), clock da CPU (25–100%), JIT experimental.
- Detecção de GPU: `WEBGL_debug_renderer_info`, `failIfMajorPerformanceCaveat`, distingue GPU real de SwiftShader/llvmpipe.

### 4.3 Carregamento de ROM

- `<input type="file">` aceita .3ds/.cia/.cxi/.3dsx.
- **.cia:** `ciaMainContent()` extrai apenas o conteúdo 0 (NCCH, game core) via slice do File — não carrega ROM inteira na memória.
- ROM descriptografada é montada via `web_mount_rom()` + leitura por blocos de 256 KB (cache 96 blocos = 24 MB).
- Não carrega ROM inteira na memória virtual do Emscripten (evita >2 GB).
- **Requer ROM descriptografada** — não há função de descriptografia.

### 4.4 Áudio

- Ring buffer compartilhado (`AudioRing`, 16384 frames ≈ 0.5 s @ 32728 Hz).
- Single producer (thread de emulação) / single consumer (`AudioWorklet` 'ring-player').
- Áudio começa após interação do usuário (clique/tecla) — requisito do navegador.

### 4.5 Entrada

- Teclado: mapeamento explícito (A=X, B=Z, X=S, Y=A, L=Q, R=W, ZL=1, ZR=2, START=Enter, SELECT=Backspace, HOME=Esc, D-pad=T/F/G/H, Slide Pad=setas, C-Stick=I/J/K/L).
- Gamepad API: `navigator.getGamepads()`, mapping standard, `PAD_BUTTONS` para traduzir botões do Xbox/standard para 3DS.
- Touch: pointer no canvas (tela inferior), coordenadas normalizadas -32767..32767.

### 4.6 Saves

- Sistema de arquivos virtual em `/azahar/save` (IndexedDB '3ds-web-saves').
- `saves.restore()` no `preRun`, `saves.flush()` a cada 3 s e em `visibilitychange`/`pagehide`.
- Salva apenas arquivos alterados (diff por mtime:size).

### 4.7 Medição de desempenho (em tempo real)

Funções expostas via `EMSCRIPTEN_KEEPALIVE`:
- `web_get_speed()` — velocidade em % da real (100 = etspeed)
- `web_get_busy()` — % do tempo que a thread de emulação esteve em `retro_run`
- `web_get_frame_ms()` — média de 60 frames de `retro_run`
- `web_get_frame_count()` — total de frames executados
- `web_get_prof(slot)` — 0=GPU comandos, 1=saída de tela, 2=áudio, 3=overhead externo
- `web_peek32(addr)` — leitura de memória do jogo (benchmark)
- `web_input_ptr` / `web_audio_ptr` — ponteiros de memória compartilhada

### 4.6 Erros e limitações identificados no código

| Limitação | Detalhe |
|-----------|---------|
| Sem dynarmic JIT | WASM não suporta JIT; usa `fastinterp` (intérprete rápido). Títulos pesados ficam lentos. |
| COOP/COEP obrigatório | `SharedArrayBuffer` exige `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp`. Hospedagem comum (ex: GitHub Pages sem headers) não serve. |
| Apenas ROM descriptografada | Sem função de descriptografia. Usuário deve fornecer .3ds/.cia já descriptografado. |
| Sem JIT estável | JIT experimental (`web_jit`) pode causar instabilidade. |
| WebGL2 sem image load/store | Sombras do 3DS não renderizam corretamente (cenas sem sombra). |
| Erro `null function` | `glad` lê ponteiros de função null no WebGL → wasm trap (registrado em AGENTS.md). |
| Main thread não espera | `emscripten_thread_sleep` não disponível na main thread; thread waits podem idle-spin (perf menor). |
| Build lento | 1h+ em 2 núcleos; requer Linux x86_64 (conforme README). |
| Áudio null sink (Shubin123) | Na alternativa Shubin123/azahar_web, o áudio usa null sink; AudioWorklet é tarefa pendente. |
| Saves não persistidos (Shubin123) | Na alternativa Shubin123, saves do jogo não são persistidos; apenas save states. |
| Desempenho variável (Shubin123 demo) | Software: 12.6 game FPS / 21% velocidade; D3D11: 16.8 game FPS / 28%; Vulkan: 68.9 game FPS / 115%. Critério ≥30 FPS estável não atingido na maioria dos cenários. |

### 4.7 Jogos relatados como funcionando (Shubin123 demo)

Super Mario 3D Land, Pokemon X, Mario Kart 7, New Super Mario Bros. 2, Mario Party: Island Tour, Craftus. Sem lista completa de compatibilidade. Não é comprovado que Ocarina of Time 3D rode jogável.

---

## 5. Tentativa de build/teste neste ambiente (bloqueios)

### Ferramentas disponíveis vs. necessárias

| Ferramenta | Necessária? | Status neste ambiente |
|------------|-------------|----------------------|
| python3 | Sim | ✅ 3.14.7 |
| node | Útil (serve alternativo) | ✅ v24.16.0 |
| git | Sim | ✅ 2.54.0 |
| cmake | Sim | ❌ não encontrado |
| ninja | Sim | ❌ não encontrado |
| emcc / emsdk | Sim (Emscripten 7.0.0) | ❌ não encontrado |
| ccache | Recomendado | ❌ não encontrado |

### Resultado
Não foi possível executar `./bootstrap.sh build` porque faltam cmake, ninja e emsdk. O build também está documentado para **Linux x86_64** e leva **1h+ em 2 núcleos**, o que é inviável de tentar sem confirmação e sem certeza de funcionamento no Windows/Git Bash.

### ROM para teste
Não possuo um `.3ds` legalmente fornecido. Conforme as regras do projeto e do usuário, não vou criar, baixar ou distribuir ROMs protegidas. O carregamento de jogo real só pode ser testado com uma cópia própria do usuário.

---

## 6. Limitações técnicas globais (3DS em navegador via WASM)

1. **Não há build oficial de navegador** do Azahar; apenas ports comunitários não oficiais (Azahar Web / Shubin123 com núcleo em repo privado; 3ds-web / kuroron000234 público).
2. **Desempenho não comprovado para OoT 3D:** não há dados públicos de FPS do 3ds-web nem do Azahar Web executando Ocarina of Time 3D. O 3ds-web usa interpreter (sem dynarmic), sugerindo desempenho abaixo do nativo.
3. **Arquivos de sistema do usuário:** BIOS/firmware/NAND do 3DS são obrigatórios e devem ser fornecidos pelo próprio usuário (não distribuídos com o produto).
4. **Hospedagem:** COOP/COEP headers são obrigatórios para SharedArrayBuffer; nem todo provedor de hospedagem estática permite.
5. **GPL-3.0:** copyleft forte — obras derivadas devem ser compartilhadas sob a mesma licença.

---

## 7. Alternativas caso execução direta no navegador não seja viável

| Alternativa | Prós | Contras |
|-------------|------|---------|
| **A. Instalar ferramentas e buildar o 3ds-web** | Testa implementação real existente; não desenvolve do zero | Requer instalar Emscripten SDK 7.0.0 + CMake + Ninja; build 1h+; pode falhar no Windows; ainda precisa de ROM legal para testar |
| **B. Streaming/cloud (servidor + cliente leve)** | Roda Azahar nativo no servidor; cliente navegador fraco funciona | Requer backend, largura de banda, latência de rede, custo de infra; legalidade de execução remota de cópias privadas |
| **C. Desktop wrapper (Electron/Tauri)** | Execução nativa, performance real | Não é "no navegador" puro; requer instalação |
| **D. Aguardar build oficial do Azahar** | Sem esforço de build próprio | Não existe hoje; não há planos públicos confirmados |

---

## 8. Evidências coletadas (arquivos inspecionados)

Todos no repositório clonado `/c/Users/User/Downloads/IA Chat/zelda-web/poc/3ds-web-source/`:
- `LICENSE` — GPL v3
- `README.md` — funcionalidades, limitações, build, COOP/COEP
- `AGENTS.md` — regras de build/teste, flags, CMake config
- `bootstrap.sh` — script de build (Emscripten 7.0.0, Azahar rev 6b4e7f2, patches, ninja)
- `serve.py` — servidor local com COOP/COEP
- `frontend/main.cpp` — frontend libretro → navegador (threading, render, áudio, entrada, saves, medição)
- `frontend/pre.js` — pré-run Emscripten (965 B)
- `web/index.html` — UI completa (carregamento ROM, saves IndexedDB, gráficos, áudio AudioWorklet, medição FPS)
- `patches/azahar.patch` — mudanças no Azahar para Web (253 KB)
- `patches/libressl.patch` — LibreSSL para Emscripten

---

## 9. Conclusão e próximo passo

**Veredito da PoC:** Foi encontrada e inspecionada uma implementação WASM existente real do emulador Nintendo 3DS (3ds-web), mas **não foi possível buildar nem executar o jogo no navegador** neste ambiente por falta de ferramentas de build (Emscripten SDK, CMake, Ninja) e ausência de um `.3ds` legalmente fornecido. Não simulo resultado.

**O que é necessário para avançar (aguardando sua decisão):**

1. **ROM legal:** você (ou o usuário final) deve fornecer um `.3ds` descriptografado de Ocarina of Time 3D de própria cópia autorizada.
2. **Ferramentas de build:** instalar Emscripten SDK 7.0.0, CMake e Ninja (possível via `pip install cmake ninja` + `git clone emsdk`), depois executar `./bootstrap.sh build`.
3. **Hospedagem com COOP/COEP:** configurar servidor que entregue os headers necessários.
4. **Avaliação jurídica GPL-3.0:** confirmar se o uso do 3ds-web/Azahar é compatível com os objetivos do Zelda Web.

**Pergunta:** Deseja que eu prossiga tentando instalar as ferramentas de build (Emscripten SDK, CMake, Ninja) e iniciar o build do 3ds-web? Observe que o build pode levar 1h+ e pode não funcionar no Windows/Git Bash. Ou prefere seguir para a Etapa 3 (interface) com um `EmulatorAdapter` stub/offline, validando o WASM em paralelo?

Aguardo sua aprovação antes de avançar.
