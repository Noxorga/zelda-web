/**
 * Fábrica do EmulatorAdapter — seleciona entre implementação stub (offline)
 * e WASM (real) com base na disponibilidade do build do 3ds-web.
 *
 * Por padrão usa o stub, permitindo desenvolvimento da interface sem o build
 * do 3ds-web. Quando os arquivos WASM (azahar_web.js/.wasm) estiverem
 * disponíveis no servidor, o adaptador WASM será usado automaticamente.
 */

import { EmulatorAdapter } from './types';
import { StubEmulatorAdapter } from './stub';
import { WasmEmulatorAdapter } from './wasm';

/**
 * Verifica se o build WASM do emulador está disponível tentando fazer um
 * HEAD request leve para azahar_web.js. Retorna true se o arquivo existir.
 */
async function wasmBuildAvailable(): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  try {
    const res = await fetch('/emulator/azahar_web.js', { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createEmulatorAdapter(): Promise<EmulatorAdapter> {
  if (await wasmBuildAvailable()) {
    return new WasmEmulatorAdapter();
  }
  return new StubEmulatorAdapter();
}
