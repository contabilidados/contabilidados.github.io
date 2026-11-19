# =============================================================================
# Painel de Indicadores Contábeis (contabiliDados)
# Calcula índices de liquidez, endividamento e rentabilidade das companhias
# abertas a partir das DFP anuais da CVM (Dados Abertos) e grava JSON para o
# app estático em cntdd_indicadores/.
#
# Uso:  Rscript atualizar_indicadores.R [pasta_de_saida] [ano_inicial]
#       (rodado toda semana por .github/workflows/atualiza-indicadores.yaml)
#       Variável de ambiente CVM_CACHE: pasta para guardar os ZIPs baixados.
# =============================================================================
suppressPackageStartupMessages({
  library(data.table)
  library(jsonlite)
})

args     <- commandArgs(trailingOnly = TRUE)
saida    <- if (length(args) >= 1) args[1] else "cntdd_indicadores/dados"
ano_ini  <- if (length(args) >= 2) as.integer(args[2]) else 2010L
cache    <- Sys.getenv("CVM_CACHE", file.path(tempdir(), "cvm"))
dir.create(saida, recursive = TRUE, showWarnings = FALSE)
dir.create(cache, recursive = TRUE, showWarnings = FALSE)

URL_DFP <- "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_%d.zip"
URL_FCA <- "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_%d.zip"
URL_CAD <- "https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv"

baixa <- function(url, destino) {
  ok <- tryCatch({
    utils::download.file(url, destino, mode = "wb", quiet = TRUE)
    file.exists(destino) && file.size(destino) > 1000
  }, error = function(e) FALSE, warning = function(w) FALSE)
  if (!ok && file.exists(destino)) unlink(destino)
  ok
}
le_csv <- function(arquivo) {
  d <- fread(arquivo, sep = ";", encoding = "Latin-1", colClasses = "character", showProgress = FALSE)
  for (k in names(d)) set(d, j = k, value = enc2utf8(d[[k]]))   # textos em UTF-8 (independe do locale)
  d
}
num <- function(x) suppressWarnings(as.numeric(x))

ano_fim <- as.integer(format(Sys.Date(), "%Y"))
anos    <- ano_ini:ano_fim

# --- 1. Contas de interesse por empresa e ano --------------------------------
extrai_ano <- function(ano) {
  zip <- file.path(cache, sprintf("dfp_%d.zip", ano))
  # o ano corrente e os dois anteriores são sempre baixados de novo (reapresentações)
  if (!file.exists(zip) || (ano >= ano_fim - 2 && Sys.getenv("CVM_OFFLINE") != "1")) {
    if (!baixa(sprintf(URL_DFP, ano), zip)) return(NULL)
  }
  pasta <- file.path(cache, sprintf("dfp_%d", ano))
  unlink(pasta, recursive = TRUE); dir.create(pasta)
  nomes <- utils::unzip(zip, list = TRUE)$Name
  quer  <- grep(sprintf("_(BPA|BPP|DRE)_(con|ind)_%d\\.csv$", ano), nomes, value = TRUE)
  if (!length(quer)) return(NULL)
  utils::unzip(zip, files = quer, exdir = pasta)

  partes <- lapply(quer, function(f) {
    d <- le_csv(file.path(pasta, f))
    d <- d[ORDEM_EXERC %in% c("ÚLTIMO", "ULTIMO", "ÚLTIMO") & nchar(CD_CONTA) <= 7]
    d[, tipo := ifelse(grepl("_con_", f), "con", "ind")]
    d[, .(CNPJ_CIA, CD_CVM, DENOM_CIA, VERSAO, DT_FIM_EXERC, ESCALA_MOEDA, CD_CONTA, DS_CONTA, VL_CONTA, tipo)]
  })
  unlink(pasta, recursive = TRUE)
  d <- rbindlist(partes)
  # mantém só a última versão entregue de cada empresa
  d[, VERSAO := as.integer(VERSAO)]
  d <- d[d[, .I[VERSAO == max(VERSAO)], by = .(CD_CVM, tipo)]$V1]
  d[, valor := num(VL_CONTA) * ifelse(toupper(ESCALA_MOEDA) == "UNIDADE", 1 / 1000, 1)]
  d[, ano := ano]
  d
}

message("Lendo DFP de ", min(anos), " a ", max(anos), "...")
brutos <- rbindlist(lapply(anos, function(a) { message("  ", a); extrai_ano(a) }), fill = TRUE)
if (!nrow(brutos)) stop("Nenhum dado da CVM foi lido.")

# consolidado quando existir; senão, individual
tem_con <- unique(brutos[tipo == "con" & CD_CONTA == "1" & !is.na(valor) & valor != 0, .(CD_CVM, ano)])
tem_con[, usa := "con"]
brutos <- merge(brutos, tem_con, by = c("CD_CVM", "ano"), all.x = TRUE)
brutos[is.na(usa), usa := "ind"]
brutos <- brutos[tipo == usa]

pega <- function(cod, padrao = NULL) {
  x <- brutos[CD_CONTA == cod]
  if (!is.null(padrao)) x <- x[grepl(padrao, DS_CONTA, ignore.case = TRUE)]
  x[, .(v = sum(valor, na.rm = TRUE)), by = .(CD_CVM, ano)]
}
junta <- function(base, x, nome) { setnames(x, "v", nome); merge(base, x, by = c("CD_CVM", "ano"), all.x = TRUE) }

base <- unique(brutos[, .(CD_CVM, ano, CNPJ_CIA, DENOM_CIA, DT_FIM_EXERC, consolidado = usa == "con")])
base <- base[, .SD[1], by = .(CD_CVM, ano)]

base <- junta(base, pega("1"), "at")
base <- junta(base, pega("1.01", "^Ativo Circulante"), "ac")
base <- junta(base, pega("1.01.01", "Caixa|Disponibilidades"), "caixa")
base <- junta(base, pega("1.01.04", "^Estoques"), "estoques")
base <- junta(base, pega("1.02.01", "Realiz.vel a Longo Prazo"), "rlp")
base <- junta(base, pega("2.01", "^Passivo Circulante"), "pc")
base <- junta(base, pega("2.02", "^Passivo N.o Circulante"), "pnc")
base <- junta(base, pega("3.01"), "receita")
base <- junta(base, pega("3.03", "^Resultado Bruto$"), "lb")
base <- junta(base, pega("3.05", "Antes do Resultado Financeiro"), "ebit")

# patrimônio líquido: conta de 2º nível do passivo com "Patrimônio Líquido" (2.03 em geral; outra em bancos)
pl <- brutos[grepl("^2\\.\\d{2}$", CD_CONTA) & grepl("^Patrim.nio L.quido", DS_CONTA, ignore.case = TRUE),
             .(v = valor[which.max(as.integer(sub("2.", "", CD_CONTA, fixed = TRUE)))]), by = .(CD_CVM, ano)]
base <- junta(base, pl, "pl")

# lucro líquido: última conta de 2º nível da DRE com "Lucro/Prejuízo ... Período"
ll <- brutos[grepl("^3\\.\\d{2}$", CD_CONTA) &
               grepl("(Lucro|Preju).*(Per.odo|Exerc.cio)", DS_CONTA, ignore.case = TRUE) &
               !grepl("antes|Continuadas|Descontinuadas|Atribu", DS_CONTA, ignore.case = TRUE),
             .(v = valor[which.max(as.integer(sub("3.", "", CD_CONTA, fixed = TRUE)))]), by = .(CD_CVM, ano)]
base <- junta(base, ll, "ll")

# contas próprias de seguradoras (modelo de DFP de seguradoras) e de bancos
rec_ds <- brutos[CD_CONTA == "3.01", .(ds301 = DS_CONTA[1]), by = .(CD_CVM, ano)]
base <- merge(base, rec_ds, by = c("CD_CVM", "ano"), all.x = TRUE)
base <- junta(base, pega("3.02", "Atividade Seguradora"), "desp_seg")
base <- junta(base, pega("3.04", "^Despesas Administrativas"), "desp_adm_seg")
base <- junta(base, pega("3.03", "Intermedia..o Financeira"), "rbif")
base[, mes := as.integer(substr(DT_FIM_EXERC, 6, 7))]

# --- 2. Cadastro (setor, situação) e códigos de negociação --------------------
cad_arq <- file.path(cache, "cad_cia_aberta.csv")
if (!baixa(URL_CAD, cad_arq) && !file.exists(cad_arq)) stop("Cadastro da CVM indisponível.")
cad <- le_csv(cad_arq)
cad[, CD_CVM := sprintf("%06d", as.integer(CD_CVM))]
cad <- cad[order(CD_CVM, -as.Date(DT_INI_SIT, optional = TRUE))][, .SD[1], by = CD_CVM]

tickers <- rbindlist(lapply(c(ano_fim, ano_fim - 1L), function(a) {
  z <- file.path(cache, sprintf("fca_%d.zip", a))
  if (!baixa(sprintf(URL_FCA, a), z)) return(NULL)
  f <- grep("valor_mobiliario", utils::unzip(z, list = TRUE)$Name, value = TRUE)
  if (!length(f)) return(NULL)
  utils::unzip(z, files = f, exdir = cache)
  v <- le_csv(file.path(cache, f))
  v[nchar(Codigo_Negociacao) >= 5 & Mercado == "Bolsa", .(CNPJ_CIA = CNPJ_Companhia, tk = toupper(trimws(Codigo_Negociacao)))]
}), fill = TRUE)
tk <- if (nrow(tickers)) unique(tickers)[, .(tk = paste(sort(unique(tk)), collapse = " ")), by = CNPJ_CIA] else data.table(CNPJ_CIA = character(), tk = character())

base[, CD_CVM := sprintf("%06d", as.integer(CD_CVM))]
base <- base[!is.na(at) & at > 0]
emp <- base[order(-ano)][, .SD[1], by = CD_CVM][, .(CD_CVM, CNPJ_CIA, DENOM_CIA)]
emp <- merge(emp, cad[, .(CD_CVM, DENOM_COMERC, SETOR_ATIV, SIT, SIT_EMISSOR)], by = "CD_CVM", all.x = TRUE)
emp <- merge(emp, tk, by = "CNPJ_CIA", all.x = TRUE)
emp[is.na(SETOR_ATIV) | SETOR_ATIV == "", SETOR_ATIV := "Não informado"]
emp[, nome := fifelse(!is.na(DENOM_COMERC) & nchar(gsub("[^[:alnum:]]", "", DENOM_COMERC)) >= 2, DENOM_COMERC, DENOM_CIA)]
emp[, setor := sub("^Emp\\. Adm\\. Part\\. ?-? ?", "Holding - ", SETOR_ATIV)]
emp[, ativa := !is.na(SIT) & grepl("^ATIVO", SIT)]
emp[, situacao := fifelse(is.na(SIT_EMISSOR) | SIT_EMISSOR %in% c("", "FASE OPERACIONAL"), "", SIT_EMISSOR)]
setorder(emp, nome)
base <- merge(base, emp[, .(CD_CVM, setor, DENOM = DENOM_CIA)], by = "CD_CVM")

# --- 3. Tipo de empresa (tratamento contábil específico) -----------------------
# b = instituição financeira (modelo de DFP sem circulante/não circulante)
# s = seguradora/resseguradora/previdência/capitalização
# z = securitizadora      h = sem receita operacional (holding pura)
# c = concessão (energia, saneamento, infraestrutura de transporte)
# k = construção civil    a = agronegócio (ativos biológicos)    g = demais
geral  <- !is.na(base$ac) & !is.na(base$pc)
mod_seg <- grepl("Atividades? Segurador", base$ds301, ignore.case = TRUE)
nome_seg <- grepl("SEGUR|RESSEGUR|PREVID|CAPITALIZA", base$DENOM, ignore.case = TRUE) &
            !grepl("CORRETAG|CORRETORA|PARTICIPA", base$DENOM, ignore.case = TRUE)
setor_base <- sub("^Holding - ", "", base$setor)
infra_transp <- grepl("CONCESS|RODOVI|RUMO|MALHA|AM.RICA LATINA LOG|AUTOPISTA|AUTO ?ESTRADA|ECOVIAS|ECOPISTAS|ROTA |METR[OÔ]|AEROPORTO|FERROV|VIA ?QUATRO|LINHA|PORTO|TERMINAL|TRAVESSIA|PONTE",
                     base$DENOM, ignore.case = TRUE)
base[, tipo := "g"]
base[setor_base %in% c("Agricultura (Açúcar, Álcool e Cana)"), tipo := "a"]
base[grepl("^Constru..o Civil", setor_base), tipo := "k"]
base[setor_base %in% c("Energia Elétrica", "Saneamento, Serv. Água e Gás") |
       (setor_base == "Serviços Transporte e Logística" & infra_transp), tipo := "c"]
base[geral & (is.na(receita) | receita <= 0), tipo := "h"]
base[grepl("Securitiza", setor_base) | grepl("SECURITIZ", DENOM, ignore.case = TRUE), tipo := "z"]
base[(mod_seg & !is.na(receita) & receita > 0) | (setor_base == "Seguradoras e Corretoras" & nome_seg), tipo := "s"]
base[!geral, tipo := "b"]

# --- 4. Índices ---------------------------------------------------------------
div <- function(a, b) ifelse(is.na(a) | is.na(b) | b == 0, NA_real_, a / b)
z0  <- function(x) fifelse(is.na(x), 0, x)
nao_fin <- base$tipo %in% c("g", "c", "k", "a", "h", "z")   # liquidez/endividamento aplicáveis
com_rec <- nao_fin & base$tipo != "h"                         # margens e giro aplicáveis
base[, `:=`(
  lc   = ifelse(nao_fin, div(ac, pc), NA_real_),
  ls   = ifelse(nao_fin, div(ac - z0(estoques), pc), NA_real_),
  li   = ifelse(nao_fin, div(caixa, pc), NA_real_),
  lg   = ifelse(nao_fin, div(ac + z0(rlp), pc + z0(pnc)), NA_real_),
  eg   = ifelse(nao_fin, div(pc + z0(pnc), at), NA_real_),
  ce   = ifelse(nao_fin, div(pc, pc + z0(pnc)), NA_real_),
  pct  = ifelse(nao_fin & pl > 0, div(pc + z0(pnc), pl), NA_real_),
  alav = ifelse(tipo %in% c("b", "s") & pl > 0, div(at, pl), NA_real_),
  roe  = ifelse(pl > 0, div(ll, pl), NA_real_),
  roa  = div(ll, at),
  mb   = ifelse(com_rec & receita > 0, div(lb, receita), NA_real_),
  mo   = ifelse(com_rec & receita > 0, div(ebit, receita), NA_real_),
  ml   = ifelse((com_rec | tipo == "s") & receita > 0, div(ll, receita), NA_real_),
  ga   = ifelse(com_rec & receita > 0, div(receita, at), NA_real_),
  mf   = ifelse(tipo == "b", div(rbif, at), NA_real_),
  ids  = ifelse(tipo == "s" & !is.na(desp_seg) & receita > 0, div(-desp_seg, receita), NA_real_),
  icb  = ifelse(tipo == "s" & !is.na(desp_seg) & receita > 0, div(-desp_seg - z0(desp_adm_seg), receita), NA_real_)
)]
# anos ainda em entrega (ex.: exercício corrente com poucas DFP) ficam de fora até ter volume
n_ano <- base[, .N, by = ano]
base  <- base[ano %in% n_ano[N >= 200, ano]]

# --- 5. Medianas por setor e ano -----------------------------------------------
ind_cols <- c("lc", "ls", "li", "lg", "eg", "ce", "pct", "alav", "roe", "roa", "mb", "mo", "ml", "ga", "mf", "ids", "icb")
mediana3 <- function(x) { x <- x[is.finite(x)]; if (length(x) >= 3) median(x) else NA_real_ }
validas <- base[!is.na(pl) & pl > 0]   # empresas com passivo a descoberto ficam fora das medianas
med <- validas[, lapply(.SD, mediana3), by = .(setor, ano), .SDcols = ind_cols]
# "todas as companhias": sem instituições financeiras, seguradoras e securitizadoras,
# exceto nos indicadores próprios desses tipos
med_geral <- validas[tipo %in% c("g", "c", "k", "a", "h"), lapply(.SD, mediana3), by = .(ano), .SDcols = setdiff(ind_cols, c("alav", "mf", "ids", "icb"))]
med_fin   <- validas[tipo %in% c("b", "s"), lapply(.SD, mediana3), by = .(ano), .SDcols = c("alav", "mf", "ids", "icb")]
med_geral <- merge(med_geral, med_fin, by = "ano", all = TRUE)
med_geral[, setor := "Todas as companhias"]
med <- rbind(med, med_geral, use.names = TRUE)

# --- 6. Saída JSON colunar ------------------------------------------------------
arred <- function(x, d = 4) { x <- round(x, d); x[!is.finite(x)] <- NA; x }
setorder(base, CD_CVM, ano)
dados <- list(
  cvm = base$CD_CVM, ano = base$ano, con = as.integer(base$consolidado), tipo = base$tipo, mes = base$mes,
  at = arred(base$at, 0), pl = arred(base$pl, 0), receita = arred(base$receita, 0), ll = arred(base$ll, 0)
)
for (k in ind_cols) dados[[k]] <- arred(base[[k]])

empresas <- list(cvm = emp$CD_CVM, cnpj = emp$CNPJ_CIA, nome = emp$nome, razao = emp$DENOM_CIA,
                 setor = emp$setor, tk = fifelse(is.na(emp$tk), "", emp$tk), ativa = as.integer(emp$ativa),
                 situacao = emp$situacao)

setorder(med, setor, ano)
medianas <- c(list(setor = med$setor, ano = med$ano), lapply(setNames(ind_cols, ind_cols), function(k) arred(med[[k]])))

meta <- list(
  atualizado = format(Sys.time(), "%Y-%m-%d %H:%M", tz = "America/Sao_Paulo"),
  anos = range(base$ano), n_empresas = nrow(emp), n_linhas = nrow(base),
  fonte = "CVM - Portal de Dados Abertos (DFP e cadastro de companhias abertas)"
)

grava <- function(x, f) writeLines(toJSON(x, auto_unbox = TRUE, na = "null", digits = NA), file.path(saida, f), useBytes = TRUE)
grava(dados, "indicadores.json")
grava(empresas, "empresas.json")
grava(medianas, "medianas.json")
grava(meta, "meta.json")
message(sprintf("OK: %d empresas, %d empresa-anos, %d-%d.", nrow(emp), nrow(base), meta$anos[1], meta$anos[2]))
