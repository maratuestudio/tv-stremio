// Botão voltar do controle Samsung (keyCode 10009) no Stremio clássico.
// Fecha o que estiver aberto (como o Esc); senão volta uma página; na tela inicial, sai do app.
(function () {
    if (window.__tvStremioVoltar) return;
    window.__tvStremioVoltar = true;

    function naInicial() {
        var h = location.hash || '';
        return h === '' || h === '#/' || h === '#!/' || h.indexOf('/board') !== -1;
    }

    function sair() {
        try { tizen.application.getCurrentApplication().exit(); } catch (e) {}
    }

    document.addEventListener('keydown', function (e) {
        if (e.keyCode !== 10009) return;
        e.preventDefault();
        e.stopPropagation();

        // Se um campo de texto está em foco, só tira o foco (fecha o teclado).
        var ativo = document.activeElement;
        if (ativo && (ativo.tagName === 'INPUT' || ativo.tagName === 'TEXTAREA')) {
            ativo.blur();
            return;
        }

        // Dá ao Stremio a chance de fechar janelas com o Esc.
        var esc = document.createEvent('Event');
        esc.initEvent('keydown', true, true);
        esc.keyCode = 27; esc.which = 27; esc.key = 'Escape';
        (ativo || document.body).dispatchEvent(esc);

        if (naInicial()) sair();
        else history.back();
    }, true);
})();
