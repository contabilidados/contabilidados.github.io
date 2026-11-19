/* Indicadores Contábeis das Companhias Abertas (contabiliDados)
   App estático: lê os JSON gerados por scripts/atualizar_indicadores.R */
(function () {
  "use strict";

  var IND = {
    lc:  { nome: "Liquidez corrente", grupo: "liquidez", fmt: "x", formula: "Ativo circulante ÷ Passivo circulante", maior: true },
    ls:  { nome: "Liquidez seca", grupo: "liquidez", fmt: "x", formula: "(Ativo circulante − Estoques) ÷ Passivo circulante", maior: true },
    li:  { nome: "Liquidez imediata", grupo: "liquidez", fmt: "x", formula: "Caixa e equivalentes ÷ Passivo circulante", maior: true },
    lg:  { nome: "Liquidez geral", grupo: "liquidez", fmt: "x", formula: "(Ativo circulante + Realizável a longo prazo) ÷ (Passivo circulante + Passivo não circulante)", maior: true },
    eg:  { nome: "Endividamento geral", grupo: "endividamento", fmt: "%", formula: "(Passivo circulante + Passivo não circulante) ÷ Ativo total", maior: false },
    ce:  { nome: "Composição do endividamento", grupo: "endividamento", fmt: "%", formula: "Passivo circulante ÷ (Passivo circulante + Passivo não circulante)", maior: false },
    pct: { nome: "Participação de capital de terceiros", grupo: "endividamento", fmt: "x", formula: "(Passivo circulante + Passivo não circulante) ÷ Patrimônio líquido", maior: false },
    alav: { nome: "Alavancagem (Ativo ÷ PL)", grupo: "endividamento", fmt: "x", formula: "Ativo total ÷ Patrimônio líquido (instituições financeiras e seguradoras)", maior: false, fin: true },
    roe: { nome: "Rentabilidade do PL (ROE)", grupo: "rentabilidade", fmt: "%", formula: "Lucro líquido ÷ Patrimônio líquido", maior: true },
    roa: { nome: "Rentabilidade do ativo (ROA)", grupo: "rentabilidade", fmt: "%", formula: "Lucro líquido ÷ Ativo total", maior: true },
    mb:  { nome: "Margem bruta", grupo: "rentabilidade", fmt: "%", formula: "Resultado bruto ÷ Receita de vendas", maior: true },
    mo:  { nome: "Margem operacional", grupo: "rentabilidade", fmt: "%", formula: "Resultado antes do resultado financeiro e dos tributos ÷ Receita de vendas", maior: true },
    ml:  { nome: "Margem líquida", grupo: "rentabilidade", fmt: "%", formula: "Lucro líquido ÷ Receita de vendas", maior: true },
    ga:  { nome: "Giro do ativo", grupo: "rentabilidade", fmt: "x", formula: "Receita de vendas ÷ Ativo total", maior: true },
    mf:  { nome: "Margem financeira", grupo: "rentabilidade", fmt: "%", formula: "Resultado bruto da intermediação financeira ÷ Ativo total (instituições financeiras)", maior: true, fin: true },
    ids: { nome: "Índice de despesas de seguro", grupo: "rentabilidade", fmt: "%", formula: "Despesas da atividade seguradora ÷ Receitas da atividade seguradora (sinistralidade ampliada)", maior: false, fin: true },
    icb: { nome: "Índice combinado (aproximado)", grupo: "rentabilidade", fmt: "%", formula: "(Despesas da atividade seguradora + Despesas administrativas) ÷ Receitas da atividade seguradora", maior: false, fin: true }
  };
  var GRUPOS = {
    liquidez: ["lc", "ls", "li", "lg"],
    endividamento: ["eg", "ce", "pct", "alav"],
    rentabilidade: ["roe", "roa", "ml", "mb", "mo", "ga", "mf", "ids", "icb"]
  };
  var TIPOS = {
    g: { nome: "Demais companhias" },
    c: { nome: "Concessão de serviço público", aviso: "Concessões de energia, saneamento e infraestrutura de transporte reconhecem receita de construção da infraestrutura com margem próxima de zero (ICPC 01 e OCPC 05) e registram ativos da concessão (CPC 47). As margens e o giro do ativo podem ficar distorcidos; a DFP padronizada não separa a receita de construção." },
    k: { nome: "Construção civil", aviso: "Na construção civil o circulante segue o ciclo operacional, que pode passar de 12 meses, e os estoques incluem terrenos e imóveis a comercializar. Os índices de liquidez tendem a ser altos e são pouco comparáveis com outros setores." },
    a: { nome: "Agronegócio", aviso: "Ativos biológicos são avaliados a valor justo (CPC 29), e os ganhos e perdas de valor justo entram no resultado, afetando as margens." },
    h: { nome: "Holding sem receita operacional", aviso: "Sem receita operacional no ano: o resultado vem principalmente da equivalência patrimonial. Margens e giro do ativo não são calculados." },
    z: { nome: "Securitizadora", aviso: "Securitizadoras têm balanço de repasse de recebíveis e patrimônio líquido pequeno; ROE e endividamento ficam extremos. Elas ficam fora da mediana de todas as companhias e do ranking padrão." },
    s: { nome: "Seguradora", aviso: "Seguradoras seguem normas próprias (SUSEP e IFRS 17); liquidez, endividamento, margem bruta e giro não se aplicam. São mostrados ROE, ROA, margem líquida, alavancagem e, quando a DFP usa o modelo de seguradoras, os índices de despesas de seguro e combinado." },
    b: { nome: "Instituição financeira", aviso: "Instituições financeiras usam um modelo de DFP próprio, sem circulante e não circulante; liquidez, endividamento, margens e giro não se aplicam. São mostrados ROE, ROA, alavancagem e margem financeira." }
  };
  var FORA_GERAL = { b: 1, s: 1, z: 1 };   // fora das comparações gerais
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  var D, E, M, META;          // dados, empresas, medianas, meta
  var porEmpresa = {};        // cvm -> [índices de linha]
  var empIdx = {};            // cvm -> índice em E
  var medIdx = {};            // setor|ano -> índice em M
  var estado = { cvm: null, aba: "liquidez", comparar: "setor", rank: { ano: null, ind: "roe", setor: "", ativas: true, minAt: 0, ord: -1 } };
  var graficos = [];

  /* ---------- formatação ---------- */
  var nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function fmtInd(k, v) {
    if (v == null || !isFinite(v)) return "–";
    return IND[k].fmt === "%" ? nf1.format(v * 100) + "%" : nf2.format(v);
  }
  function fmtMil(v) { // valores em R$ mil
    if (v == null || !isFinite(v)) return "–";
    var a = Math.abs(v) * 1000, s = v < 0 ? "−" : "";
    if (a >= 1e9) return s + "R$ " + nf1.format(a / 1e9) + " bi";
    if (a >= 1e6) return s + "R$ " + nf1.format(a / 1e6) + " mi";
    if (a >= 1e3) return s + "R$ " + nf1.format(a / 1e3) + " mil";
    return s + "R$ " + nf2.format(a);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  /* ---------- dados ---------- */
  function carrega() {
    return Promise.all(["indicadores", "empresas", "medianas", "meta"].map(function (n) {
      return fetch("dados/" + n + ".json").then(function (r) { if (!r.ok) throw new Error(n); return r.json(); });
    })).then(function (r) {
      D = r[0]; E = r[1]; M = r[2]; META = r[3];
      D.cvm.forEach(function (c, i) { (porEmpresa[c] = porEmpresa[c] || []).push(i); });
      E.cvm.forEach(function (c, i) { empIdx[c] = i; });
      M.setor.forEach(function (s, i) { medIdx[s + "|" + M.ano[i]] = i; });
      estado.rank.ano = META.anos[1];
    });
  }
  function serie(cvm) {
    return (porEmpresa[cvm] || []).slice().sort(function (a, b) { return D.ano[a] - D.ano[b]; });
  }
  function mediana(setor, ano, k) {
    var i = medIdx[(estado.comparar === "todas" ? "Todas as companhias" : setor) + "|" + ano];
    return i == null ? null : M[k][i];
  }

  /* ---------- estado na URL ---------- */
  function leHash() {
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.get("cvm") && empIdx[h.get("cvm")] != null) estado.cvm = h.get("cvm");
    if (h.get("aba") && document.querySelector('[data-aba="' + h.get("aba") + '"]')) estado.aba = h.get("aba");
    if (h.get("comparar") === "todas") estado.comparar = "todas";
  }
  function gravaHash() {
    var p = new URLSearchParams();
    if (estado.cvm) p.set("cvm", estado.cvm);
    p.set("aba", estado.aba);
    if (estado.comparar === "todas") p.set("comparar", "todas");
    history.replaceState(null, "", "#" + p.toString());
  }

  /* ---------- ficha e KPIs ---------- */
  function ficha() {
    var e = empIdx[estado.cvm];
    document.getElementById("f-nome").textContent = E.nome[e];
    document.getElementById("f-razao").textContent = E.razao[e] + " · CNPJ " + E.cnpj[e] + " · Código CVM " + estado.cvm;
    var tags = [];
    (E.tk[e] ? E.tk[e].split(" ") : []).slice(0, 6).forEach(function (t) { tags.push('<span class="tag tag-tk">' + esc(t) + "</span>"); });
    tags.push('<span class="tag">' + esc(E.setor[e]) + "</span>");
    tags.push('<span class="tag">' + (E.ativa[e] ? "Registro ativo" : "Registro não ativo") + "</span>");
    var linhas = serie(estado.cvm), ult = linhas[linhas.length - 1];
    if (ult != null) {
      tags.push('<span class="tag">' + (D.con[ult] ? "Demonstrações consolidadas" : "Demonstrações individuais") + "</span>");
      if (D.tipo[ult] !== "g") tags.push('<span class="tag tag-tipo">' + TIPOS[D.tipo[ult]].nome + "</span>");
      if (D.mes[ult] && D.mes[ult] !== 12) tags.push('<span class="tag tag-alerta">Exercício encerra em ' + MESES[D.mes[ult] - 1] + "</span>");
    }
    if (E.situacao && E.situacao[e]) tags.push('<span class="tag tag-alerta">' + esc(E.situacao[e].charAt(0) + E.situacao[e].slice(1).toLowerCase()) + "</span>");
    document.getElementById("f-tags").innerHTML = tags.join("");
    var avisos = [];
    if (ult != null && TIPOS[D.tipo[ult]].aviso) avisos.push(TIPOS[D.tipo[ult]].aviso);
    if (ult != null && D.mes[ult] && D.mes[ult] !== 12) avisos.push("O exercício social termina em " + MESES[D.mes[ult] - 1] + "; cada \u201cano\u201d cobre um período diferente do das companhias com exercício em dezembro, o que afeta a comparação com a mediana do setor.");
    if (E.situacao && /RECUPERA|FAL|LIQUIDA/.test(E.situacao[e] || "")) avisos.push("Situação na CVM: " + E.situacao[e].toLowerCase() + ". Os índices podem refletir reestruturação de dívidas ou passivo a descoberto.");
    document.getElementById("f-avisos").innerHTML = avisos.map(function (a) { return '<p class="aviso-tipo"><strong>Atenção:</strong> ' + a + "</p>"; }).join("");
    document.getElementById("f-docs").href = "../cntdd_linksDFS/";

    var k = [
      { rot: "Receita de vendas", campo: "receita", fmt: fmtMil },
      { rot: "Lucro líquido", campo: "ll", fmt: fmtMil },
      { rot: "Rentabilidade do PL", campo: "roe", fmt: function (v) { return fmtInd("roe", v); } },
      { rot: "Liquidez corrente", campo: "lc", fmt: function (v) { return fmtInd("lc", v); } }
    ];
    if (ult == null) { document.getElementById("kpis").innerHTML = ""; return; }
    if (D.tipo[ult] === "b") k[0].rot = "Receitas de intermediação";
    if (D.tipo[ult] === "s") k[0].rot = "Receitas";
    if (D.tipo[ult] === "h") k[0].rot = "Receita operacional";
    if (FORA_GERAL[D.tipo[ult]] && D.tipo[ult] !== "z") k[3] = { rot: "Alavancagem (Ativo ÷ PL)", campo: "alav", fmt: function (v) { return fmtInd("alav", v); } };
    var ant = linhas.length > 1 ? linhas[linhas.length - 2] : null;
    document.getElementById("kpis").innerHTML = k.map(function (x) {
      var v = D[x.campo][ult], va = ant != null ? D[x.campo][ant] : null, varTxt = "";
      if (v != null && va != null && isFinite(v) && isFinite(va)) {
        var sobe = v > va;
        var dif = x.campo === "roe" ? nf1.format((v - va) * 100) + " p.p." :
                  (x.campo === "lc" || x.campo === "alav") ? nf2.format(v - va) :
                  (va !== 0 ? nf1.format(((v - va) / Math.abs(va)) * 100) + "%" : "");
        if (dif) varTxt = '<span class="' + (sobe ? "up" : "down") + '">' + (sobe ? "▲ +" : "▼ ") + dif.replace(/^-/, "−") + "</span> vs. " + D.ano[ant];
      }
      return '<div class="kpi"><div class="kpi-rot">' + x.rot + " · " + D.ano[ult] + '</div><div class="kpi-val">' + x.fmt(v) + '</div><div class="kpi-var">' + (varTxt || "&nbsp;") + "</div></div>";
    }).join("");
  }

  /* ---------- abas de indicadores ---------- */
  function limpaGraficos() { graficos.forEach(function (g) { g.destroy(); }); graficos = []; }

  function abaGrupo(grupo) {
    var e = empIdx[estado.cvm], setor = E.setor[e], linhas = serie(estado.cvm);
    var anos = linhas.map(function (i) { return D.ano[i]; });
    var nomeComp = estado.comparar === "todas" ? "Mediana de todas as companhias" : "Mediana do setor";
    var lista = GRUPOS[grupo].filter(function (k) { return linhas.some(function (i) { return D[k][i] != null; }); });
    if (!lista.length) {
      var t = linhas.length ? TIPOS[D.tipo[linhas[linhas.length - 1]]] : null;
      document.getElementById("conteudo").innerHTML = '<div class="metodo"><p>Os indicadores de ' + grupo + " não se aplicam a esta empresa." + (t && t.aviso ? " " + t.aviso : "") + "</p></div>";
      return;
    }
    var html = '<div class="legenda"><span><i class="l1"></i>' + esc(E.nome[e]) + '</span><span><i class="l2"></i>' + nomeComp + "</span></div>";
    if (grupo === "endividamento") html += '<p class="nota-serie">A linha vertical em 2019 marca a adoção do CPC 06 (R2)/IFRS 16: os arrendamentos passaram a compor o passivo, o que eleva o endividamento a partir desse ano.</p>';
    html += '<div class="grade-graf">' + lista.map(function (k) {
      return '<div class="graf"><h3>' + IND[k].nome + '</h3><div class="formula">' + IND[k].formula + '</div><div class="area"><canvas id="g-' + k + '" role="img" aria-label="' + IND[k].nome + ' de ' + esc(E.nome[e]) + ' por ano"></canvas></div></div>';
    }).join("") + "</div>";
    // tabela
    html += '<div class="tab-wrap"><table><thead><tr><th>Indicador</th>' + anos.map(function (a) { return "<th>" + a + "</th>"; }).join("") + "</tr></thead><tbody>";
    lista.forEach(function (k) {
      html += "<tr><td>" + IND[k].nome + "</td>" + linhas.map(function (i) { var v = D[k][i]; return '<td class="' + (v == null ? "na" : "") + '">' + fmtInd(k, v) + "</td>"; }).join("") + "</tr>";
      html += '<tr><td style="color:var(--suave)">↳ ' + nomeComp.toLowerCase() + "</td>" + anos.map(function (a) { var v = mediana(setor, a, k); return '<td class="na">' + fmtInd(k, v) + "</td>"; }).join("") + "</tr>";
    });
    html += "</tbody></table></div>";
    document.getElementById("conteudo").innerHTML = html;

    var c1 = css("--serie1"), c2 = css("--serie2"), grade = css("--grade"), suave = css("--suave");
    lista.forEach(function (k) {
      var vals = linhas.map(function (i) { var v = D[k][i]; return v == null ? null : (IND[k].fmt === "%" ? v * 100 : v); });
      var meds = anos.map(function (a) { var v = mediana(setor, a, k); return v == null ? null : (IND[k].fmt === "%" ? v * 100 : v); });
      var cv = document.getElementById("g-" + k);
      if (!vals.some(function (v) { return v != null; })) {
        cv.parentNode.innerHTML = '<div class="vazio">Indicador não aplicável a esta empresa (por exemplo, bancos e seguradoras não separam circulante e não circulante).</div>';
        return;
      }
      graficos.push(new Chart(cv, {
        type: "line",
        data: { labels: anos, datasets: [
          { label: E.nome[e], data: vals, borderColor: c1, backgroundColor: c1, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, spanGaps: true, tension: 0 },
          { label: nomeComp, data: meds, borderColor: c2, backgroundColor: c2, borderWidth: 2, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 4, spanGaps: true, tension: 0 }
        ] },
        plugins: (grupo === "endividamento" && anos.indexOf(2019) > 0) ? [marcoIFRS16] : [],
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: function (c) { return " " + c.dataset.label + ": " + (c.raw == null ? "–" : (IND[k].fmt === "%" ? nf1.format(c.raw) + "%" : nf2.format(c.raw))); } } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: suave, maxRotation: 0, autoSkipPadding: 10 } },
            y: { grid: { color: grade }, border: { display: false }, ticks: { color: suave, maxTicksLimit: 5, callback: function (v) { return IND[k].fmt === "%" ? nf1.format(v) + "%" : nf2.format(v); } } }
          }
        }
      }));
    });
  }

  var marcoIFRS16 = {
    id: "ifrs16",
    afterDatasetsDraw: function (ch) {
      var x = ch.scales.x, y = ch.scales.y, i = ch.data.labels.indexOf(2019);
      if (i < 0) return;
      var px = x.getPixelForValue(i), ctx = ch.ctx;
      ctx.save(); ctx.strokeStyle = css("--suave"); ctx.globalAlpha = .6; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, y.top); ctx.lineTo(px, y.bottom); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.fillStyle = css("--suave"); ctx.font = "11px Roboto, sans-serif";
      ctx.fillText("IFRS 16", px + 4, y.top + 10); ctx.restore();
    }
  };

  /* ---------- ranking ---------- */
  function abaRanking() {
    var r = estado.rank;
    var anos = []; for (var a = META.anos[1]; a >= META.anos[0]; a--) anos.push(a);
    var setores = Array.from(new Set(E.setor)).sort(function (x, y) { return x.localeCompare(y, "pt"); });
    var html = '<div class="rank-filtros">' +
      '<div class="campo"><label for="r-ind">Indicador</label><select id="r-ind" class="sel">' + Object.keys(IND).map(function (k) { return '<option value="' + k + '"' + (k === r.ind ? " selected" : "") + ">" + IND[k].nome + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="r-ano">Ano</label><select id="r-ano" class="sel">' + anos.map(function (a) { return "<option" + (a === r.ano ? " selected" : "") + ">" + a + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo" style="flex:1"><label for="r-setor">Setor</label><select id="r-setor" class="sel"><option value="">Todos os setores</option>' + setores.map(function (s) { return '<option value="' + esc(s) + '"' + (s === r.setor ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="r-min">Ativo total mínimo</label><select id="r-min" class="sel">' +
        [[0, "Qualquer"], [1e5, "R$ 100 mi"], [1e6, "R$ 1 bi"], [1e7, "R$ 10 bi"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === r.minAt ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>" +
      '<label class="chk"><input type="checkbox" id="r-ativas"' + (r.ativas ? " checked" : "") + "> Só com registro ativo</label>" +
      '<label class="chk"><input type="checkbox" id="r-fin"' + (r.fin ? " checked" : "") + "> Incluir bancos, seguradoras e securitizadoras</label></div>" +
      '<div class="tab-wrap"><table class="rank-tab"><thead><tr><th>#</th><th>Empresa</th><th>Setor</th><th data-ord="v">' + IND[r.ind].nome + ' ⇅</th><th data-ord="at">Ativo total</th></tr></thead><tbody id="r-corpo"></tbody></table></div>' +
      '<p class="rank-info" id="r-info"></p>';
    document.getElementById("conteudo").innerHTML = html;

    function atualiza() {
      var lin = [];
      for (var i = 0; i < D.ano.length; i++) {
        if (D.ano[i] !== r.ano) continue;
        var v = D[r.ind][i]; if (v == null || !isFinite(v)) continue;
        var e = empIdx[D.cvm[i]]; if (e == null) continue;
        if (r.setor && E.setor[e] !== r.setor) continue;
        if (r.ativas && !E.ativa[e]) continue;
        if (D.at[i] < r.minAt) continue;
        if (!IND[r.ind].fin && !r.fin && FORA_GERAL[D.tipo[i]]) continue;
        lin.push({ cvm: D.cvm[i], e: e, v: v, at: D.at[i] });
      }
      var chave = r.ordCampo || "v";
      lin.sort(function (a, b) { return r.ord * (a[chave] - b[chave]); });
      var top = lin.slice(0, 100);
      document.getElementById("r-corpo").innerHTML = top.map(function (x, n) {
        return '<tr data-cvm="' + x.cvm + '"><td>' + (n + 1) + "</td><td><strong>" + esc(E.nome[x.e]) + "</strong>" + (E.tk[x.e] ? ' <span style="color:var(--suave)">' + esc(E.tk[x.e].split(" ")[0]) + "</span>" : "") +
          '</td><td style="text-align:left;white-space:normal">' + esc(E.setor[x.e]) + "</td><td>" + fmtInd(r.ind, x.v) + "</td><td>" + fmtMil(x.at) + "</td></tr>";
      }).join("") || '<tr><td colspan="5" class="na" style="text-align:center">Nenhuma empresa com esses filtros.</td></tr>';
      document.getElementById("r-info").textContent = lin.length + " empresas com o indicador em " + r.ano + (lin.length > 100 ? "; exibindo as 100 primeiras" : "") + "." + (!IND[r.ind].fin && !r.fin ? " Bancos, seguradoras e securitizadoras estão fora (marque a opção acima para incluí-los)." : "") + " Clique numa linha para ver a empresa. Clique no cabeçalho para inverter a ordem.";
    }
    ["r-ind", "r-ano", "r-setor", "r-min", "r-ativas", "r-fin"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", function () {
        r.ind = document.getElementById("r-ind").value;
        r.ano = +document.getElementById("r-ano").value;
        r.setor = document.getElementById("r-setor").value;
        r.minAt = +document.getElementById("r-min").value;
        r.ativas = document.getElementById("r-ativas").checked;
        r.fin = document.getElementById("r-fin").checked;
        if (id === "r-ind") { r.ord = IND[r.ind].maior ? -1 : 1; r.ordCampo = "v"; document.querySelector('[data-ord="v"]').textContent = IND[r.ind].nome + " ⇅"; }
        atualiza();
      });
    });
    document.querySelectorAll(".rank-tab th[data-ord]").forEach(function (th) {
      th.addEventListener("click", function () {
        if (r.ordCampo === th.dataset.ord) r.ord = -r.ord; else { r.ordCampo = th.dataset.ord; r.ord = -1; }
        atualiza();
      });
    });
    document.getElementById("r-corpo").addEventListener("click", function (ev) {
      var tr = ev.target.closest("tr[data-cvm]"); if (!tr) return;
      escolhe(tr.dataset.cvm, "rentabilidade"); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    atualiza();
  }

  /* ---------- metodologia ---------- */
  function abaMetodologia() {
    var hoje = new Date();
    var MES = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
    var acesso = hoje.getDate() + " " + MES[hoje.getMonth()] + " " + hoje.getFullYear();
    function tabela(cab, linhas) {
      return '<div class="tab-wrap" style="margin-top:.4rem"><table><thead><tr>' + cab.map(function (c) { return "<th>" + c + "</th>"; }).join("") +
        "</tr></thead><tbody>" + linhas.map(function (l) { return "<tr>" + l.map(function (c, i) { return "<td>" + (i === 0 ? "<strong>" + c + "</strong>" : c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
    }
    var formulas = Object.keys(IND).map(function (k) { return [IND[k].nome, IND[k].formula, IND[k].fmt === "%" ? "%" : "vezes", IND[k].maior ? "Maior" : "Menor"]; });

    var html = '<div class="metodo">' +
      '<nav class="metodo-sumario" aria-label="Seções da metodologia">' +
      ['Objetivo', 'Fonte e cobertura', 'Etapas de cálculo', 'Contas utilizadas', 'Fórmulas', 'Tratamento por tipo de empresa', 'Medianas e ranking', 'Quebras de série', 'Limitações', 'Atualização e código', 'Como citar']
        .map(function (t, i) { return '<a href="#m' + i + '" data-alvo="m' + i + '">' + t + "</a>"; }).join(" · ") + "</nav>" +

      '<h3 id="m0">1. Objetivo</h3>' +
      "<p>O painel reúne indicadores de liquidez, endividamento e rentabilidade das companhias abertas brasileiras, calculados de forma padronizada a partir das demonstrações financeiras enviadas à Comissão de Valores Mobiliários (CVM). Destina-se ao ensino de análise das demonstrações contábeis e a pesquisas exploratórias, permitindo acompanhar a evolução de cada companhia e compará-la com a mediana do seu setor.</p>" +

      '<h3 id="m1">2. Fonte e cobertura</h3><ul>' +
      "<li><strong>Demonstrações Financeiras Padronizadas (DFP)</strong> anuais, arquivos <code>dfp_cia_aberta_AAAA.zip</code> do <a href=\"https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp\" target=\"_blank\" rel=\"noopener\">Portal de Dados Abertos da CVM</a>: Balanço Patrimonial Ativo (BPA), Balanço Patrimonial Passivo (BPP) e Demonstração do Resultado (DRE).</li>" +
      "<li><strong>Cadastro de companhias abertas</strong> (<code>cad_cia_aberta.csv</code>): nome de pregão, setor de atividade, situação do registro e situação do emissor.</li>" +
      "<li><strong>Formulário Cadastral (FCA)</strong>, arquivo de valores mobiliários dos dois anos mais recentes: códigos de negociação na bolsa.</li>" +
      "<li><strong>Período:</strong> " + META.anos[0] + " a " + META.anos[1] + ". O ano corrente só entra quando pelo menos 200 companhias tiverem entregado a DFP, para evitar medianas baseadas em poucas empresas.</li>" +
      "<li><strong>Cobertura atual:</strong> " + META.n_empresas.toLocaleString("pt-BR") + " companhias e " + META.n_linhas.toLocaleString("pt-BR") + " demonstrações anuais. Entram todas as companhias que entregaram DFP no período, inclusive as que tiveram o registro cancelado depois (até o último ano entregue).</li></ul>" +

      '<h3 id="m2">3. Etapas de cálculo</h3><ol>' +
      "<li><strong>Exercício de referência:</strong> de cada arquivo anual usa-se apenas o exercício do próprio ano (coluna ORDEM_EXERC = “ÚLTIMO”); os valores comparativos do ano anterior não são utilizados.</li>" +
      "<li><strong>Versão:</strong> quando a companhia reapresenta a DFP, considera-se a versão mais recente entregue para aquele ano.</li>" +
      "<li><strong>Consolidado ou individual:</strong> usam-se as demonstrações consolidadas quando a companhia as apresenta com ativo total diferente de zero; caso contrário, as individuais. A ficha da empresa indica qual base foi usada no último ano.</li>" +
      "<li><strong>Escala:</strong> todos os valores são convertidos para milhares de reais (R$ mil), conforme o campo ESCALA_MOEDA.</li>" +
      "<li><strong>Identificação das contas:</strong> pelo código do plano de contas padronizado da CVM, conferindo a descrição da conta (ver seção 4).</li>" +
      "<li><strong>Classificação do tipo de empresa</strong> e cálculo apenas dos índices aplicáveis a cada tipo (seção 6).</li>" +
      "<li><strong>Medianas</strong> por setor e ano e mediana geral (seção 7).</li></ol>" +

      '<h3 id="m3">4. Contas utilizadas</h3>' +
      tabela(["Conta", "Código CVM", "Observação"], [
        ["Ativo total", "1", ""],
        ["Ativo circulante", "1.01", "Exige a descrição “Ativo Circulante”; ausente no modelo de instituições financeiras"],
        ["Caixa e equivalentes de caixa", "1.01.01", "Não inclui aplicações financeiras (1.01.02)"],
        ["Estoques", "1.01.04", "Considerado zero quando a conta não existe"],
        ["Realizável a longo prazo", "1.02.01", "Considerado zero quando a conta não existe"],
        ["Passivo circulante", "2.01", ""],
        ["Passivo não circulante", "2.02", "Considerado zero quando a conta não existe"],
        ["Patrimônio líquido", "2.03 (2.07 ou 2.08 em bancos)", "Conta de 2º nível do passivo com a descrição “Patrimônio Líquido”; inclui não controladores no consolidado"],
        ["Receita", "3.01", "Receita de venda de bens e serviços; em bancos, receitas da intermediação financeira; em seguradoras, receitas da atividade seguradora"],
        ["Resultado bruto", "3.03", ""],
        ["Resultado antes do resultado financeiro e dos tributos", "3.05", "Usado na margem operacional"],
        ["Lucro líquido", "3.11 ou 3.13", "Última conta de 2º nível “Lucro/Prejuízo do Período”; inclui não controladores no consolidado"],
        ["Despesas da atividade seguradora", "3.02", "Somente no modelo de DFP de seguradoras"],
        ["Despesas administrativas de seguradoras", "3.04", "Somente no modelo de DFP de seguradoras"],
        ["Resultado bruto da intermediação financeira", "3.03", "Somente no modelo de instituições financeiras"]
      ]) +

      '<h3 id="m4">5. Fórmulas</h3>' + tabela(["Indicador", "Fórmula", "Unidade", "Melhor quando"], formulas) +
      "<p class=\"nota-serie\" style=\"margin-top:.5rem\">“Melhor quando” orienta a ordem do ranking e deve ser lido com cautela: liquidez muito alta pode indicar recursos ociosos, e endividamento baixo pode indicar subaproveitamento de alavancagem.</p>" +
      "<p>Regras gerais: (i) os saldos patrimoniais são os do fim do exercício, sem média entre dois anos; (ii) ROE, participação de capital de terceiros e alavancagem só são calculados quando o patrimônio líquido é positivo; (iii) margens e giro só são calculados quando a receita é positiva; (iv) divisões por zero ficam em branco.</p>" +

      '<h3 id="m5">6. Tratamento por tipo de empresa</h3>' +
      "<p>Como o plano de contas e as normas contábeis variam entre segmentos, cada empresa-ano é classificada em um tipo. Quando uma empresa se encaixa em mais de um, prevalece o que aparece primeiro na tabela.</p>" +
      tabela(["Tipo", "Como é identificado", "Tratamento"], [
        ["Instituição financeira", "DFP no modelo de instituições financeiras, sem ativo e passivo circulantes", "Apenas ROE, ROA, alavancagem e margem financeira"],
        ["Seguradora", "DFP no modelo de seguradoras com receita positiva, ou setor Seguradoras e Corretoras com denominação de seguradora, resseguradora, previdência ou capitalização (exceto corretoras e participações)", "ROE, ROA, margem líquida e alavancagem; índice de despesas de seguro e índice combinado aproximado quando a DFP usa o modelo de seguradoras"],
        ["Securitizadora", "Setor Securitização de Recebíveis ou denominação com “securitiz”", "Todos os índices, mas fora da mediana geral e do ranking padrão"],
        ["Holding sem receita operacional", "Plano de contas geral e receita nula ou negativa no ano", "Sem margens e giro do ativo"],
        ["Concessão de serviço público", "Setores Energia Elétrica e Saneamento, e empresas de transporte com denominação de concessionária, rodovia, ferrovia, metrô, aeroporto ou porto", "Todos os índices, com aviso sobre receita de construção e ativos da concessão"],
        ["Construção civil", "Setor Construção Civil", "Todos os índices, com aviso sobre ciclo operacional longo"],
        ["Agronegócio", "Setor Agricultura (Açúcar, Álcool e Cana)", "Todos os índices, com aviso sobre ativos biológicos"],
        ["Demais companhias", "Demais casos", "Todos os índices"]
      ]) +

      '<h3 id="m6">7. Medianas e ranking</h3><ul>' +
      "<li><strong>Mediana do setor:</strong> mediana dos índices das empresas do mesmo setor (cadastro da CVM, com as holdings agrupadas como “Holding - setor”) em cada ano. Exige ao menos três empresas e exclui as que têm patrimônio líquido negativo.</li>" +
      "<li><strong>Mediana de todas as companhias:</strong> exclui instituições financeiras, seguradoras e securitizadoras; nos indicadores próprios de bancos e seguradoras (alavancagem, margem financeira e índices de seguro), considera apenas esses dois tipos.</li>" +
      "<li>Usa-se a <strong>mediana</strong>, e não a média, porque os índices têm valores extremos frequentes.</li>" +
      "<li><strong>Ranking:</strong> por padrão exclui bancos, seguradoras e securitizadoras e mostra as 100 primeiras empresas; os valores não são tratados para extremos, por isso recomenda-se usar o filtro de ativo total mínimo.</li></ul>" +

      '<h3 id="m7">8. Quebras de série</h3><ul>' +
      "<li><strong>2018, CPC 47/IFRS 15 e CPC 48/IFRS 9:</strong> mudanças no reconhecimento de receita e na mensuração de instrumentos financeiros.</li>" +
      "<li><strong>2019, CPC 06 (R2)/IFRS 16:</strong> arrendamentos passam a compor o passivo, elevando o endividamento (marcado nos gráficos).</li>" +
      "<li><strong>2023, IFRS 17 (CPC 50) em seguradoras:</strong> nova forma de apresentar receitas e despesas de seguros, que afeta os índices de seguradoras entre 2022 e 2023.</li>" +
      "<li><strong>Troca de base:</strong> se a empresa passa a apresentar (ou deixa de apresentar) demonstrações consolidadas, a série muda de base.</li>" +
      "<li><strong>Reorganizações societárias</strong> (fusões, cisões e incorporações) alteram a comparabilidade entre anos da mesma empresa.</li></ul>" +

      '<h3 id="m8">9. Limitações</h3><ol>' +
      "<li><strong>Cálculo automático e padronizado:</strong> não há ajustes analíticos, como exclusão de itens não recorrentes, reclassificações ou normalização de resultados.</li>" +
      "<li><strong>Classificação das contas pelas companhias:</strong> o plano de contas é padronizado, mas cada companhia decide em que linha registra certos itens; por exemplo, aplicações financeiras de alta liquidez podem estar fora de caixa e equivalentes, reduzindo a liquidez imediata.</li>" +
      "<li><strong>Saldos de fim de período:</strong> ROE e ROA usam o patrimônio e o ativo do fim do ano, e não a média; em empresas que cresceram ou fizeram aquisições no ano, esses índices podem ficar distorcidos.</li>" +
      "<li><strong>Participação dos não controladores:</strong> no consolidado, o lucro e o patrimônio incluem os não controladores; o ROE do acionista controlador pode ser diferente.</li>" +
      "<li><strong>Valores nominais:</strong> receitas, lucros e ativos não são corrigidos pela inflação; as variações exibidas nos destaques são nominais.</li>" +
      "<li><strong>Anos anteriores não reapresentados:</strong> usa-se a última versão da DFP de cada ano, mas não os valores comparativos reapresentados nas DFP dos anos seguintes.</li>" +
      "<li><strong>Concessões:</strong> a receita de construção não aparece separada na DFP padronizada e, por isso, não é excluída das margens e do giro.</li>" +
      "<li><strong>Seguradoras:</strong> o índice combinado é aproximado, pois a DFP não separa todas as despesas usadas no índice oficial da SUSEP; seguradoras que usam o modelo genérico de DFP (por exemplo, Porto Seguro) ficam sem os índices próprios de seguros.</li>" +
      "<li><strong>Instituições financeiras:</strong> indicadores prudenciais e operacionais (índice de Basileia, inadimplência, índice de eficiência) não constam da DFP e não são apresentados.</li>" +
      "<li><strong>Classificação automática:</strong> o tipo de empresa depende do setor do cadastro e de palavras na denominação social, e pode errar em casos de fronteira.</li>" +
      "<li><strong>Setor e situação atuais:</strong> o setor e a situação do emissor vêm do cadastro atual e são aplicados a todos os anos; mudanças de atividade ou uma recuperação judicial já encerrada não são refletidas na série.</li>" +
      "<li><strong>Medianas instáveis em setores pequenos:</strong> com poucas empresas (mínimo de três), a mediana pode variar muito de um ano para outro e, às vezes, coincidir com a própria empresa analisada.</li>" +
      "<li><strong>Exercício fora de dezembro:</strong> o “ano” é o do encerramento do exercício social; empresas com exercício em março, por exemplo, cobrem um período diferente das demais.</li>" +
      "<li><strong>Cobertura:</strong> só entram companhias com registro na CVM que entregaram a DFP; companhias fechadas, fundos e anos sem entrega ficam de fora. Os códigos de negociação vêm do FCA mais recente, e companhias canceladas podem aparecer sem código.</li>" +
      "<li><strong>Atraso e erros na fonte:</strong> os dados refletem o que as companhias enviaram à CVM; entregas atrasadas, erros de preenchimento e reapresentações posteriores afetam os índices até a próxima atualização.</li></ol>" +

      '<h3 id="m9">10. Atualização e código</h3>' +
      "<p>Os dados são atualizados automaticamente toda segunda-feira por um fluxo do GitHub Actions, que baixa os arquivos da CVM e recalcula os índices; os anos mais recentes são baixados de novo a cada execução para incorporar reapresentações. Última alteração dos dados: <strong>" + esc(META.atualizado) + "</strong>. O código-fonte do cálculo é aberto: <a href=\"https://github.com/contabilidados/contabilidados.github.io/blob/main/scripts/atualizar_indicadores.R\" target=\"_blank\" rel=\"noopener\">scripts/atualizar_indicadores.R</a>. Os dados de cada empresa podem ser baixados em CSV pelo botão “Baixar dados”.</p>" +

      '<h3 id="m10">11. Como citar</h3>' +
      '<div class="cita-painel"><p>CONTABILIDADOS. <strong>Indicadores Contábeis das Companhias Abertas</strong>. Mossoró: Universidade Federal Rural do Semi-Árido, ' + hoje.getFullYear() + ". Disponível em: https://contabilidados.com.br/cntdd_indicadores/. Acesso em: " + acesso + ".</p></div>" +

      "<h3>Aviso</h3><p>Material produzido pelo grupo contabiliDados (UFERSA) para fins de ensino e pesquisa. Os índices não substituem a leitura das demonstrações completas e das notas explicativas e não constituem recomendação de investimento.</p></div>";
    document.getElementById("conteudo").innerHTML = html;
    document.querySelectorAll(".metodo-sumario a").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var alvo = document.getElementById(a.dataset.alvo);
        if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* ---------- navegação ---------- */
  function mostra() {
    limpaGraficos();
    document.querySelectorAll(".abas button").forEach(function (b) { var on = b.dataset.aba === estado.aba; b.classList.toggle("ativa", on); b.setAttribute("aria-selected", on); });
    if (GRUPOS[estado.aba]) abaGrupo(estado.aba);
    else if (estado.aba === "ranking") abaRanking();
    else abaMetodologia();
    gravaHash();
  }
  function escolhe(cvm, aba) {
    estado.cvm = cvm; if (aba) estado.aba = aba;
    if (ts && ts.getValue() !== cvm) ts.setValue(cvm, true);
    ficha(); mostra();
  }

  function baixaCSV() {
    var e = empIdx[estado.cvm], linhas = serie(estado.cvm), ks = Object.keys(IND);
    var cab = ["ano", "codigo_cvm", "empresa", "base", "ativo_total_mil", "patrimonio_liquido_mil", "receita_mil", "lucro_liquido_mil"].concat(ks);
    var out = [cab.join(";")].concat(linhas.map(function (i) {
      return [D.ano[i], estado.cvm, '"' + E.nome[e].replace(/"/g, '""') + '"', D.con[i] ? "consolidado" : "individual", D.at[i], D.pl[i], D.receita[i], D.ll[i]]
        .concat(ks.map(function (k) { return D[k][i]; }))
        .map(function (v) { return v == null ? "" : String(v).replace(".", ","); }).join(";");
    }));
    var blob = new Blob(["﻿" + out.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "indicadores_" + estado.cvm + "_" + E.nome[e].normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_") + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- início ---------- */
  var ts;
  document.getElementById("tema").addEventListener("click", function () {
    var esc_ = document.documentElement.classList.toggle("escuro");
    try { localStorage.setItem("quarto-color-scheme", esc_ ? "alternate" : "default"); } catch (e) {}
    if (estado.cvm) mostra();
  });

  carrega().then(function () {
    leHash();
    var opcoes = E.cvm.map(function (c, i) {
      return { value: c, nome: E.nome[i], tk: E.tk[i], setor: E.setor[i], busca: [E.nome[i], E.razao[i], E.tk[i], c, E.cnpj[i]].join(" ") };
    });
    ts = new TomSelect("#empresa", {
      options: opcoes, valueField: "value", labelField: "nome", searchField: ["busca"], maxOptions: 60, maxItems: 1,
      render: {
        option: function (d) { return '<div><div class="opt-nome">' + esc(d.nome) + (d.tk ? " · " + esc(d.tk.split(" ").slice(0, 3).join(" ")) : "") + '</div><div class="opt-info">' + esc(d.setor) + " · CVM " + d.value + "</div></div>"; },
        item: function (d) { return "<div>" + esc(d.nome) + "</div>"; },
        no_results: function () { return '<div class="no-results">Nenhuma empresa encontrada.</div>'; }
      },
      onChange: function (v) { if (v) escolhe(v); }
    });
    document.getElementById("comparar").value = estado.comparar;
    document.getElementById("comparar").addEventListener("change", function () { estado.comparar = this.value; if (estado.cvm) mostra(); });
    document.querySelectorAll(".abas button").forEach(function (b) { b.addEventListener("click", function () { estado.aba = b.dataset.aba; mostra(); }); });
    document.getElementById("baixar").addEventListener("click", baixaCSV);
    document.getElementById("atualizado").textContent = "Dados de " + META.anos[0] + " a " + META.anos[1] + " · atualizados em " + META.atualizado + ".";

    if (!estado.cvm) { // padrão: Petrobras, se existir; senão a primeira
      var pad = E.cvm.filter(function (c, i) { return /\bPETR4\b/.test(E.tk[i]); })[0] || E.cvm[0];
      estado.cvm = pad;
    }
    window.addEventListener("hashchange", function () {
      var antes = estado.cvm, abaAntes = estado.aba; leHash();
      if (estado.cvm !== antes || estado.aba !== abaAntes) escolhe(estado.cvm);
    });
    document.getElementById("carregando").hidden = true;
    document.getElementById("painel").hidden = false;
    escolhe(estado.cvm);
  }).catch(function (err) {
    document.getElementById("carregando").textContent = "Não foi possível carregar os dados (" + err.message + "). Tente recarregar a página.";
  });
})();
