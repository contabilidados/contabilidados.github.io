/* ContabiliDados: recursos do site que não dependem de render.
   - Posts: "Leia também", "Como citar" (ABNT e BibTeX) e compartilhar
   - Eventos futuros: adicionar à agenda (Google Agenda e arquivo .ics) */
(function () {
  "use strict";
  var MESES = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
  var SITE = "contabiliDados";
  var CIDADE = "Mossoró";

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function dataBR(d) { return d.getDate() + " " + MESES[d.getMonth()] + " " + d.getFullYear(); }
  function antesDoTopo(main, no) {
    var topo = document.getElementById("quarto-back-to-top");
    if (topo && topo.parentNode === main) main.insertBefore(no, topo); else main.appendChild(no);
  }
  function copiar(texto, botao) {
    var ok = function () {
      var orig = botao.innerHTML;
      botao.innerHTML = '<i class="bi bi-check2" aria-hidden="true"></i> Copiado';
      setTimeout(function () { botao.innerHTML = orig; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(ok, function () { prompt("Copie:", texto); });
    } else { prompt("Copie:", texto); }
  }

  /* ======================= Posts ======================= */
  var caminho = location.pathname;
  var main = document.getElementById("quarto-document-content");
  if (main && /\/posts\/.+\.html$/.test(caminho)) {
    var url = location.origin + caminho;
    var titulo = (document.querySelector("h1.title") || {}).textContent || document.title;
    titulo = titulo.trim();

    /* ---- Compartilhar ---- */
    var txt = encodeURIComponent(titulo + " | " + SITE);
    var u = encodeURIComponent(url);
    var share = el("section", "nv-extra nv-compartilhar");
    share.innerHTML =
      '<h2 class="nv-extra-tit">Compartilhe</h2><div class="nv-share-botoes">' +
      '<a class="nv-share" href="https://wa.me/?text=' + txt + "%20" + u + '" target="_blank" rel="noopener"><i class="bi bi-whatsapp" aria-hidden="true"></i> WhatsApp</a>' +
      '<a class="nv-share" href="https://www.linkedin.com/sharing/share-offsite/?url=' + u + '" target="_blank" rel="noopener"><i class="bi bi-linkedin" aria-hidden="true"></i> LinkedIn</a>' +
      '<a class="nv-share" href="mailto:?subject=' + txt + "&body=" + u + '"><i class="bi bi-envelope" aria-hidden="true"></i> E-mail</a>' +
      '<button type="button" class="nv-share" data-copiar-link><i class="bi bi-link-45deg" aria-hidden="true"></i> Copiar link</button></div>';
    share.querySelector("[data-copiar-link]").addEventListener("click", function () { copiar(url, this); });

    /* ---- Como citar ---- */
    var citar = el("section", "nv-extra nv-citar");
    function montaCitacao(meta) {
      var autores = (meta && meta.a && meta.a.length) ? meta.a : [];
      if (!autores.length) {
        var p = document.querySelector(".quarto-title-meta-contents p:not(.date)");
        if (p) autores = p.textContent.split(/,| e /).map(function (s) { return s.trim(); }).filter(Boolean);
      }
      var data = meta && meta.d ? new Date(meta.d + "T12:00:00") : null;
      var hoje = new Date();
      function abnt(nome) {
        var partes = nome.trim().split(/\s+/);
        if (partes.length < 2) return nome.toUpperCase();
        var sob = partes.pop();
        return sob.toUpperCase() + ", " + partes.join(" ");
      }
      var aut = autores.length > 3 ? abnt(autores[0]) + " et al." : autores.map(abnt).join("; ");
      var ref = (aut ? aut + ". " : "") + "<strong>" + esc(titulo) + "</strong>. " + SITE + ", " + CIDADE +
        (data ? ", " + dataBR(data) : "") + ". Disponível em: " + esc(url) + ". Acesso em: " + dataBR(hoje) + ".";
      var refTxt = ref.replace(/<[^>]+>/g, "");
      var chave = ((autores[0] || "contabilidados").split(/\s+/).pop() || "cntdd")
        .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "") + (data ? data.getFullYear() : "");
      var bib = "@online{" + chave + ",\n" +
        "  author       = {" + autores.map(function (n) { var p = n.trim().split(/\s+/); var s = p.pop(); return s + ", " + p.join(" "); }).join(" and ") + "},\n" +
        "  title        = {" + titulo + "},\n" +
        "  organization = {" + SITE + "},\n" +
        (data ? "  date         = {" + meta.d + "},\n" : "") +
        "  url          = {" + url + "},\n" +
        "  urldate      = {" + hoje.toISOString().slice(0, 10) + "}\n}";
      citar.innerHTML =
        '<h2 class="nv-extra-tit">Como citar</h2>' +
        '<div class="nv-citar-abas" role="tablist"><button type="button" class="ativa" data-fmt="abnt" role="tab">ABNT</button><button type="button" data-fmt="bib" role="tab">BibTeX</button></div>' +
        '<div class="nv-citar-caixa" data-fmt="abnt"><p>' + ref + '</p></div>' +
        '<div class="nv-citar-caixa" data-fmt="bib" hidden><pre>' + esc(bib) + "</pre></div>" +
        '<button type="button" class="nv-share nv-citar-copiar"><i class="bi bi-clipboard" aria-hidden="true"></i> Copiar citação</button>';
      var fmt = "abnt";
      citar.querySelectorAll(".nv-citar-abas button").forEach(function (b) {
        b.addEventListener("click", function () {
          fmt = b.dataset.fmt;
          citar.querySelectorAll(".nv-citar-abas button").forEach(function (x) { x.classList.toggle("ativa", x === b); });
          citar.querySelectorAll(".nv-citar-caixa").forEach(function (c) { c.hidden = c.dataset.fmt !== fmt; });
        });
      });
      citar.querySelector(".nv-citar-copiar").addEventListener("click", function () { copiar(fmt === "abnt" ? refTxt : bib, this); });
    }

    /* ---- Leia também ---- */
    var leia = el("section", "nv-extra nv-leia");
    function montaRelacionados(indice, atual) {
      var GENERICAS = { "Post": 1, "Resenha": 1 };
      var minhas = (atual ? atual.c : []).filter(function (c) { return !GENERICAS[c]; });
      var area = (caminho.match(/\/posts\/([^/]+)\//) || [])[1];
      var cand = indice.filter(function (p) { return p.u !== caminho; }).map(function (p) {
        var comuns = p.c.filter(function (c) { return minhas.indexOf(c) >= 0; }).length;
        var mesmaArea = area && p.u.indexOf("/posts/" + area + "/") >= 0 ? 0.5 : 0;
        return { p: p, s: comuns * 2 + mesmaArea };
      }).filter(function (x) { return x.s > 0; });
      cand.sort(function (a, b) { return b.s - a.s || (b.p.d > a.p.d ? 1 : -1); });
      var top = cand.slice(0, 3).map(function (x) { return x.p; });
      if (!top.length) return false;
      leia.innerHTML = '<h2 class="nv-extra-tit">Leia também</h2><div class="nv-leia-grade">' + top.map(function (p) {
        var d = p.d ? dataBR(new Date(p.d + "T12:00:00")) : "";
        return '<a class="nv-leia-card" href="' + esc(p.u) + '">' +
          (p.i ? '<img src="' + esc(p.i) + '" alt="" loading="lazy">' : "") +
          '<span class="nv-leia-tit">' + esc(p.t) + "</span>" +
          '<span class="nv-leia-meta">' + esc(d) + "</span></a>";
      }).join("") + "</div>";
      return true;
    }

    var bloco = el("div", "nv-pos-post");
    antesDoTopo(main, bloco);
    fetch("/posts.html", { credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (html) {
      var m = html.match(/<script type="application\/json" id="nv-indice-posts">([\s\S]*?)<\/script>/);
      var indice = m ? JSON.parse(m[1]) : [];
      var atual = indice.filter(function (p) { return p.u === caminho; })[0];
      if (montaRelacionados(indice, atual)) bloco.appendChild(leia);
      montaCitacao(atual);
      bloco.appendChild(citar);
      bloco.appendChild(share);
    }).catch(function () {
      montaCitacao(null);
      bloco.appendChild(citar);
      bloco.appendChild(share);
    });
  }

  /* ======================= Agenda ======================= */
  function linksAgenda(ev) {
    var ini = ev.data, fim = new Date(ini.getTime() + 86400000);
    function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); }
    var g = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(ev.titulo) +
      "&dates=" + ymd(ini) + "/" + ymd(fim) +
      "&details=" + encodeURIComponent((ev.detalhe ? ev.detalhe + "\n" : "") + ev.url) +
      (ev.local ? "&location=" + encodeURIComponent(ev.local) : "");
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//contabiliDados//Agenda//PT", "BEGIN:VEVENT",
      "UID:" + ymd(ini) + "-" + ev.url.replace(/[^a-z0-9]/gi, "") + "@contabilidados.com.br",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
      "DTSTART;VALUE=DATE:" + ymd(ini), "DTEND;VALUE=DATE:" + ymd(fim),
      "SUMMARY:" + ev.titulo.replace(/[,;]/g, "\\$&"),
      (ev.local ? "LOCATION:" + ev.local.replace(/[,;]/g, "\\$&") : ""),
      "URL:" + ev.url, "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
    var nome = ev.titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 50) + ".ics";
    return '<div class="nv-agenda"><span><i class="bi bi-calendar-plus" aria-hidden="true"></i> Adicionar à agenda:</span>' +
      '<a href="' + esc(g) + '" target="_blank" rel="noopener">Google Agenda</a>' +
      '<a href="data:text/calendar;charset=utf-8,' + encodeURIComponent(ics) + '" download="' + esc(nome) + '">Outlook / Apple (.ics)</a></div>';
  }
  function dataDe(texto) {
    var m = String(texto || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = String(texto || "").match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  var hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);

  /* página de um evento */
  if (main && /\/eventos\/.+\.html$/.test(caminho)) {
    var b = Array.prototype.filter.call(main.querySelectorAll("b"), function (x) { return /Data\/Hora do Evento/i.test(x.textContent); })[0];
    var lb = Array.prototype.filter.call(main.querySelectorAll("b"), function (x) { return /^Local/i.test(x.textContent.trim()); })[0];
    if (b) {
      var dtxt = b.nextSibling ? b.nextSibling.textContent : "";
      var d = dataDe(dtxt);
      if (d && d >= hoje0) {
        var ev = { titulo: ((document.querySelector("h1.title") || {}).textContent || document.title).trim(), data: d,
          local: lb && lb.nextSibling ? lb.nextSibling.textContent.trim() : "", url: location.origin + caminho };
        var box = el("div", null, linksAgenda(ev));
        var h = main.querySelector("h2");
        if (h) main.insertBefore(box.firstChild, h); else antesDoTopo(main, box.firstChild);
      }
    }
  }

  /* lista de próximos eventos (página Eventos): mostra só os futuros */
  document.querySelectorAll("[data-nv-agenda-lista]").forEach(function (lista) {
    var n = 0;
    lista.querySelectorAll("[data-nv-evento]").forEach(function (card) {
      var d = dataDe(card.getAttribute("data-quando"));
      var futuro = d && d >= hoje0;
      card.hidden = !futuro;
      if (futuro) n++;
    });
    var vazio = lista.querySelector(".nv-agenda-vazio");
    if (vazio) vazio.hidden = n > 0;
  });
  document.querySelectorAll("[data-nv-evento]").forEach(function (card) {
    var d = dataDe(card.getAttribute("data-quando"));
    if (!d || d < hoje0) return;
    var ev = { titulo: card.getAttribute("data-titulo") || "", data: d, local: card.getAttribute("data-local") || "",
      url: new URL(card.getAttribute("data-url") || "", location.href).href };
    var alvo = card.querySelector("[data-nv-agenda]") || card;
    alvo.insertAdjacentHTML("beforeend", linksAgenda(ev));
  });
})();
