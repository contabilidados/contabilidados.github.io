# Funções usadas pelas páginas de eventos (eventos/*/*.qmd):
#   source(here::here("R/utils.R")); read_yaml_talks_pt()
# Lê o cabeçalho YAML do .qmd e monta local, data, botões dos materiais e imagem.

read_yaml_matter <- function(input_file) {
  # https://stackoverflow.com/questions/62095329/how-to-edit-an-r-markdown-yaml-header-programmatically/62096216#62096216
  input_lines <- readLines(input_file, encoding = "UTF-8")
  delimiters <- grep("^---\\s*$", input_lines)
  if (!length(delimiters)) {
    stop("unable to find yaml delimiters")
  } else if (length(delimiters) == 1L) {
    if (delimiters[1] == 1L) {
      stop("cannot find second delimiter, first is on line 1")
    } else {
      # found just one set, assume it is *closing* the yaml matter;
      # fake a preceding line of delimiter
      delimiters <- c(0L, delimiters[1])
    }
  }
  delimiters <- delimiters[1:2]
  yaml_list <- yaml::yaml.load(input_lines[ (delimiters[1]+1):(delimiters[2]-1) ])
}


read_yaml_talks_pt <- function(){
  # Font Awesome Free 6.7.2 (antes carregado por um kit herdado do modelo do site)
  cat('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/css/all.min.css">')

  yaml_atual <- fs::dir_ls(glob = "*.qmd") |>
    read_yaml_matter()

  if(!is.null(yaml_atual$event)){
    cat(paste0("<b>Evento: </b>", yaml_atual$event, "<br>"))
  }

  if(!is.null(yaml_atual$event_url)){
    cat(paste0("<b>Link do evento:</b> <a href='", yaml_atual$event_url, "'>", yaml_atual$event_url, "</a><br>"))
  }

  if(!is.null(yaml_atual$date_event)){
    cat(paste0("<b>Data/Hora do Evento: </b>", yaml_atual$date_event, "<br>"))
  }

  if(!is.null(yaml_atual$location)){
    cat(paste0("<b>Local: </b>", yaml_atual$location, "<br>"))
  }



  if(!is.null(yaml_atual$links)){
    cat(paste0("<h2> Materiais</h2> <br><center>"))


    for (position in 1:length(yaml_atual$links)) {
      item <- yaml_atual$links[[position]]

      if(item$icon_pack %in% c("fas", "far", "fa")){
        item$icon_pack <- "solid"
      } else if(item$icon_pack == "fab"){
        item$icon_pack <- "brands"
      }

      cat(paste0("<a href='", item$url, "' target='_blank' rel='noopener'><button class='btn btn-primary' style='margin: 10px;'><i class='", "fa-", item$icon_pack , " fa-", item$icon, "'></i> ", item$name, "</button></a>  "))
    }

    cat(paste0("</center>"))
  }

  # A imagem do evento aparece mesmo quando não há materiais (links).
  if(!is.null(yaml_atual$image)){
    cat(paste0("<center><br><br><img src='", yaml_atual$image, "' class='img-fluid quarto-figure-center' style='max-width:80%'><br></center>"))
  }
}
