// Carregador fixo do módulo. O CDN do TizenBrew guarda arquivos por horas, então a lógica
// mora em nav.js e é buscada sempre fresca do GitHub. Este arquivo não deve mudar.
(function () {
    var url = 'https://raw.githubusercontent.com/maratuestudio/tv-stremio/main/nav.js?t=' + Date.now();
    function relato(m) {
        try { new Image().src = 'http://192.168.0.113:8765/?m=' + encodeURIComponent(m) + '&t=' + Date.now(); } catch (e) {}
    }
    function roda(txt) {
        try { (0, eval)(txt); } catch (e) { relato('ERRO nav.js ' + e.message); }
    }
    relato('carregador iniciou');
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.onload = function () { if (x.status === 200) roda(x.responseText); else relato('nav.js status ' + x.status); };
    x.onerror = function () { relato('nav.js falhou na rede'); };
    x.send();
})();
