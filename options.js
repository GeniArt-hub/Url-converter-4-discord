const DEFAULT_RULES = [
  {
    name: "X → fixupx",
    enabled: true,
    input: "https://x.com/",
    match: "^https?://(www\\.)?x\\.com(/|$)",
    replace: "https://fixupx.com/"
  },
  {
    name: "Threads → fixthreads",
    enabled: true,
    input: "https://www.threads.com/",
    match: "^https?://(www\\.)?threads\\.com(/|$)",
    replace: "https://fixthreads.com/"
  },
  {
    name: "Instagram → zzinstagram",
    enabled: true,
    input: "https://www.instagram.com/",
    match: "^https?://(www\\.)?instagram\\.com(/|$)",
    replace: "https://zzinstagram.com/"
  },
  {
    name: "TikTok → tnktok",
    enabled: true,
    input: "https://www.tiktok.com/",
    match: "^https?://(www\\.)?tiktok\\.com(/|$)",
    replace: "https://tnktok.com/"
  },
  {
    name: "Bluesky → fxbsky",
    enabled: true,
    input: "https://bsky.app/",
    match: "^https?://(www\\.)?bsky\\.app(/|$)",
    replace: "https://fxbsky.app/"
  }
];

const $rules = document.getElementById("rules");
const $status = document.getElementById("status");

function setStatus(msg, ok = true) {
  $status.textContent = msg;
  $status.className = "status " + (ok ? "ok" : "err");
  if (msg) setTimeout(() => { $status.textContent = ""; }, 2500);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function simpleUrlToInternalRegex(input) {
  const raw = input.trim();
  const normalized = raw.match(/^https?:\/\//i) ? raw : `https://${raw}`;

  let u;
  try {
    u = new URL(normalized);
  } catch {
    throw new Error("URL source invalide");
  }
  if (!u.hostname) throw new Error("URL source invalide");

  const host = u.hostname.toLowerCase();
  const path = (u.pathname || "/").trim();

  const baseHost = host.startsWith("www.") ? host.slice(4) : host;
  const hostRe = `(www\\.)?${escapeRegex(baseHost)}`;

  let pathRe = "";
  if (path && path !== "/") {
    const clean = path.endsWith("/") ? path.slice(0, -1) : path;
    pathRe = escapeRegex(clean);
  }

  const full = pathRe
    ? `^https?://${hostRe}${pathRe}(/|$)`
    : `^https?://${hostRe}(/|$)`;

  new RegExp(full, "i");
  return full;
}

function internalRegexToDisplayInput(match) {
  const m = String(match || "");
  const hostMatch = m.match(/^\^https\?:\/\/\((?:www\\\.)\)\?([A-Za-z0-9\\\.\-]+)\(\/\|\$\)/);
  if (hostMatch) {
    const host = hostMatch[1].replaceAll("\\.", ".");
    return `https://${host}/`;
  }

  const hostPathMatch = m.match(/^\^https\?:\/\/\((?:www\\\.)\)\?([A-Za-z0-9\\\.\-]+)(\/[^()]+)\(\/\|\$\)/);
  if (hostPathMatch) {
    const host = hostPathMatch[1].replaceAll("\\.", ".");
    const path = hostPathMatch[2].replaceAll("\\/", "/").replaceAll("\\.", ".");
    return `https://${host}${path}/`;
  }

  return "";
}

function trashIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9zM7 9h2v10H7V9z"/>
    </svg>
  `;
}

function makeRow(rule, idx) {
  const tr = document.createElement("tr");
  tr.dataset.idx = String(idx);

  const displayInput = rule.input || internalRegexToDisplayInput(rule.match) || "";

  tr.innerHTML = `
    <td><input type="checkbox" class="enabled chk" ${rule.enabled ? "checked" : ""}></td>
    <td><input type="text" class="name in" placeholder="Nom" value="${escapeHtml(rule.name || "")}"></td>
    <td><input type="text" class="input in" placeholder="https://x.com/ ou https://www.instagram.com/" value="${escapeHtml(displayInput)}"></td>
    <td><input type="text" class="replace in" placeholder="https://..." value="${escapeHtml(rule.replace || "")}"></td>
    <td>
      <button class="del iconBtn" type="button" aria-label="Supprimer">
        ${trashIconSvg()}
      </button>
    </td>
  `;

  tr.querySelector(".del").addEventListener("click", () => {
    tr.remove();
    renumber();
  });

  return tr;
}

function renumber() {
  [...$rules.querySelectorAll("tr")].forEach((tr, i) => (tr.dataset.idx = String(i)));
}

function readTable() {
  const rows = [...$rules.querySelectorAll("tr")];
  return rows.map(tr => ({
    enabled: tr.querySelector(".enabled").checked,
    name: tr.querySelector(".name").value.trim(),
    input: tr.querySelector(".input").value.trim(),
    replace: tr.querySelector(".replace").value.trim(),
  }));
}

function validateRules(rules) {
  for (const [i, r] of rules.entries()) {
    if (!r.name) return { ok: false, msg: `Ligne ${i + 1}: nom manquant` };
    if (!r.input) return { ok: false, msg: `Ligne ${i + 1}: URL source manquante` };
    if (!r.replace) return { ok: false, msg: `Ligne ${i + 1}: replace manquant` };
    try {
      simpleUrlToInternalRegex(r.input);
    } catch (e) {
      return { ok: false, msg: `Ligne ${i + 1}: ${e.message || "URL source invalide"}` };
    }
  }
  return { ok: true, msg: "" };
}

async function load() {
  const data = await chrome.storage.sync.get({ rules: null });
  const rules = (Array.isArray(data.rules) && data.rules.length) ? data.rules : DEFAULT_RULES;

  $rules.innerHTML = "";
  rules.forEach((r, i) => $rules.appendChild(makeRow(r, i)));
}

async function save() {
  const uiRules = readTable();
  const v = validateRules(uiRules);
  if (!v.ok) return setStatus(v.msg, false);

  const storedRules = uiRules.map(r => ({
    enabled: r.enabled,
    name: r.name,
    input: r.input,
    match: simpleUrlToInternalRegex(r.input),
    replace: r.replace
  }));

  await chrome.storage.sync.set({ rules: storedRules });
  setStatus("Enregistré ✅", true);
}

async function reset() {
  await chrome.storage.sync.set({ rules: DEFAULT_RULES });
  await load();
  setStatus("Réinitialisé ✅", true);
}

document.getElementById("add").addEventListener("click", () => {
  const r = {
    name: "Nouvelle règle",
    enabled: true,
    input: "https://example.com/",
    match: "",
    replace: "https://example.com/"
  };
  $rules.appendChild(makeRow(r, $rules.children.length));
});

document.getElementById("save").addEventListener("click", save);
document.getElementById("reset").addEventListener("click", reset);

/* ---- Shortcuts UI ---- */
async function refreshShortcutUI() {
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find(c => c.name === "convert-and-copy");
    const shortcut = cmd?.shortcut || "Non défini";
    document.getElementById("shortcutValue").textContent = shortcut;
    document.getElementById("shortcutValue2").textContent = shortcut;
  } catch {
    document.getElementById("shortcutValue").textContent = "—";
    document.getElementById("shortcutValue2").textContent = "—";
  }
}

document.getElementById("openShortcuts")?.addEventListener("click", async () => {
  await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

document.getElementById("refreshShortcuts")?.addEventListener("click", refreshShortcutUI);

/* ---- Lang switch FR/US (UI only) ---- */
const I18N = {
  fr: {
    title: "URL Converter",
    subtitle: "Convertit l’URL de l’onglet (X, Threads, Instagram, TikTok, Bluesky, …) vers une URL mieux intégrée sur Discord.",
    shortcutLabel: "Raccourci",
    rulesTitle: "Règles de conversion",
    rulesHint: "Saisis une URL “simple” (ex: https://x.com/). Le regex est généré en interne.",
    btnAdd: "+ Ajouter une règle",
    btnSave: "Enregistrer",
    btnReset: "Réinitialiser",
    thActive: "Actif",
    thName: "Nom",
    thSource: "URL source",
    thReplace: "Replace",
    thAction: "Action",
    kbTitle: "Raccourci clavier",
    kbDesc: "Chrome ne permet pas de modifier un raccourci directement depuis une page Options. Tu peux cependant le changer via la page des raccourcis d’extensions.",
    kbActionTitle: "Action",
    kbActionDesc: "Convertir l’URL de l’onglet + copier",
    kbOpen: "Ouvrir la page des raccourcis",
    kbRefresh: "Rafraîchir",
    kbTip: "Astuce : si ton clavier est en AZERTY et que ça se comporte bizarrement, change la combinaison dans la page des raccourcis.",
    sourcesTitle: "Sources",
  },
  us: {
    title: "URL Converter",
    subtitle: "Converts the current tab URL (X, Threads, Instagram, TikTok, Bluesky, …) into a Discord-friendly URL.",
    shortcutLabel: "Shortcut",
    rulesTitle: "Conversion rules",
    rulesHint: "Enter a “simple” URL (e.g. https://x.com/). The regex is generated internally.",
    btnAdd: "+ Add rule",
    btnSave: "Save",
    btnReset: "Reset",
    thActive: "On",
    thName: "Name",
    thSource: "Source URL",
    thReplace: "Replace",
    thAction: "Action",
    kbTitle: "Keyboard shortcut",
    kbDesc: "Chrome does not allow changing extension shortcuts directly from an Options page. You can change it on the extension shortcuts page.",
    kbActionTitle: "Action",
    kbActionDesc: "Convert current tab URL + copy",
    kbOpen: "Open shortcuts page",
    kbRefresh: "Refresh",
    kbTip: "Tip: if your keyboard layout behaves oddly, change the shortcut on the shortcuts page.",
    sourcesTitle: "Sources",
  }
};

async function getLang() {
  const data = await chrome.storage.sync.get({ lang: "fr" });
  return (data.lang === "us" || data.lang === "fr") ? data.lang : "fr";
}

async function setLang(lang) {
  await chrome.storage.sync.set({ lang });
}

function applyLang(lang) {
  const dict = I18N[lang] || I18N.fr;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const text = dict[key];
    if (!text) return;

    if (key === "rulesHint") {
      el.innerHTML = (lang === "us")
        ? `Enter a “simple” URL (e.g. <span class="mono">https://x.com/</span>). The regex is generated internally.`
        : `Saisis une URL “simple” (ex: <span class="mono">https://x.com/</span>). Le regex est généré en interne.`;
      return;
    }

    el.textContent = text;
  });

  const frBtn = document.getElementById("langFR");
  const usBtn = document.getElementById("langUS");
  frBtn?.classList.toggle("active", lang === "fr");
  usBtn?.classList.toggle("active", lang === "us");
  document.documentElement.lang = (lang === "us") ? "en" : "fr";
}

async function initLangSwitch() {
  const lang = await getLang();
  applyLang(lang);

  document.getElementById("langFR")?.addEventListener("click", async () => {
    await setLang("fr");
    applyLang("fr");
  });

  document.getElementById("langUS")?.addEventListener("click", async () => {
    await setLang("us");
    applyLang("us");
  });
}

load();
refreshShortcutUI();
initLangSwitch();
