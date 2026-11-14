export function LegalNotice() {
  return (
    <div className="legal-notice">
      <h3>Aviso Legal</h3>
      <p>
        Esta plataforma é um projeto de emulação open-source baseado no
        <strong>3ds-web</strong> (port do <strong>Azahar</strong>), licenciado
        sob GPL-3.0-or-later. Não é afiliado à Nintendo nem possui qualquer
        vínculo com ela.
      </p>
      <p>
        <strong>Não distribuímos ROMs, firmware, BIOS, NAND nem chaves
        protegidas.</strong> Qualquer arquivo de jogo deve ser obtido
        legalmente pelo usuário a partir de sua própria cópia e não pode ser
        compartilhado ou hospedado sem autorização expressa dos respectivos
        titulares de direitos autorais.
      </p>
      <p>
        Os saves são armazenados exclusivamente no IndexedDB do seu navegador
        (client-side) e nunca são transmitidos a nenhum servidor.
      </p>
    </div>
  );
}
