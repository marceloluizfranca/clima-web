// Interface da clima-api. As chamadas usam caminhos relativos (/v1/...):
// o nginx que serve esta página encaminha para a API dentro do cluster.

const ICONES_WMO = [
  [[0], "☀️"],
  [[1], "🌤️"],
  [[2], "⛅"],
  [[3], "☁️"],
  [[45, 48], "🌫️"],
  [[51, 53, 55, 56, 57], "🌦️"],
  [[61, 63, 66, 80, 81], "🌧️"],
  [[65, 67, 82], "⛈️"],
  [[71, 73, 75, 77, 85, 86], "🌨️"],
  [[95, 96, 99], "🌩️"],
];

const formulario = document.getElementById("busca");
const campoCidade = document.getElementById("cidade");
const botaoLocalizacao = document.getElementById("localizacao");
const resultado = document.getElementById("resultado");
const modelo = document.getElementById("modelo-cartao");

function icone(codigo) {
  const encontrado = ICONES_WMO.find(([codigos]) => codigos.includes(codigo));
  return encontrado ? encontrado[1] : "🌡️";
}

function formatarData(iso) {
  // A data vem como AAAA-MM-DD no fuso do local consultado; meio-dia evita
  // que o fuso do navegador mude o dia exibido.
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function numero(valor, casas = 0) {
  return valor == null ? "—" : valor.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

function mostrarEstado(classe, mensagem) {
  resultado.replaceChildren();
  const caixa = document.createElement("div");
  caixa.className = classe;
  caixa.textContent = mensagem;
  resultado.append(caixa);
}

function mostrarPrevisao(dados) {
  const cartao = modelo.content.cloneNode(true);
  const $ = (seletor) => cartao.querySelector(seletor);
  const { local, temperatura_c: temp, precipitacao } = dados;

  $(".local").textContent = local.nome ?? "Sua localização";
  $(".regiao").textContent = [local.estado, local.pais].filter(Boolean).join(", ") || local.fuso_horario;
  $(".data").textContent = formatarData(dados.data);
  $(".icone").textContent = icone(dados.codigo_wmo);
  $(".atual").textContent = numero(temp.atual ?? temp.maxima);
  $(".condicao").textContent = dados.condicao;
  $(".minima").textContent = `${numero(temp.minima)}°`;
  $(".maxima").textContent = `${numero(temp.maxima)}°`;
  $(".chuva-prob").textContent = `${numero(precipitacao.probabilidade_max_pct)}%`;
  $(".chuva-total").textContent = `${numero(precipitacao.total_mm, 1)} mm`;
  $(".vento").textContent = `${numero(dados.vento_max_kmh)} km/h`;
  $(".coordenadas").textContent =
    `${numero(local.latitude, 4)}, ${numero(local.longitude, 4)} · ${local.fuso_horario}`;

  // Posição da temperatura atual entre a mínima e a máxima do dia
  if (temp.atual != null && temp.maxima > temp.minima) {
    const posicao = ((temp.atual - temp.minima) / (temp.maxima - temp.minima)) * 100;
    $(".preenchimento").style.setProperty("--posicao-atual", `${Math.min(100, Math.max(0, posicao))}%`);
  }

  resultado.replaceChildren(cartao);
}

async function consultar(parametros, descricao) {
  mostrarEstado("carregando", `Buscando a previsão para ${descricao}…`);
  formulario.querySelectorAll("button").forEach((b) => (b.disabled = true));

  try {
    const resposta = await fetch(`/v1/clima/hoje?${new URLSearchParams(parametros)}`);
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const detalhe = typeof corpo.detail === "string" ? corpo.detail : "Parâmetros inválidos.";
      throw new Error(resposta.status >= 500 ? "O serviço de previsão está indisponível. Tente novamente em instantes." : detalhe);
    }
    mostrarPrevisao(corpo);
    // Guarda a busca na URL para o link poder ser compartilhado
    history.replaceState(null, "", `?${new URLSearchParams(parametros)}`);
  } catch (erro) {
    mostrarEstado("erro", erro instanceof TypeError ? "Não foi possível conectar à API." : erro.message);
  } finally {
    formulario.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const cidade = campoCidade.value.trim();
  if (cidade.length >= 2) consultar({ cidade }, cidade);
});

document.querySelectorAll("[data-cidade]").forEach((botao) => {
  botao.addEventListener("click", () => {
    campoCidade.value = botao.dataset.cidade;
    consultar({ cidade: botao.dataset.cidade }, botao.dataset.cidade);
  });
});

botaoLocalizacao.addEventListener("click", () => {
  if (!navigator.geolocation) {
    mostrarEstado("erro", "Seu navegador não permite obter a localização.");
    return;
  }
  mostrarEstado("carregando", "Obtendo sua localização…");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => consultar({ lat: coords.latitude.toFixed(4), lon: coords.longitude.toFixed(4) }, "sua localização"),
    () => mostrarEstado("erro", "Não foi possível obter sua localização. Verifique a permissão do navegador."),
    { timeout: 10000 },
  );
});

// Busca inicial a partir da URL (?cidade=... ou ?lat=...&lon=...)
const inicial = new URLSearchParams(location.search);
if (inicial.get("cidade")) {
  campoCidade.value = inicial.get("cidade");
  consultar({ cidade: inicial.get("cidade") }, inicial.get("cidade"));
} else if (inicial.get("lat") && inicial.get("lon")) {
  consultar({ lat: inicial.get("lat"), lon: inicial.get("lon") }, "as coordenadas informadas");
}

// Versões exibidas no rodapé: a do site vem do build, a da API do /readyz
fetch("/versao.json")
  .then((r) => r.json())
  .then(({ versao }) => (document.getElementById("versao-web").textContent = versao))
  .catch(() => {});

fetch("/readyz")
  .then((r) => r.json())
  .then(({ versao }) => {
    if (versao) document.getElementById("versoes").append(` · api ${versao}`);
  })
  .catch(() => {});
