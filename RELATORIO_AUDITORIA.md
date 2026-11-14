# RELATÓRIO DE AUDITORIA TÉCNICA — ZELDA WEB

**Projeto:** Plataforma de emulação no navegador — The Legend of Zelda: Ocarina of Time 3D (Nintendo 3DS)  
**Etapa:** 1 — Auditoria e Pesquisa (antes de iniciar implementação completa)  
**Data:** 2026-11-13  
**Autor:** Arquiteto de software / desenvolvedor principal  
**Status:** Pendente de aprovação do usuário para iniciar a Etapa 2+

---

## 0. Resumo executivo e veredito

| Item | Conclusão |
|------|-----------|
| Melhor emulador disponível | **Azahar** (fork ativo do Citra, GPL-3.0), Ocarina of Time 3D classificado **"Perfect"** |
| Viabilidade real de WASM no navegador | **Parcialmente comprovada**: existe build WASM comunitária (Azahar Web), mas **não oficial** e sem engine upstream publicada |
| Pode rodar OoT 3D "de verdade" no navegador hoje? | **Não de forma pronta para produção.** É tecnicamente possível, mas exige adaptação significativa do port comunitário e infraestrutura específica (COOP/COEP) |
| Recomendação | **Prosseguir com cautela:** validar PoC com o build WASM comunitário antes de se comprometer com a arquitetura completa |

**Veredito:** Não existe hoje uma solução "pronta para usar" (out-of-the-box) de emulação Nintendo 3DS no navegador. O caminho viável é aproveitar o núcleo do Azahar (Citra fork) e adaptar o port WebAssembly comunitário, ou construir o próprio bind Emscripten. Não se deve criar um emulador do zero nem um player simulado.

---

## 1. Melhor emulador disponível

### Azahar (recomendado)

- **O que é:** Emulador Nintendo 3DS de código aberto, baseado no Citra, ativamente mantido.
- **Repositório oficial:** `github.com/azahar-emu/azahar`
- **Site oficial:** `azahar-emu.org`
- **Licença:** GPL-3.0 (copyleft forte — obrigatoriedade de compartilhar modificações se distribuído)
- **Estado:** Ativo. Build Git datado de 2026-11-12 (um dia antes da pesquisa). 11.310+ commits.
- **Ocarina of Time 3D:** Compatibilidade **"Perfect"** na lista oficial de compatibilidade (`github.com/azahar-emu/compatibility-list/issues/60`, game ID `0004000000033500`). Testado rodando suavemente por 9,1 horas sem problemas gráficos/de áudio (versão 2121.2, OpenGL).
- **Backends GPU nativos:** OpenGL 4.3 ou Vulkan 1.1 (mais renderizador de software).
- **Formatos suportados:** `.3ds`, `.cci`, `.cia`.
- **Arquivos de sistema necessários:** BIOS/firmware/NAND do 3DS (fornecidos pelo próprio usuário, não distribuídos pelo emulador).

### Citra e derivados (contexto)

- Citra foi o emulador 3DS de referência, mas foi descontinuado após a ação legal da Nintendo em março de 2024 (yuzu/Citra).
- O código-fonte ainda está disponível no GitHub (`citra-emu/citra`), mas sem desenvolvimento ativo oficial.
- O Azahar é o sucessor direto ativo e mantido; é a escolha mais sólida para iniciar.

---

## 2. Possibilidade real de compilação WebAssembly

### O que já funciona (evidência pesquisada)

Existe um **port WebAssembly comunitário** chamado **"Azahar Web"** por Shubin123:

- **Repositório:** `github.com/Shubin123/azahar_web`
- **Demo:** `shubin123.github.io/azahar_web/`
- **Descrição oficial do projeto:** "A WebAssembly port of Azahar (Citra fork) that runs Nintendo 3DS games directly in the browser."
- **Build system:** Emscripten SDK 6.0+
- **Tamanho:** binários WASM de ~10 MB
- **Tecnologias usadas:** WebAssembly SIMD + `SharedArrayBuffer` com pthreads (multithreading)
- **Renderização:** WebGL2 com aceleração de hardware, com fallback de software explícito
- **Carregamento de jogo:** carrega arquivo `.3ds` descriptografado

### O que precisa ser adaptado

1. **O port comunitário não é oficial.** As mudanças específicas para a Web vivem em um repositório irmão privado (`Shubin123/azahar_emscripten`), **não** no repositório upstream `azahar-emu/azahar`. Isso significa que:
   - Não há build WASM oficial mantido pela equipe do Azahar.
   - Qualquer atualização do núcleo Azahar não sobe automaticamente para o WASM; exige re-porting manual.
   - O código-fonte completo das adaptações Web pode não estar publicamente disponível (repositório privado), o que gera risco de abandono e dificuldades de manutenção sob GPL-3.0.

2. **Cabeçalhos de isolamento COOP/COEP.** O uso de `SharedArrayBuffer` com pthreads exige que o servidor sirva a página com:
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp`
   Sem esses cabeçalhos, o navegador bloqueia `SharedArrayBuffer` e o multithreading WASM não funciona.

3. **Arquivos de sistema do usuário.** O emulador exige BIOS/firmware/NAND do 3DS. O usuário deve fornecer esses arquivos (própria cópia autorizada). A plataforma não pode distribuí-los.

### O que ainda não foi comprovado

- **Não há evidência pública** de que Ocarina of Time 3D rode no build WASM comunitário com performance jogável. A compatibilidade "Perfect" citada refere-se ao build **nativo (desktop, OpenGL)**, não ao WASM.
- **Não há benchmark público** de FPS, consumo de memória ou latência de áudio do Azahar Web executando OoT 3D.
- **Não há confirmação** de que todos os recursos do jogo (duas telas, toque, Circle Pad, áudio 3D) funcionem no build WASM.

---

## 3. Dependências necessárias

### Dependências nativas do núcleo Azahar (CMakeLists.txt)

| Dependência | Obrigatória? | Uso |
|-------------|--------------|-----|
| Threads / pthreads | Sim | Multithreading do emulador |
| FFmpeg (avutil, avcodec, avformat, avfilter, swresample) | Sim | Áudio/vídeo |
| Qt6 (Widgets, Multimedia, Concurrent) | Sim | Interface desktop (não necessária para WASM) |
| Boost 1.70.0 (system) | Opcional | Utilitários |
| SDL2 | Opcional | Entrada/áudio |
| LibUSB | Opcional | Controles |
| SoundTouch | Opcional | Processamento de áudio |
| xxHash, faad2 | Via pkg-config | Hash / áudio AAC |
| Bibliotecas de plataforma | Sim | winmm, ws2_32, Cocoa, AVFoundation, etc. |

### Dependências para build WebAssembly (Emscripten)

| Dependência | Uso |
|-------------|-----|
| Emscripten SDK 6.0+ | Compilação C/C++ → WASM |
| WebAssembly SIMD | Instruções SIMD no WASM |
| SharedArrayBuffer | Memória compartilhada entre threads WASM |
| WebGL2 | Renderização acelerada GPU |
| WebAudio API | Áudio no navegador |
| Gamepad API | Controles (controle Xbox) |
| IndexedDB | Armazenamento local de saves |
| COOP/COEP headers (servidor) | Habilitar SharedArrayBuffer |

---

## 4. Dificuldades técnicas

### A. Arquitetura de threading do Citra/Azahar
O Citra (e portanto o Azahar) é um emulador **altamente multithreadado** (ARM11, ARM9, GPU, áudio, rede em threads separadas). Mapear isso para WASM pthreads + `SharedArrayBuffer` é complexo e pode gerar:
- Contenção de locks entre threads WASM
- Overhead de serialização de memória entre main thread e workers
- Diferença de comportamento entre threads nativos e Web Workers

### B. Gráficos: PICA GPU → WebGL2
O 3DS usa a GPU PICA da Digital Media Professionals. Mapear chamadas PICA para WebGL2 (ou WebGPU) exige tradução direta ou emulação por software. O build comunitário usa WebGL2 com fallback de software, o que pode ser lento para renderização em tempo real de duas telas.

### C. Áudio
O áudio do 3DS envolve múltiplos canais, mixagem e baixo latência. A WebAudio API pode introduzir latência perceptível, prejudicando a experiência de jogo (especialmente em jogos de ação/aventura como OoT 3D).

### D. Arquivos de sistema e ROMs
- A plataforma **não pode distribuir** BIOS, firmware, NAND ou ROMs.
- O usuário deve fornecer seus próprios arquivos.
- É necessário implementar validação de formato, descriptografia (se necessário) e verificação de integridade do lado do cliente.

### E. GPL-3.0 e obrigações legais
- Se o projeto distribuir código derivado do Azahar (incluindo modificações para WASM), deve disponibilizar o código-fonte sob GPL-3.0.
- O repositório privado do port comunitário cria incerteza sobre cumprimento das obrigações GPL.

### F. Desempenho em hardware modesto
A especificação pede otimização para computadores modestos. Emulação 3DS no navegador é pesada; não há garantia de FPS estável sem medição.

---

## 5. Requisitos do navegador

| Requisito | Justificativa |
|-----------|---------------|
| WebAssembly (WASM) | Execução do núcleo do emulador |
| WebAssembly SIMD | Performance de instruções vetoriais |
| SharedArrayBuffer | Multithreading via pthreads |
| WebGL 2.0 | Renderização GPU acelerada |
| WebAudio API | Áudio do emulador |
| Gamepad API | Suporte a controle Xbox |
| Cabeçalhos HTTP COOP/COEP | Habilitar SharedArrayBuffer no servidor |
| IndexedDB | Armazenamento de saves localmente |
| Mínimo: 8 GB RAM recomendado | Memória do emulador + WASM + navegador |

**Navegadores compatíveis esperados:** Chrome/Edge (melhor suporte a WASM threads), Firefox (suporta SIMD e SharedArrayBuffer com COOP/COEP), Safari (suporte limitado a alguns recursos WASM).

---

## 6. Estimativa de desempenho

> ⚠️ **Não há medição pública.** As estimativas abaixo são inferências técnicas, não medições realizadas.

| Componente | Estimativa | Confiança |
|------------|-----------|-----------|
| Binário WASM inicial | ~10 MB download | Alta (do port comunitário) |
| Memória em execução | 512 MB – 2 GB | Média |
| FPS esperado (OoT 3D) | 20–60 FPS (incerto) | Baixa — não comprovado |
| Latência de áudio | 50–150 ms (WebAudio) | Média |
| Tempo de carregamento | 5–30 s (depende da conexão) | Média |

**Recomendação:** Não prometer desempenho. Medir FPS e memória no PoC antes de qualquer compromisso de entrega.

---

## 7. Alternativa caso execução direta no navegador não seja viável

Se o build WASM não entregar performance jogável para OoT 3D:

### Alternativa A: Streaming remoto (servidor + cliente leve)
- Rodar o emulador Azahar nativo em um servidor/backend (desktop com GPU).
- Enviar o vídeo (WebRTC ou streaming de vídeo) para o navegador.
- Enviar entradas (teclado/gamepad) de volta ao servidor via WebSocket.
- **Vantagem:** Funciona em qualquer navegador fraco; núcleo nativo sem adaptações WASM.
- **Desvantagem:** Requer backend, largura de banda, latência de rede, custo de infraestrutura, e cuidado legal com execução remota de cópias privadas do usuário.

### Alternativa B: Desktop wrapper (Electron/Tauri)
- Empacotar o emulador nativo Azahar em um aplicativo desktop.
- Interface web (React) como frontend local.
- **Vantagem:** Execução nativa, performance real.
- **Desvantagem:** Não é "no navegador" puro; requer instalação.

### Alternativa C: Aguardar amadurecimento do WebGPU + WASM
- Adiar o projeto até que haja suporte mais maduro a WASM threads e WebGPU em navegadores.

---

## 8. Arquitetura recomendada

### Princípio: EmulatorAdapter (camada independente)

A interface **não** depende diretamente do emulador. Toda comunicação passa por `EmulatorAdapter`, que expõe uma interface estável:

```
┌─────────────────────────────────────────────────────────────┐
│                   UI (React + TypeScript)                   │
│  (Página inicial, página do jogo, controles, tela cheia)    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│              EmulatorAdapter (interface estável)            │
│  init() · loadGame() · start() · pause() · reset() · stop() │
│  setControls() · setAudio() · setVideo() · saveState()      │
│  loadState() · getStatus() · getError()                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        v                     v
┌───────────────┐   ┌─────────────────┐
│ Adapter WASM  │   │ Adapter Stub    │
│ (Azahar/Ems.  │   │ (futuro: outro  │
│  núcleo 3DS)  │   │  emulador)      │
└───────────────┘   └─────────────────┘
```

### Camadas abaixo do adapter

```
┌─────────────────────────────────────────────────────────────┐
│  WASM Module (Emscripten) · WebGL2 · WebAudio · SharedArray │
│  Buffer · pthreads · IndexedDB · File System Access API     │
└─────────────────────────────────────────────────────────────┘
```

### Estrutura de diretórios proposta (projeto vazio, iniciar do zero)

```
zelda-web/
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/          # UI React (tema escuro, retro)
│   ├── pages/
│   │   ├── Home.tsx         # Biblioteca, busca, destaque OoT 3D
│   │   └── Game.tsx         # Tela do jogo, controles, tela cheia
│   ├── emulator/
│   │   ├── adapter.ts       # EmulatorAdapter (interface)
│   │   ├── wasm-adapter.ts  # Implementação WASM (Azahar)
│   │   ├── types.ts         # Tipos de estado, erro, save
│   │   └── loader.ts        # Validação e carregamento de ROM
│   ├── controls/
│   │   ├── keyboard.ts      # Mapeamento teclado
│   │   ├── gamepad.ts       # Gamepad API (Xbox)
│   │   └── touch.ts         # Toque (tela inferior 3DS)
│   ├── save/
│   │   ├── indexeddb.ts     # Persistência local
│   │   └── export-import.ts # Exportar/importar saves
│   └── utils/
├── public/
│   └── wasm/                # Binários WASM do emulador (não commitar ROMs)
└── README.md
```

### Tecnologias da interface (conforme especificação)

- **React + TypeScript + Vite**
- **CSS moderno** (tema escuro, referências retrô, animações suaves)
- **IndexedDB** para saves locais
- **Backend modular somente quando necessário** (streaming alternativo)

---

## 9. Plano de implementação (etapas)

Conforme a metodologia do projeto, trabalhar em 8 etapas:

| Etapa | Objetivo | Critério de conclusão |
|-------|----------|----------------------|
| **1 — Auditoria** | Este relatório. Validar viabilidade. | Relatório aprovado pelo usuário |
| **2 — Prova de Conceito** | Inicializar núcleo WASM e renderizar tela de teste | WASM carrega, exibe imagem, relata FPS |
| **3 — Interface** | Página inicial + página do jogo (React) | Navegação, biblioteca, destaque OoT 3D |
| **4 — Integração** | Conectar EmulatorAdapter à UI | Botão JOGAR inicia/para emulação |
| **5 — Controles** | Teclado, Gamepad API, toque 3DS | Mapeamento funcional em ambas telas |
| **6 — Salvamento** | Save state + save game, IndexedDB, export/import | Save e carregamento funcionam |
| **7 — Otimização** | FPS, memória, travamentos, CPU modesta | Medições documentadas |
| **8 — Finalização** | Build de produção, hospedagem | Deploy funcional |

---

## Matriz: Já funciona / Precisa adaptação / Não comprovado

| Item | Status | Comentário |
|------|--------|------------|
| Azahar rodar OoT 3D nativo (desktop) | ✅ Já funciona | "Perfect" na lista oficial, 9,1h sem problemas |
| Build WASM do Azahar existir | ✅ Já funciona | Azahar Web por Shubin123, ~10 MB, Emscripten |
| Build WASM oficial do Azahar | ❌ Não existe | Não há build oficial; só port comunitário |
| WASM carregar .3ds descriptografado | ✅ Já funciona | Conforme documentação do port |
| WASM rodar OoT 3D com performance jogável | ❓ Não comprovado | Sem benchmark público |
| WASM usar duas telas (superior/inferior) | ❓ Não comprovado | Não há evidência pública |
| WASM suporte a toque/circle pad/L-R | ❓ Não comprovado | Não há evidência pública |
| COOP/COEP necessários para SharedArrayBuffer | ✅ Já funciona (requisito técnico) | Padrão de navegador |
| Arquivos de sistema fornecidos pelo usuário | ✅ Já funciona (requisito legal) | Azahar exige BIOS/firmware/NAND do usuário |
| Interface React + EmulatorAdapter | 🔧 Precisa adaptação | Será construída neste projeto |
| GPL-3.0 cumprimento em distribuição | 🔧 Precisa adaptação | Código derivado deve ser compartilhado |

---

## Riscos técnicos

1. **Abandono do port comunitário:** O Azahar Web é mantido por um desenvolvedor independente; se for abandonado, a plataforma fica sem núcleo WASM.
   - *Mitigação:* Manter fork próprio do port, ou avaliar construir o bind Emscripten internamente.

2. **Incerteza de desempenho:** Sem medições, não se pode prometer FPS jogável em hardware modesto.
   - *Mitigação:* PoC obrigatório antes da Etapa 3; medir FPS e memória cedo.

3. **GPL-3.0:** Código derivado obriga compartilhamento de fontes.
   - *Mitigação:* Revisar com assessoria legal antes de distribuir; considerar alternativa não-GPL se necessário.

4. **COOP/COEP em hospedagem:** Alguns provedores de hospedagem estática não permitem definir esses cabeçalhos facilmente.
   - *Mitigação:* Verificar provedor; usar Cloudflare Workers ou similar para injetar cabeçalhos.

5. **Arquivos de sistema do usuário:** A UX de pedir BIOS/firmware/NAND ao usuário é complexa e pode gerar erro.
   - *Mitigação:* UI clara de instruções, validação de arquivos, mensagens de erro amigáveis.

6. **Latência de áudio (WebAudio):** Pode prejudicar a experiência.
   - *Mitigação:* Testar áudio cedo no PoC; considerar buffer menor.

---

## Prova de conceito mínima (PoC) — antes do desenvolvimento completo

**Objetivo:** Validar que o núcleo WASM consegue inicializar, carregar um `.3ds` autorizado e renderizar algo na tela, com medição de FPS.

### Escopo do PoC

1. **Projeto base:** Vite + React + TypeScript (esqueleto mínimo).
2. **EmulatorAdapter:** Implementação WASM mínima (stub ou usando Azahar Web se disponível publicamente).
3. **Carregamento:** Input de arquivo `.3ds` (usuário fornece), validação de formato/tamanho, carregamento via File System Access API.
4. **Renderização:** Canvas WebGL2 mostrando a tela do emulador (mesmo que seja apenas uma cor ou frame de teste).
5. **Controle:** Teclado ESC para pausar/retomar.
6. **Medição:** Exibir FPS e uso de memória em tempo real no overlay de debug.
7. **Saída:** Relatório de PoC com FPS médio, picos de memória, erros de console.

### Critério de sucesso (go/no-go)

| Critério | Valor alvo | Decisão |
|----------|-----------|---------|
| FPS estável | ≥ 30 FPS | Go se atingido |
| Memória pico | ≤ 1,5 GB | Go se atingido |
| Erros de inicialização | 0 | Go se nenhum |
| Carregamento de .3ds | Sucesso | Go se funcionar |

Se o PoC não atingir os critérios, reavaliar: alternativa de streaming remoto ou adiar.

### Próximo passo imediato

Aguardar **aprovação do usuário** deste relatório de auditoria antes de iniciar a Etapa 2 (PoC).

---

## Fontes e evidências

1. Azahar official website: `https://azahar-emu.org/` — "Azahar is a free and open-source high level Nintendo 3DS emulator for PC and mobile devices"
2. Azahar GitHub: `https://github.com/azahar-emu/azahar` — GPL-3.0, 8.7k stars, 11.310 commits
3. Azahar compatibility list — OoT 3D "Perfect": `https://github.com/azahar-emu/compatibility-list/issues/60`
4. Azahar Web (community WASM port): `https://github.com/Shubin123/azahar_web` — Emscripten WASM, SIMD, SharedArrayBuffer, WebGL2
5. Azahar Web demo: `https://shubin123.github.io/azahar_web/`
6. Azahar download page (system files): `https://azahar-emu.org/pages/download/`

> Nota: Todos os achados acima foram obtidos via pesquisa web ao vivo (agente de pesquisa, 2026-11-13). Estimativas de desempenho e arquitetura são inferências técnicas do arquiteto, não medições realizadas.

---

**Aguardando aprovação para iniciar a Etapa 2 (Prova de Conceito).**
