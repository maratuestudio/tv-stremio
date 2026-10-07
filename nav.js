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
        // Diagnóstico desligado (ligar trocando DIAG pra true e rodando ~/tv-samsung/escuta.py).
        var DIAG = false;
        if (!DIAG || enviados++ > 200) return;
        try { new Image().src = 'http://192.168.0.113:8765/?m=' + encodeURIComponent(m) + '&t=' + Date.now(); } catch (e) {}
    }
    // Só erros de script; falha de imagem/recurso não tem mensagem e lotava o relatório.
    window.addEventListener('error', function (e) { if (e.message) relato('ERRO ' + e.message + ' @' + e.lineno); }, true);
    relato('carregou ' + location.href + ' estado=' + document.readyState + ' ua=' + navigator.userAgent);

    var SELETOR = 'a[href], button, input, select, textarea, [ng-click], [href], [ui-sref], .tab, li[tabindex], [tabindex="0"]';
    var ESQ = 37, CIMA = 38, DIR = 39, BAIXO = 40, OK = 13, VOLTAR = 10009;

    var estilo = document.createElement('style');
    estilo.textContent = 'body.tv-barra #controlbar.hidden{transform:none !important}#controlbar .control.tv-foco .icon{opacity:1 !important}#controlbar .popup li.tv-foco,#controlbar .popup .tv-foco{background:rgba(140,108,255,.35) !important}.bottom-notification{display:none !important}.tv-foco{outline:4px solid #8c6cff !important;outline-offset:3px !important;border-radius:12px;box-shadow:0 0 0 8px rgba(140,108,255,.25) !important;}';
    function poeEstilo() {
        var alvo = document.head || document.documentElement;
        if (alvo) { alvo.appendChild(estilo); relato('estilo ok'); }
        else setTimeout(poeEstilo, 100);
    }
    poeEstilo();

    var atual = null;

    // Item alcançável: tem tamanho e está no máximo a 1,5 tela de distância na vertical.
    // O teste de "coberto" é caro (hit test), então fica separado e só roda no item escolhido.
    function alcancavel(el, r) {
        if (r.width < 4 || r.height < 4) return false;
        if (r.right < 0 || r.left > innerWidth) return false;
        return !(r.bottom < -innerHeight * 1.5 || r.top > innerHeight * 2.5);
    }

    // Na tela e coberto por outra coisa (menu aberto, janela por cima)?
    function coberto(el, r) {
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (cy > 0 && cy < innerHeight && cx > 0 && cx < innerWidth) {
            var topo = document.elementFromPoint(cx, cy);
            if (!topo) return true;
            if (topo !== el && !el.contains(topo) && !topo.contains(el)) return true;
        }
        return false;
    }

    function visivel(el) {
        if (!el || !el.getClientRects().length) return false;
        var r = el.getBoundingClientRect();
        return alcancavel(el, r) && !coberto(el, r);
    }

    // Lista de {el, r}: o retângulo é medido uma vez só por tecla.
    function candidatos() {
        var todos = document.querySelectorAll(SELETOR), lista = [], i;
        for (i = 0; i < todos.length; i++) {
            var el = todos[i];
            if (el.disabled || el.type === 'hidden') continue;
            var r = el.getBoundingClientRect();
            if (alcancavel(el, r)) lista.push({ el: el, r: r });
        }
        // Quando um item clicável contém outro, fica só o de dentro: marca os ancestrais dos candidatos.
        var temFilho = [];
        for (i = 0; i < lista.length; i++) {
            var pai = lista[i].el.parentNode;
            while (pai && pai !== document.body) { pai.__tvPai = true; temFilho.push(pai); pai = pai.parentNode; }
        }
        var final = [];
        for (i = 0; i < lista.length; i++) if (!lista[i].el.__tvPai) final.push(lista[i]);
        for (i = 0; i < temFilho.length; i++) temFilho[i].__tvPai = false;
        return final;
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

    function mover(dir, pronta) {
        var lista = pronta || candidatos(), i, naLista = false;
        // Lista pronta (player): vale quem está nela, sem teste de cobertura.
        if (pronta) for (i = 0; i < lista.length; i++) if (lista[i].el === atual) naLista = true;
        if (!atual || !document.documentElement.contains(atual) || (pronta ? !naLista : !visivel(atual))) {
            var ativo = document.activeElement, achou = null;
            for (i = 0; i < lista.length; i++) if (lista[i].el === ativo) achou = ativo;
            if (!achou) for (i = 0; i < lista.length && !achou; i++) if (pronta || !coberto(lista[i].el, lista[i].r)) achou = lista[i].el;
            marcar(achou);
            return;
        }
        var a = atual.getBoundingClientRect(), ca = centro(a), fila = [];
        for (i = 0; i < lista.length; i++) {
            var el = lista[i].el, r = lista[i].r;
            if (el === atual || el.contains(atual) || atual.contains(el)) continue;
            var c = centro(r), dx = c.x - ca.x, dy = c.y - ca.y, principal, lateral;
            // Só vale o que está inteiramente do lado pedido (tolerância de 10 px).
            if (dir === DIR) { if (r.left < a.right - 10) continue; principal = r.left - a.right; lateral = folga(r.top, r.bottom, a.top, a.bottom); }
            else if (dir === ESQ) { if (r.right > a.left + 10) continue; principal = a.left - r.right; lateral = folga(r.top, r.bottom, a.top, a.bottom); }
            else if (dir === BAIXO) { if (r.top < a.bottom - 10) continue; principal = r.top - a.bottom; lateral = folga(r.left, r.right, a.left, a.right); }
            else { if (r.bottom > a.top + 10) continue; principal = a.top - r.bottom; lateral = folga(r.left, r.right, a.left, a.right); }
            principal = Math.max(principal, 0) + 1;
            var n = principal + lateral * 2 + Math.abs(dir === DIR || dir === ESQ ? dy : dx) * 0.05;
            fila.push({ el: el, r: r, n: n });
        }
        fila.sort(function (x, y) { return x.n - y.n; });
        for (i = 0; i < fila.length && i < 25; i++) {
            if (pronta || !coberto(fila[i].el, fila[i].r)) { marcar(fila[i].el); return; }
        }
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


    // ---- Player ----
    // No player, as setas e o OK não navegam pela tela: OK pausa, esquerda/direita voltam/avançam
    // 10 s, cima/baixo entram nos controles (legenda, velocidade...). Voltar sai dos controles;
    // só um voltar sem controles abertos sai do vídeo. A tela inteira do player tem um
    // ng-click="goBack()" invisível, por isso o player nunca usa a navegação geral.
    var MIDIA = { 10252: 'alternar', 415: 'tocar', 19: 'pausar', 417: 'avancar', 412: 'voltar' };
    var nosControles = false;

    function noPlayer() { return (location.hash || '').indexOf('#/player') === 0; }
    function video() { return document.querySelector('video'); }

    // A barra some com a classe .hidden (translateY) quando o mouse para; na TV não há mouse,
    // então body.tv-barra a mantém na tela: fixa nos controles, por 3 s depois de pausar/pular.
    var barraTimer = null;
    function mostrarBarra() {
        document.body.classList.add('tv-barra');
        clearTimeout(barraTimer);
        barraTimer = setTimeout(function () {
            if (!nosControles && !popupAberto()) document.body.classList.remove('tv-barra');
        }, 3000);
    }

    function popupAberto() { return document.querySelector('#controlbar .control.active'); }

    function fecharPopups() {
        var abertos = document.querySelectorAll('#controlbar .control.active');
        for (var i = 0; i < abertos.length; i++) abertos[i].classList.remove('active');
        return abertos.length > 0;
    }

    function candidatosPlayer() {
        var aberto = popupAberto();
        var raiz = aberto ? aberto.querySelector('.popup') : document;
        var sel = aberto ? '[ng-click], li, .toggle, .player-setting' : '#controlbar .control, .player-setting';
        var todos = raiz.querySelectorAll(sel), lista = [];
        for (var i = 0; i < todos.length; i++) {
            var el = todos[i], r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4 || r.width > innerWidth * 0.9) continue;
            if (!aberto && el.closest && el.closest('.popup')) continue;
            lista.push({ el: el, r: r });
        }
        return lista;
    }

    function pausarOuTocar(acao) {
        var v = video();
        if (!v) return;
        var querPausar = acao === 'pausar' || (acao !== 'tocar' && !v.paused);
        var botao = document.querySelector('#controlbar .control[ng-click*="paused"]');
        if (querPausar !== v.paused) {
            if (botao) botao.click(); else if (querPausar) v.pause(); else v.play();
        }
    }

    // O player do Stremio guarda tempo e duração em ms (player.time / player.length) e o setter de
    // time faz o pulo certo também no vídeo convertido (HLS), onde mexer no <video> não funciona.
    function playerStremio() {
        try {
            var bar = document.querySelector('#controlbar');
            var sc = bar && window.angular && angular.element(bar).scope();
            return sc && sc.player ? { sc: sc, pl: sc.player } : null;
        } catch (e) { return null; }
    }

    function tempos() {
        var ps = playerStremio(), v = video();
        if (ps && ps.pl.length > 0) return { t: ps.pl.time / 1000, d: ps.pl.length / 1000 };
        if (v && isFinite(v.duration)) return { t: v.currentTime, d: v.duration };
        return null;
    }

    function pular(segundos) {
        var ps = playerStremio(), v = video();
        if (ps && ps.pl.length > 0) {
            var alvo = Math.max(0, Math.min(ps.pl.length - 1000, ps.pl.time + segundos * 1000));
            ps.sc.$apply(function () { ps.pl.time = alvo; });
        } else if (v && isFinite(v.duration)) {
            v.currentTime = Math.max(0, Math.min(v.duration - 1, v.currentTime + segundos));
        }
        mostrarTempo();
    }

    // Painel de tempo: aparece 3 s a cada OK/seta no vídeo, atualiza só enquanto visível.
    var painelTempo = null, tempoTimer = null, tempoAtualiza = null;
    function hms(x) {
        x = Math.max(0, Math.floor(x));
        var h = Math.floor(x / 3600), m = Math.floor(x % 3600 / 60), sg = x % 60;
        return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (sg < 10 ? '0' : '') + sg;
    }
    function desenharTempo() {
        var tp = tempos();
        if (!tp || !painelTempo) return;
        var pct = Math.min(100, tp.t / tp.d * 100);
        painelTempo.innerHTML = '<div style="display:flex;justify-content:space-between;font-size:26px;margin-bottom:10px">' +
            '<span><b>' + hms(tp.t) + '</b> / ' + hms(tp.d) + '</span><span style="opacity:.8">faltam ' + hms(tp.d - tp.t) + '</span></div>' +
            '<div style="height:8px;background:rgba(255,255,255,.25);border-radius:4px"><div style="height:8px;width:' + pct + '%;background:#8c6cff;border-radius:4px"></div></div>';
    }
    function mostrarTempo() {
        if (!painelTempo) {
            painelTempo = document.createElement('div');
            painelTempo.style.cssText = 'position:fixed;left:50%;top:48px;transform:translateX(-50%);width:760px;z-index:100000;pointer-events:none;' +
                'background:rgba(20,16,48,.88);border-radius:18px;padding:18px 28px;color:#fff;font-family:sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)';
        }
        if (!painelTempo.parentNode) document.body.appendChild(painelTempo);
        painelTempo.style.display = 'block';
        desenharTempo();
        if (!tempoAtualiza) tempoAtualiza = setInterval(desenharTempo, 500);
        clearTimeout(tempoTimer);
        tempoTimer = setTimeout(esconderTempo, 3000);
    }
    function esconderTempo() {
        if (painelTempo) painelTempo.style.display = 'none';
        clearInterval(tempoAtualiza); tempoAtualiza = null;
    }

    function teclaPlayer(e) {
        var k = e.keyCode;
        if (MIDIA[k]) {
            e.preventDefault(); e.stopImmediatePropagation(); mostrarBarra();
            var m = MIDIA[k];
            if (m === 'avancar') pular(30); else if (m === 'voltar') pular(-30); else { pausarOuTocar(m); mostrarTempo(); }
            return true;
        }
        if (k !== ESQ && k !== DIR && k !== CIMA && k !== BAIXO && k !== OK && k !== VOLTAR) return false;
        e.preventDefault(); e.stopImmediatePropagation();
        mostrarBarra();

        if (k === VOLTAR) {
            if (fecharPopups()) return true;
            if (nosControles) { nosControles = false; marcar(null); mostrarBarra(); return true; }
            var sair = document.querySelector('.tab[ng-click*="playerGoBack"]');
            if (sair) sair.click(); else history.back();
            return true;
        }

        if (!nosControles) {
            if (k === OK) { pausarOuTocar('alternar'); mostrarTempo(); }
            else if (k === ESQ) pular(-10);
            else if (k === DIR) pular(10);
            else { nosControles = true; var l = candidatosPlayer(); marcar(l.length ? l[0].el : null); }
            return true;
        }

        if (k === OK) {
            if (!atual) return true;
            var acao = atual.getAttribute('ng-click');
            if (atual.classList.contains('control') && !acao) {
                var abrir = !atual.classList.contains('active');
                fecharPopups();
                if (abrir) {
                    atual.classList.add('active');
                    var itens = candidatosPlayer();
                    if (itens.length) marcar(itens[0].el);
                }
            } else {
                atual.click();
                if (atual.tagName === 'LI' || atual.classList.contains('player-setting')) {
                    var dono = atual.closest('.control');
                    fecharPopups();
                    if (dono) marcar(dono);
                }
            }
            return true;
        }
        mover(k, candidatosPlayer());
        return true;
    }

    window.addEventListener('hashchange', function () { if (!noPlayer()) { nosControles = false; fecharPopups(); esconderTempo(); document.body.classList.remove('tv-barra'); } });

    window.addEventListener('keydown', function (e) {
        if (noPlayer() && teclaPlayer(e)) return;
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


    // Servidor de streaming: a TV não tem um, então usa o do Mac pelo endereço HTTPS que o próprio
    // servidor do Stremio fornece (HTTP comum é bloqueado numa página HTTPS). O endereço codifica o
    // IP do Mac; se ele mudar, a TV varre 192.168.0.x até achar e guarda o novo (localStorage).
    var DOMINIO = '.519b6502d940.stremio.rocks:12470';
    var SERVIDOR = null;
    function urlDoIp(ip) { return 'https://' + ip.replace(/\./g, '-') + DOMINIO; }

    function testarIp(ip, pronto) {
        var x = new XMLHttpRequest(), feito = false;
        function fim(ok) { if (!feito) { feito = true; pronto(ok); } }
        try {
            x.open('GET', urlDoIp(ip) + '/settings', true);
            x.timeout = 2500;
            x.onload = function () { fim(x.status === 200); };
            x.onerror = x.ontimeout = function () { fim(false); };
            x.send();
        } catch (e) { fim(false); }
    }

    function acharServidor(pronto) {
        var salvo = '192.168.0.113';
        try { salvo = localStorage.getItem('tvServidorIP') || salvo; } catch (e) {}
        testarIp(salvo, function (ok) {
            if (ok) return pronto(salvo);
            // Varre do mais perto do último IP pro mais longe, 16 por vez.
            var base = +salvo.split('.')[3] || 113, fila = [], d, achou = false;
            for (d = 1; d < 254; d++) {
                if (base + d <= 254) fila.push(base + d);
                if (base - d >= 2) fila.push(base - d);
            }
            function lote() {
                if (achou) return;
                if (!fila.length) return pronto(null);
                var parte = fila.splice(0, 16), faltam = parte.length;
                parte.forEach(function (n) {
                    var ip = '192.168.0.' + n;
                    testarIp(ip, function (ok) {
                        if (ok && !achou) {
                            achou = true;
                            try { localStorage.setItem('tvServidorIP', ip); } catch (e) {}
                            relato('servidor achado em ' + ip);
                            pronto(ip);
                        }
                        if (--faltam === 0) lote();
                    });
                });
            }
            lote();
        });
    }

    function apontarServidor() {
        try {
            var inj = window.angular && angular.element(document.body).injector();
            if (!inj || !SERVIDOR) return false;
            var efs = inj.get('enginefs');
            if (efs.baseUrl !== SERVIDOR) {
                efs.customUrl = true; efs.baseUrl = SERVIDOR; efs.factoryUrl = SERVIDOR; efs.isOnline = true;
                relato('servidor -> ' + SERVIDOR);
            }
            return true;
        } catch (e) { return false; }
    }

    function procurarServidor() {
        acharServidor(function (ip) {
            if (!ip) { setTimeout(procurarServidor, 60000); return; } // Mac desligado: tenta de novo em 1 min
            SERVIDOR = urlDoIp(ip);
            var tentativas = setInterval(function () { if (apontarServidor()) clearInterval(tentativas); }, 500);
        });
    }
    procurarServidor();

    relato('pronto');
})();
