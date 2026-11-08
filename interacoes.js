// =====================================================================
//  Checagem de interações medicamentosas (RF05, RF06, RN01, RN02)
//
//  ATENÇÃO: esta é uma base LOCAL e SIMPLIFICADA, só para o protótipo.
//  A restrição RST01 exige uma API farmacológica homologada. Quando ela
//  existir, basta trocar o corpo de verificarInteracoes() por uma chamada
//  à API, mantendo o mesmo formato de retorno.
// =====================================================================

const DISCLAIMER = "⚕️ Este aplicativo não substitui a consulta médica. " +
  "Em caso de dúvida, fale com seu médico ou farmacêutico.";

const GRAVIDADE = { grave: "Grave", moderada: "Moderada", leve: "Leve" };
const ORDEM_GRAVIDADE = { grave: 0, moderada: 1, leve: 2 };

// Substância → nomes pelos quais ela pode ser cadastrada (genérico e marcas comuns)
const SUBSTANCIAS = {
  varfarina: ["varfarina", "marevan", "coumadin"],
  aas: ["aas", "acido acetilsalicilico", "aspirina"],
  ibuprofeno: ["ibuprofeno", "advil", "alivium"],
  sildenafila: ["sildenafila", "viagra"],
  nitrato: ["isossorbida", "nitroglicerina", "monocordil", "isordil"],
  sinvastatina: ["sinvastatina"],
  claritromicina: ["claritromicina"],
  fluoxetina: ["fluoxetina", "prozac"],
  tramadol: ["tramadol", "tramal"],
  clonazepam: ["clonazepam", "rivotril"],
  losartana: ["losartana"],
  enalapril: ["enalapril"],
  espironolactona: ["espironolactona", "aldactone"],
  clopidogrel: ["clopidogrel", "plavix"],
  omeprazol: ["omeprazol"],
  levotiroxina: ["levotiroxina", "puran", "synthroid", "euthyrox"],
  calcio: ["carbonato de calcio", "calcio"],
};

const INTERACOES = [
  { a: "varfarina", b: "aas", gravidade: "grave", tipo: "Aumento de efeito",
    explicacao: "Os dois afinam o sangue. Juntos, aumentam muito o risco de sangramentos." },
  { a: "varfarina", b: "ibuprofeno", gravidade: "grave", tipo: "Aumento de efeito",
    explicacao: "O ibuprofeno aumenta o risco de sangramento de quem usa varfarina, inclusive no estômago." },
  { a: "sildenafila", b: "nitrato", gravidade: "grave", tipo: "Aumento de efeito",
    explicacao: "Juntos podem causar uma queda forte e perigosa da pressão arterial." },
  { a: "sinvastatina", b: "claritromicina", gravidade: "grave", tipo: "Toxicidade",
    explicacao: "A claritromicina aumenta a quantidade de sinvastatina no corpo, com risco de lesão muscular grave." },
  { a: "fluoxetina", b: "tramadol", gravidade: "grave", tipo: "Toxicidade",
    explicacao: "Podem causar excesso de serotonina (agitação, febre, tremores) e aumentar o risco de convulsões." },
  { a: "clonazepam", b: "tramadol", gravidade: "grave", tipo: "Aumento de efeito",
    explicacao: "Os dois deixam o sistema nervoso mais lento. Juntos podem causar sonolência intensa e dificuldade para respirar." },
  { a: "losartana", b: "espironolactona", gravidade: "moderada", tipo: "Toxicidade",
    explicacao: "Os dois aumentam o potássio no sangue. É preciso acompanhar com exames." },
  { a: "enalapril", b: "espironolactona", gravidade: "moderada", tipo: "Toxicidade",
    explicacao: "Os dois aumentam o potássio no sangue. É preciso acompanhar com exames." },
  { a: "losartana", b: "ibuprofeno", gravidade: "moderada", tipo: "Diminuição de efeito",
    explicacao: "O ibuprofeno pode diminuir o efeito do remédio de pressão e sobrecarregar os rins." },
  { a: "enalapril", b: "ibuprofeno", gravidade: "moderada", tipo: "Diminuição de efeito",
    explicacao: "O ibuprofeno pode diminuir o efeito do remédio de pressão e sobrecarregar os rins." },
  { a: "clopidogrel", b: "omeprazol", gravidade: "moderada", tipo: "Diminuição de efeito",
    explicacao: "O omeprazol pode diminuir o efeito do clopidogrel na proteção contra coágulos." },
  { a: "fluoxetina", b: "aas", gravidade: "moderada", tipo: "Aumento de efeito",
    explicacao: "Juntos aumentam o risco de sangramentos, principalmente no estômago." },
  { a: "levotiroxina", b: "calcio", gravidade: "leve", tipo: "Diminuição de efeito",
    explicacao: "O cálcio atrapalha a absorção da levotiroxina. Tome com pelo menos 4 horas de intervalo." },
  { a: "levotiroxina", b: "omeprazol", gravidade: "leve", tipo: "Diminuição de efeito",
    explicacao: "O omeprazol pode reduzir um pouco a absorção da levotiroxina." },
];

function substanciasDe(nomeMedicamento) {
  const nome = " " + normalizarTexto(nomeMedicamento) + " ";
  return Object.keys(SUBSTANCIAS).filter(s =>
    SUBSTANCIAS[s].some(apelido => new RegExp(`\\b${apelido}\\b`).test(nome)));
}

// Recebe uma lista de medicamentos ({ nome, ... }) e devolve as interações entre eles,
// da mais grave para a mais leve: [{ med1, med2, gravidade, tipo, explicacao }]
function verificarInteracoes(meds) {
  const subs = meds.map(m => substanciasDe(m.nome));
  const achadas = [];
  for (let i = 0; i < meds.length; i++) {
    for (let j = i + 1; j < meds.length; j++) {
      for (const it of INTERACOES) {
        const combina = (subs[i].includes(it.a) && subs[j].includes(it.b)) ||
                        (subs[i].includes(it.b) && subs[j].includes(it.a));
        if (combina) achadas.push({ ...it, med1: meds[i], med2: meds[j] });
      }
    }
  }
  return achadas.sort((x, y) => ORDEM_GRAVIDADE[x.gravidade] - ORDEM_GRAVIDADE[y.gravidade]);
}

// Toda exibição de interação inclui o aviso obrigatório (RN02)
function renderInteracoes(lista) {
  if (!lista.length) return "";
  return lista.map(i => `
    <div class="interacao ${i.gravidade}">
      <div class="topo">
        <strong>${esc(i.med1.nome)} + ${esc(i.med2.nome)}</strong>
        <span class="badge ${i.gravidade}">${GRAVIDADE[i.gravidade]}</span>
      </div>
      <div class="meta">${i.tipo}</div>
      <div class="explicacao">${i.explicacao}</div>
    </div>`).join("") + `<div class="disclaimer">${DISCLAIMER}</div>`;
}
