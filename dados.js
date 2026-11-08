// =====================================================================
//  Armazenamento criptografado (RNF03 – LGPD)
//  Os dados de saúde ficam no localStorage cifrados com AES-GCM 256.
//  A chave é gerada no próprio aparelho e guardada no IndexedDB como
//  "não exportável": o app consegue usá-la, mas ela não pode ser lida/copiada.
// =====================================================================
const CHAVES_SAUDE = ["medicamentos", "tomadas", "boletins"];

const b64 = u8 => { let s = ""; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const Cripto = {
  chave: null,
  async iniciar() {
    const db = await new Promise((ok, erro) => {
      const req = indexedDB.open("lembrete-remedios", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("chaves");
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
    const ler = () => new Promise((ok, erro) => {
      const r = db.transaction("chaves").objectStore("chaves").get("principal");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error);
    });
    this.chave = await ler();
    if (!this.chave) {
      const nova = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await new Promise(ok => {
        const tx = db.transaction("chaves", "readwrite");
        tx.objectStore("chaves").add(nova, "principal");
        tx.oncomplete = ok;
        tx.onerror = ok; // outra aba criou ao mesmo tempo: usamos a que ficou salva
      });
      this.chave = await ler();
    }
  },
  async cifrar(texto) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dados = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.chave, new TextEncoder().encode(texto));
    return "enc:" + b64(iv) + ":" + b64(new Uint8Array(dados));
  },
  async decifrar(s) {
    const [, iv, dados] = s.split(":");
    const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(iv) }, this.chave, deB64(dados));
    return new TextDecoder().decode(claro);
  },
};

const DB = {
  _cache: {},
  _fila: Promise.resolve(),

  // Precisa ser chamado (e aguardado) antes de usar os dados
  async iniciar() {
    await Cripto.iniciar();
    for (const k of CHAVES_SAUDE) await this.recarregar(k);
  },
  async recarregar(k) {
    const bruto = localStorage.getItem(k);
    if (!bruto) { this._cache[k] = undefined; return; }
    try {
      if (bruto.startsWith("enc:")) this._cache[k] = JSON.parse(await Cripto.decifrar(bruto));
      else { this._cache[k] = JSON.parse(bruto); this.salvar(k, this._cache[k]); } // migra dados antigos sem criptografia
    } catch (e) {
      console.error("Não foi possível ler", k, e);
      this._cache[k] = undefined;
    }
  },
  carregar(k, padrao) {
    const v = this._cache[k];
    return v === undefined ? padrao : JSON.parse(JSON.stringify(v));
  },
  salvar(k, v) {
    const texto = JSON.stringify(v);
    this._cache[k] = JSON.parse(texto);
    this._fila = this._fila.then(async () => localStorage.setItem(k, await Cripto.cifrar(texto)));
    return this._fila;
  },

  medicamentos() { return this.carregar("medicamentos", []); },
  salvarMedicamentos(lista) { return this.salvar("medicamentos", lista); },

  // Registro de cada dose (RF04):
  // { "medId|2026-11-03|08:00": { estado: "tomada" | "adiada" | "ignorada", em: "08:05", adiadaMin?: 510 } }
  registros() {
    const r = this.carregar("tomadas", {});
    for (const k in r) if (typeof r[k] === "string") r[k] = { estado: "tomada", em: r[k] }; // formato antigo
    return r;
  },
  registrar(medId, data, hora, info) {
    const r = this.registros();
    r[`${medId}|${data}|${hora}`] = { ...info, em: horaAgora() };
    return this.salvar("tomadas", r);
  },
  limparRegistro(medId, data, hora) {
    const r = this.registros();
    delete r[`${medId}|${data}|${hora}`];
    return this.salvar("tomadas", r);
  },

  pacientes() {
    return [...new Set(this.medicamentos().map(m => m.paciente))].sort();
  },

  // Boletins de saúde (1 por paciente por dia; reenviar atualiza)
  boletins() { return this.carregar("boletins", []); },
  salvarBoletim(b) {
    const lista = this.boletins().filter(x => !(x.paciente === b.paciente && x.data === b.data));
    lista.push(b);
    return this.salvar("boletins", lista);
  },
};

// =====================================================================
//  Tratamento
// =====================================================================
const TIPOS_MEDICACAO = ["Comprimido", "Cápsula", "Líquido / xarope", "Gotas", "Injetável",
  "Pomada / creme", "Inalatório", "Adesivo", "Outro"];

function statusTratamento(m, hoje = hojeISO()) {
  if (m.status) return m.status; // "concluido" ou "interrompido" (encerrado pelo médico)
  if (m.fim && m.fim < hoje) return "finalizado";
  if (m.inicio > hoje) return "agendado";
  return "ativo";
}
const STATUS_ROTULO = {
  ativo: "Em andamento", agendado: "Agendado", finalizado: "Prazo encerrado",
  concluido: "Concluído", interrompido: "Interrompido",
};

// =====================================================================
//  Boletim de saúde
// =====================================================================
const HUMORES = { 1: ["😣", "Muito mal"], 2: ["🙁", "Mal"], 3: ["😐", "Regular"], 4: ["🙂", "Bem"], 5: ["😄", "Muito bem"] };
const EVOLUCOES = { melhorou: ["📈", "Melhorou"], igual: ["➖", "Igual"], piorou: ["📉", "Piorou"] };
const SINTOMAS = ["Dor", "Febre", "Enjoo", "Tontura", "Dor de cabeça", "Sonolência", "Cansaço", "Falta de apetite"];

function renderBoletim(b, mostrarNome) {
  const [emoji, humor] = HUMORES[b.humor];
  const [eEvo, tEvo] = EVOLUCOES[b.evolucao];
  return `
    <div class="boletim ${b.evolucao}">
      <div class="topo">
        <div><span style="font-size:1.4rem" aria-hidden="true">${emoji}</span> <strong>${mostrarNome ? esc(b.paciente) + " · " : ""}${humor}</strong></div>
        <span class="meta">${formatarData(b.data)} às ${b.hora}</span>
      </div>
      <div class="meta">${eEvo} ${tEvo} em relação ao dia anterior</div>
      ${b.sintomas.length ? `<div class="horarios">${b.sintomas.map(s => `<span class="chip chip-alerta">${s}</span>`).join("")}</div>` : `<div class="meta">Sem sintomas relatados</div>`}
      ${b.relato ? `<div class="relato">“${esc(b.relato)}”</div>` : ""}
    </div>`;
}

// =====================================================================
//  Utilidades
// =====================================================================
const pad = n => String(n).padStart(2, "0");

function hojeISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function horaAgora() { return new Date().toTimeString().slice(0, 5); }
function formatarData(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
const normalizarTexto = s => String(s || "").trim().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3000);
}

// Janela de diálogo (substitui confirm(), que é bloqueado em alguns navegadores)
function abrirModal(html, classe = "") {
  fecharModal();
  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.id = "modal";
  fundo.innerHTML = `<div class="modal ${classe}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(fundo);
  fundo.querySelector("button:not([disabled]), input, select")?.focus();
}
function fecharModal() { document.getElementById("modal")?.remove(); }
document.addEventListener("keydown", e => { if (e.key === "Escape") fecharModal(); });

// Acessibilidade (RNF04): botão A+ aumenta todo o texto e fica salvo
function alternarFonte() {
  const grande = document.documentElement.classList.toggle("fonte-grande");
  localStorage.setItem("fonteGrande", grande ? "1" : "");
}
if (localStorage.getItem("fonteGrande")) document.documentElement.classList.add("fonte-grande");

// Funciona sem internet depois do primeiro acesso (RNF01)
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

function erroFatal(e) {
  console.error(e);
  document.body.insertAdjacentHTML("afterbegin",
    `<div class="alerta" style="margin:16px">Não foi possível abrir os dados com segurança neste navegador. (${esc(e.message)})</div>`);
}
