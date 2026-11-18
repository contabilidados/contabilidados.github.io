/* Modo leitura do ContabiliDados: tamanho da letra, fundo, espaçamento,
   foco e barra de progresso. Ativo apenas em posts e páginas de pacotes. */
(function () {
  "use strict";
  var caminho = location.pathname;
  if (!/\/(posts|pacotes)\//.test(caminho)) return;
  var main = document.getElementById("quarto-document-content");
  var meta = document.querySelector("#title-block-header .quarto-title-meta");
  if (!main || !meta) return;

  var CHAVE = "cntdd-leitura";
  var ESCALAS = [0.9, 1, 1.12, 1.25, 1.4];
  var padrao = { esc: 1, fundo: "auto", espaco: "normal", foco: false };
  var pref = Object.assign({}, padrao);
  try { Object.assign(pref, JSON.parse(localStorage.getItem(CHAVE) || "{}")); } catch (e) {}
  pref.foco = false; // o foco não persiste entre páginas
  function salva() {
    try {
      var p = Object.assign({}, pref); delete p.foco;
      localStorage.setItem(CHAVE, JSON.stringify(p));
    } catch (e) {}
  }

  /* ---------- botão e painel ---------- */
  var caixa = document.createElement("div");
  caixa.className = "nv-ler";
  caixa.innerHTML =
    '<button type="button" class="nv-ler-btn" aria-expanded="false" aria-controls="nv-ler-painel">' +
      '<i class="bi bi-book" aria-hidden="true"></i> Modo leitura</button>' +
    '<div class="nv-ler-painel" id="nv-ler-painel" role="dialog" aria-label="Opções de leitura" hidden>' +
      '<div class="nv-ler-linha"><span>Letra</span><div class="nv-ler-grupo">' +
        '<button type="button" data-acao="menor" aria-label="Diminuir letra">A−</button>' +
        '<span class="nv-ler-valor" aria-live="polite"></span>' +
        '<button type="button" data-acao="maior" aria-label="Aumentar letra">A+</button></div></div>' +
      '<div class="nv-ler-linha"><span>Fundo</span><div class="nv-ler-grupo nv-ler-fundos">' +
        '<button type="button" data-fundo="claro" class="nv-f-claro" aria-label="Fundo claro"></button>' +
        '<button type="button" data-fundo="sepia" class="nv-f-sepia" aria-label="Fundo sépia"></button>' +
        '<button type="button" data-fundo="escuro" class="nv-f-escuro" aria-label="Fundo escuro"></button></div></div>' +
      '<div class="nv-ler-linha"><span>Espaçamento</span><div class="nv-ler-grupo">' +
        '<button type="button" data-espaco="normal">Normal</button>' +
        '<button type="button" data-espaco="amplo">Amplo</button></div></div>' +
      '<div class="nv-ler-linha nv-ler-rodape">' +
        '<button type="button" data-acao="foco" class="nv-ler-foco"><i class="bi bi-arrows-fullscreen" aria-hidden="true"></i> Foco</button>' +
        '<button type="button" data-acao="restaurar" class="nv-ler-rest">Restaurar</button></div>' +
    '</div>';
  meta.parentNode.insertBefore(caixa, meta.nextSibling);

  var btn = caixa.querySelector(".nv-ler-btn");
  var painel = caixa.querySelector(".nv-ler-painel");

  var sair = document.createElement("button");
  sair.type = "button";
  sair.className = "nv-ler-sair";
  sair.innerHTML = '<i class="bi bi-fullscreen-exit" aria-hidden="true"></i> Sair do foco';
  document.body.appendChild(sair);

  var barra = document.createElement("div");
  barra.className = "nv-progresso";
  barra.setAttribute("aria-hidden", "true");
  barra.innerHTML = "<span></span>";
  document.body.appendChild(barra);
  var barraFill = barra.firstChild;

  /* ---------- aplicação ---------- */
  function modoEscuroAtivo() { return document.body.classList.contains("quarto-dark"); }
  function alternaEscuro(querEscuro) {
    if (modoEscuroAtivo() !== querEscuro && typeof window.quartoToggleColorScheme === "function") {
      window.quartoToggleColorScheme();
    }
  }
  function aplica() {
    var b = document.body;
    b.style.setProperty("--nv-esc", pref.esc);
    b.classList.toggle("nv-ler-escala", pref.esc !== 1);
    b.classList.toggle("nv-ler-amplo", pref.espaco === "amplo");
    b.classList.toggle("nv-sepia", pref.fundo === "sepia" && !modoEscuroAtivo());
    b.classList.toggle("nv-foco", !!pref.foco);
    caixa.querySelector(".nv-ler-valor").textContent = Math.round(pref.esc * 100) + "%";
    var fundoAtual = modoEscuroAtivo() ? "escuro" : (pref.fundo === "sepia" ? "sepia" : "claro");
    caixa.querySelectorAll("[data-fundo]").forEach(function (x) {
      x.setAttribute("aria-pressed", x.dataset.fundo === fundoAtual);
    });
    caixa.querySelectorAll("[data-espaco]").forEach(function (x) {
      x.setAttribute("aria-pressed", x.dataset.espaco === pref.espaco);
    });
    caixa.querySelector('[data-acao="menor"]').disabled = pref.esc <= ESCALAS[0];
    caixa.querySelector('[data-acao="maior"]').disabled = pref.esc >= ESCALAS[ESCALAS.length - 1];
    progresso();
  }

  function abre(sim) {
    painel.hidden = !sim;
    btn.setAttribute("aria-expanded", sim);
  }
  btn.addEventListener("click", function (e) { e.stopPropagation(); abre(painel.hidden); });
  document.addEventListener("click", function (e) { if (!caixa.contains(e.target)) abre(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { if (!painel.hidden) { abre(false); btn.focus(); } else if (pref.foco) { pref.foco = false; aplica(); } }
  });

  painel.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    var i = ESCALAS.indexOf(pref.esc); if (i < 0) i = 1;
    if (t.dataset.acao === "menor" && i > 0) pref.esc = ESCALAS[i - 1];
    if (t.dataset.acao === "maior" && i < ESCALAS.length - 1) pref.esc = ESCALAS[i + 1];
    if (t.dataset.fundo) {
      if (t.dataset.fundo === "escuro") { alternaEscuro(true); pref.fundo = "auto"; }
      else { alternaEscuro(false); pref.fundo = t.dataset.fundo === "sepia" ? "sepia" : "auto"; }
    }
    if (t.dataset.espaco) pref.espaco = t.dataset.espaco;
    if (t.dataset.acao === "foco") { pref.foco = true; abre(false); }
    if (t.dataset.acao === "restaurar") { pref = Object.assign({}, padrao); }
    salva(); aplica();
  });
  sair.addEventListener("click", function () { pref.foco = false; aplica(); });

  /* o seletor de modo escuro da barra também afeta o sépia */
  new MutationObserver(aplica).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  /* ---------- barra de progresso ---------- */
  var pendente = false;
  function progresso() {
    if (pendente) return; pendente = true;
    requestAnimationFrame(function () {
      pendente = false;
      var ini = main.getBoundingClientRect().top + window.scrollY;
      var fim = ini + main.offsetHeight - window.innerHeight;
      var p = fim > ini ? (window.scrollY - ini) / (fim - ini) : 1;
      p = Math.max(0, Math.min(1, p));
      barraFill.style.transform = "scaleX(" + p + ")";
      var cab = document.getElementById("quarto-header");
      var topo = (!pref.foco && cab) ? Math.max(0, cab.getBoundingClientRect().bottom) : 0;
      barra.style.top = topo + "px";
    });
  }
  window.addEventListener("scroll", progresso, { passive: true });
  window.addEventListener("resize", progresso);

  aplica();
})();
