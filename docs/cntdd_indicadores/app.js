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
    roe: { nome: "Rentabilidade do PL (ROE)", grupo: "rentabilidade", fmt: "%", formula: "Lucro líquido ÷ Patrimônio líquido", maior: true },
    roa: { nome: "Rentabilidade do ativo (ROA)", grupo: "rentabilidade", fmt: "%", formula: "Lucro líquido ÷ Ativo total", maior: true },
    mb:  { nome: "Margem bruta", grupo: "rentabilidade", fmt: "%", formula: "Resultado bruto ÷ Receita de vendas", maior: true },
    mo:  { nome: "Margem operacional", grupo: "rentabilidade", fmt: "%", formula: "Resultado antes do resultado financeiro e dos tributos ÷ Receita de vendas", maior: true },
    ml:  { nome: "Margem líquida", grupo: "rentabilidade", fmt: "%", formula: "Lucro líquido ÷ Receita de vendas", maior: true },
    ga:  { nome: "Giro do ativo", grupo: "rentabilidade", fmt: "x", formula: "Receita de vendas ÷ Ativo total", maior: true }
  };
  var GRUPOS = {
    liquidez: ["lc", "ls", "li", "lg"],
    endividamento: ["eg", "ce", "pct"],
    rentabilidade: ["roe", "roa", "ml", "mb", "mo", "ga"]
  };

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
    if (ult != null) tags.push('<span class="tag">' + (D.con[ult] ? "Demonstrações consolidadas" : "Demonstrações individuais") + "</span>");
    document.getElementById("f-tags").innerHTML = tags.join("");
    document.getElementById("f-docs").href = "../cntdd_linksDFS/";

    var k = [
      { rot: "Receita de vendas", campo: "receita", fmt: fmtMil },
      { rot: "Lucro líquido", campo: "ll", fmt: fmtMil },
      { rot: "Rentabilidade do PL", campo: "roe", fmt: function (v) { return fmtInd("roe", v); } },
      { rot: "Liquidez corrente", campo: "lc", fmt: function (v) { return fmtInd("lc", v); } }
    ];
    if (ult == null) { document.getElementById("kpis").innerHTML = ""; return; }
    var ant = linhas.length > 1 ? linhas[linhas.length - 2] : null;
    document.getElementById("kpis").innerHTML = k.map(function (x) {
      var v = D[x.campo][ult], va = ant != null ? D[x.campo][ant] : null, varTxt = "";
      if (v != null && va != null && isFinite(v) && isFinite(va)) {
        var sobe = v > va;
        var dif = x.campo === "roe" ? nf1.format((v - va) * 100) + " p.p." :
                  x.campo === "lc" ? nf2.format(v - va) :
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
    var html = '<div class="legenda"><span><i class="l1"></i>' + esc(E.nome[e]) + '</span><span><i class="l2"></i>' + nomeComp + "</span></div>";
    html += '<div class="grade-graf">' + GRUPOS[grupo].map(function (k) {
      return '<div class="graf"><h3>' + IND[k].nome + '</h3><div class="formula">' + IND[k].formula + '</div><div class="area"><canvas id="g-' + k + '" role="img" aria-label="' + IND[k].nome + ' de ' + esc(E.nome[e]) + ' por ano"></canvas></div></div>';
    }).join("") + "</div>";
    // tabela
    html += '<div class="tab-wrap"><table><thead><tr><th>Indicador</th>' + anos.map(function (a) { return "<th>" + a + "</th>"; }).join("") + "</tr></thead><tbody>";
    GRUPOS[grupo].forEach(function (k) {
      html += "<tr><td>" + IND[k].nome + "</td>" + linhas.map(function (i) { var v = D[k][i]; return '<td class="' + (v == null ? "na" : "") + '">' + fmtInd(k, v) + "</td>"; }).join("") + "</tr>";
      html += '<tr><td style="color:var(--suave)">↳ ' + nomeComp.toLowerCase() + "</td>" + anos.map(function (a) { var v = mediana(setor, a, k); return '<td class="na">' + fmtInd(k, v) + "</td>"; }).join("") + "</tr>";
    });
    html += "</tbody></table></div>";
    document.getElementById("conteudo").innerHTML = html;

    var c1 = css("--serie1"), c2 = css("--serie2"), grade = css("--grade"), suave = css("--suave");
    GRUPOS[grupo].forEach(function (k) {
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
      '<label class="chk"><input type="checkbox" id="r-ativas"' + (r.ativas ? " checked" : "") + "> Só com registro ativo</label></div>" +
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
        lin.push({ cvm: D.cvm[i], e: e, v: v, at: D.at[i] });
      }
      var chave = r.ordCampo || "v";
      lin.sort(function (a, b) { return r.ord * (a[chave] - b[chave]); });
      var top = lin.slice(0, 100);
      document.getElementById("r-corpo").innerHTML = top.map(function (x, n) {
        return '<tr data-cvm="' + x.cvm + '"><td>' + (n + 1) + "</td><td><strong>" + esc(E.nome[x.e]) + "</strong>" + (E.tk[x.e] ? ' <span style="color:var(--suave)">' + esc(E.tk[x.e].split(" ")[0]) + "</span>" : "") +
          '</td><td style="text-align:left;white-space:normal">' + esc(E.setor[x.e]) + "</td><td>" + fmtInd(r.ind, x.v) + "</td><td>" + fmtMil(x.at) + "</td></tr>";
      }).join("") || '<tr><td colspan="5" class="na" style="text-align:center">Nenhuma empresa com esses filtros.</td></tr>';
      document.getElementById("r-info").textContent = lin.length + " empresas com o indicador em " + r.ano + (lin.length > 100 ? "; exibindo as 100 primeiras" : "") + ". Clique numa linha para ver a empresa. Clique no cabeçalho para inverter a ordem.";
    }
    ["r-ind", "r-ano", "r-setor", "r-min", "r-ativas"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", function () {
        r.ind = document.getElementById("r-ind").value;
        r.ano = +document.getElementById("r-ano").value;
        r.setor = document.getElementById("r-setor").value;
        r.minAt = +document.getElementById("r-min").value;
        r.ativas = document.getElementById("r-ativas").checked;
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
    var linhas = Object.keys(IND).map(function (k) { return "<tr><td><strong>" + IND[k].nome + "</strong></td><td>" + IND[k].formula + "</td><td>" + (IND[k].fmt === "%" ? "%" : "vezes") + "</td></tr>"; }).join("");
    document.getElementById("conteudo").innerHTML = '<div class="metodo">' +
      "<h3>Fonte dos dados</h3><p>Demonstrações Financeiras Padronizadas (DFP) anuais enviadas pelas companhias à Comissão de Valores Mobiliários (CVM), obtidas no " +
      '<a href="https://dados.cvm.gov.br/" target="_blank" rel="noopener">Portal de Dados Abertos da CVM</a>, de ' + META.anos[0] + " a " + META.anos[1] + ". O setor vem do cadastro de companhias abertas e os códigos de negociação, do Formulário Cadastral (FCA).</p>" +
      "<h3>Como os índices são calculados</h3><ul>" +
      "<li>Usam-se as demonstrações <strong>consolidadas</strong> quando a companhia as apresenta; caso contrário, as individuais.</li>" +
      "<li>Para cada ano, considera-se a versão mais recente da DFP entregue (inclui reapresentações).</li>" +
      "<li>Os saldos patrimoniais são os do <strong>fim do exercício</strong> (sem média entre dois anos).</li>" +
      "<li>O patrimônio líquido e o lucro líquido incluem a participação dos não controladores, quando houver.</li>" +
      "<li>Índices de liquidez, endividamento e margens não são calculados para bancos, seguradoras e outras instituições com plano de contas próprio (sem circulante e não circulante).</li>" +
      "<li>ROE e participação de capital de terceiros só são calculados quando o patrimônio líquido é positivo.</li>" +
      "<li>A mediana do setor exige ao menos três companhias no ano.</li></ul>" +
      '<h3>Fórmulas</h3><div class="tab-wrap" style="margin-top:.4rem"><table><thead><tr><th>Indicador</th><th>Fórmula</th><th>Unidade</th></tr></thead><tbody>' + linhas + "</tbody></table></div>" +
      "<h3>Atualização</h3><p>Os dados são atualizados automaticamente toda semana a partir da CVM. Última atualização: <strong>" + esc(META.atualizado) + "</strong> (" + META.n_empresas + " companhias, " + META.n_linhas + " demonstrações anuais).</p>" +
      "<h3>Aviso</h3><p>Material produzido pelo grupo contabiliDados (UFERSA) para fins de ensino e pesquisa. Os índices são calculados de forma automática e padronizada; diferenças de plano de contas entre companhias podem afetar a comparação. Não constitui recomendação de investimento.</p></div>";
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
