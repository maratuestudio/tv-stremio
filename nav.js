// Módulo TizenBrew do Stremio clássico (app.strem.io) para TV Samsung.
// A navegação por setas do Stremio clássico não alcança o menu lateral nem o topo,
// então este arquivo assume as setas: cada uma leva ao item clicável mais próximo naquela direção.
// OK clica no item; o voltar do controle (10009) fecha teclado/menus, volta uma página ou sai do app.
(function () {
    if (window.__tvStremio) return;
    window.__tvStremio = true;

    // Diagnóstico temporário: manda o que acontece na TV pro Mac (192.168.0.113:8765).
    var enviados = 0;
    function relato(m) {
        if (enviados++ > 200) return;
        try { new Image().src = 'http://192.168.0.113:8765/?m=' + encodeURIComponent(m) + '&t=' + Date.now(); } catch (e) {}
    }
    window.addEventListener('error', function (e) { relato('ERRO ' + e.message + ' @' + e.lineno); }, true);
    relato('carregou ' + location.href + ' estado=' + document.readyState + ' ua=' + navigator.userAgent);

    var SELETOR = 'a[href], button, input, select, textarea, [ng-click], [href], [ui-sref], .tab, li[tabindex], [tabindex="0"]';
    var ESQ = 37, CIMA = 38, DIR = 39, BAIXO = 40, OK = 13, VOLTAR = 10009;

    var estilo = document.createElement('style');
    estilo.textContent = '.tv-foco{outline:4px solid #8c6cff !important;outline-offset:3px !important;border-radius:12px;box-shadow:0 0 0 8px rgba(140,108,255,.25) !important;}';
    function poeEstilo() {
        var alvo = document.head || document.documentElement;
        if (alvo) { alvo.appendChild(estilo); relato('estilo ok'); }
        else setTimeout(poeEstilo, 100);
    }
    poeEstilo();

    var atual = null;

    function visivel(el) {
        if (!el.getClientRects().length) return false;
        var r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return false;
        if (r.right < 0 || r.left > innerWidth) return false;
        var s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0' || s.pointerEvents === 'none') return false;
        // Na tela: descarta o que está coberto por outra coisa (menu aberto, janela por cima).
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (cy > 0 && cy < innerHeight && cx > 0 && cx < innerWidth) {
            var topo = document.elementFromPoint(cx, cy);
            if (topo && topo !== el && !el.contains(topo) && !topo.contains(el)) return false;
        }
        return true;
    }

    function candidatos() {
        var todos = document.querySelectorAll(SELETOR), lista = [];
        for (var i = 0; i < todos.length; i++) {
            var el = todos[i];
            if (el.disabled || el.type === 'hidden' || !visivel(el)) continue;
            lista.push(el);
        }
        // Quando um item clicável contém outro, fica só o de dentro (mais preciso).
        return lista.filter(function (el) {
            for (var j = 0; j < lista.length; j++) if (lista[j] !== el && el.contains(lista[j])) return false;
            return true;
        });
    }

    // Distância entre as faixas no eixo perpendicular (0 quando se sobrepõem).
    function folga(a1, a2, b1, b2) { return a2 < b1 ? b1 - a2 : (b2 < a1 ? a1 - b2 : 0); }

    function centro(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

    function marcar(el) {
        if (atual) atual.classList.remove('tv-foco');
        atual = el;
        if (!el) return;
        el.classList.add('tv-foco');
        if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
            try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
        }
        var r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ block: 'center' });
    }

    function mover(dir) {
        var lista = candidatos();
        if (!atual || !document.documentElement.contains(atual) || !visivel(atual)) {
            var ativo = document.activeElement;
            marcar(lista.indexOf(ativo) !== -1 ? ativo : (lista[0] || null));
            return;
        }
        var a = atual.getBoundingClientRect(), ca = centro(a), melhor = null, nota = Infinity;
        for (var i = 0; i < lista.length; i++) {
            var el = lista[i];
            if (el === atual || el.contains(atual) || atual.contains(el)) continue;
            var r = el.getBoundingClientRect(), c = centro(r), dx = c.x - ca.x, dy = c.y - ca.y, principal, lateral;
            // Só vale o que está inteiramente do lado pedido (tolerância de 10 px).
            if (dir === DIR) { if (r.left < a.right - 10) continue; principal = r.left - a.right; lateral = folga(r.top, r.bottom, a.top, a.bottom); }
            else if (dir === ESQ) { if (r.right > a.left + 10) continue; principal = a.left - r.right; lateral = folga(r.top, r.bottom, a.top, a.bottom); }
            else if (dir === BAIXO) { if (r.top < a.bottom - 10) continue; principal = r.top - a.bottom; lateral = folga(r.left, r.right, a.left, a.right); }
            else { if (r.bottom > a.top + 10) continue; principal = a.top - r.bottom; lateral = folga(r.left, r.right, a.left, a.right); }
            principal = Math.max(principal, 0) + 1;
            var n = principal + lateral * 2 + Math.abs(dir === DIR || dir === ESQ ? dy : dx) * 0.05;
            if (n < nota) { nota = n; melhor = el; }
        }
        if (melhor) marcar(melhor);
    }

    function clicar(el) {
        if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) { el.click(); return; }
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') { el.focus(); return; }
        var href = el.getAttribute('href');
        var antes = location.href;
        el.click();
        if (href && href.charAt(0) === '#' && location.href === antes) location.hash = href.slice(1);
        setTimeout(function () { if (!atual || !visivel(atual)) marcar(null); }, 400);
    }

    function naInicial() {
        var h = location.hash || '';
        return h === '' || h === '#' || h === '#/' || h === '#!/';
    }

    window.addEventListener('keydown', function (e) {
        relato('tecla ' + e.keyCode + ' foco=' + (document.activeElement && document.activeElement.tagName) + ' atual=' + (atual ? atual.tagName + '.' + String(atual.className).slice(0, 25) : '-') + ' cands=' + (e.keyCode >= 37 && e.keyCode <= 40 ? candidatos().length : ''));
        var k = e.keyCode, ativo = document.activeElement;
        var digitando = ativo && (ativo.tagName === 'TEXTAREA' || (ativo.tagName === 'INPUT' && /^(text|email|password|search|url|number|tel)?$/.test(ativo.type || '')));

        if (k === VOLTAR) {
            e.preventDefault(); e.stopImmediatePropagation();
            if (digitando) { ativo.blur(); return; }
            var aberto = document.querySelector('.modal.open, .modal.show, [class*="menu"].open, .user-menu.open');
            if (window.angular && angular.element(document.body).scope) {
                var raiz = angular.element(document.body).scope().$root;
                if (raiz && raiz.userMenuOpen) { raiz.$apply(function () { raiz.userMenuOpen = false; }); return; }
            }
            if (aberto) { var esc = document.createEvent('Event'); esc.initEvent('keydown', true, true); esc.keyCode = 27; esc.which = 27; document.body.dispatchEvent(esc); return; }
            if (naInicial()) { try { tizen.application.getCurrentApplication().exit(); } catch (x) {} }
            else history.back();
            return;
        }

        if (k === ESQ || k === CIMA || k === DIR || k === BAIXO) {
            // Dentro de um campo de texto, esquerda/direita andam no texto.
            if (digitando && (k === ESQ || k === DIR)) return;
            e.preventDefault(); e.stopImmediatePropagation();
            if (digitando) ativo.blur();
            mover(k);
            return;
        }

        if (k === OK && atual && !digitando) {
            e.preventDefault(); e.stopImmediatePropagation();
            clicar(atual);
        }
    }, true);

    // Login por código: na tela de login, pede um código ao Stremio (link.stremio.com),
    // mostra na tela e espera a aprovação feita em outro aparelho já logado.
    // Aprovado, grava a sessão como o Stremio clássico guarda (localStorage "authKey" e "user").
    var painel = null, codigoAtual = null, consulta = null;

    function logado() {
        try { var u = JSON.parse(localStorage.getItem('user') || 'null'); return !!(u && u.authKey); } catch (e) { return false; }
    }

    function pedir(metodo, url, corpo, pronto) {
        var x = new XMLHttpRequest();
        x.open(metodo, url, true);
        if (corpo) x.setRequestHeader('content-type', 'application/json');
        x.onload = function () { var j = null; try { j = JSON.parse(x.responseText); } catch (e) {} pronto(j); };
        x.onerror = function () { pronto(null); };
        x.send(corpo ? JSON.stringify(corpo) : null);
    }

    function mostrarPainel(html) {
        if (!painel) {
            painel = document.createElement('div');
            painel.style.cssText = 'position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:99999;pointer-events:none;' +
                'background:#1b1740;border:2px solid #8c6cff;border-radius:20px;padding:24px 36px;color:#fff;font:22px/1.4 sans-serif;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.6)';
            document.body.appendChild(painel);
        }
        painel.innerHTML = html;
    }

    function tirarPainel() {
        if (painel && painel.parentNode) painel.parentNode.removeChild(painel);
        painel = null; codigoAtual = null;
        if (consulta) { clearInterval(consulta); consulta = null; }
    }

    function concluir(authKey) {
        pedir('POST', 'https://api.strem.io/api/getUser', { authKey: authKey }, function (j) {
            var user = j && j.result;
            if (!user || !user._id) { relato('login: getUser falhou ' + JSON.stringify(j).slice(0, 120)); return; }
            user.authKey = authKey;
            localStorage.setItem('authKey', JSON.stringify(authKey));
            localStorage.setItem('user', JSON.stringify(user));
            relato('login: ok ' + (user.email || user._id));
            mostrarPainel('Conectado! Abrindo o Stremio...');
            setTimeout(function () { location.hash = '#/'; location.reload(); }, 1200);
        });
    }

    function iniciarCodigo() {
        if (codigoAtual) return;
        codigoAtual = 'pedindo';
        pedir('GET', 'https://link.stremio.com/api/create?type=Create', null, function (j) {
            var r = j && (j.result || j);
            if (!r || !r.code) { codigoAtual = null; relato('login: create falhou'); return; }
            codigoAtual = r.code;
            relato('login: codigo ' + r.code);
            mostrarPainel('<div style="opacity:.75">Entrar sem digitar senha: no celular ou computador logado, abra</div>' +
                '<div style="font-size:30px;margin:6px 0 2px">link.stremio.com</div>' +
                '<div style="opacity:.75">e digite o código</div>' +
                '<div style="font-size:64px;letter-spacing:12px;font-weight:bold;color:#b9a6ff;margin-top:6px">' + r.code + '</div>');
            consulta = setInterval(function () {
                pedir('GET', 'https://link.stremio.com/api/read?type=Read&code=' + encodeURIComponent(r.code), null, function (k) {
                    var res = k && k.result;
                    var chave = res && (res.authKey || (res.user && res.user.authKey));
                    if (chave) { clearInterval(consulta); consulta = null; concluir(chave); }
                });
            }, 3000);
            // O código expira; troca por um novo a cada 4 minutos.
            setTimeout(function () { if (codigoAtual === r.code && !logado()) { tirarPainel(); vigiarLogin(); } }, 240000);
        });
    }

    function vigiarLogin() {
        var naTelaLogin = (location.hash || '').indexOf('#/intro') === 0;
        if (naTelaLogin && !logado() && document.body) iniciarCodigo();
        else if (!naTelaLogin && codigoAtual) tirarPainel();
    }
    window.addEventListener('hashchange', vigiarLogin);
    setInterval(vigiarLogin, 2000);

    relato('pronto');
})();
