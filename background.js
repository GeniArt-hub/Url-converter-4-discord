const DEFAULT_RULES = [
  { name: "X → fixupx", enabled: true, match: "^https?://(www\\.)?x\\.com(/|$)", replace: "https://fixupx.com/" },
  { name: "Threads → fixthreads", enabled: true, match: "^https?://(www\\.)?threads\\.com(/|$)", replace: "https://fixthreads.com/" },
  { name: "Instagram → zzinstagram", enabled: true, match: "^https?://(www\\.)?instagram\\.com(/|$)", replace: "https://zzinstagram.com/" },
  { name: "TikTok → tnktok", enabled: true, match: "^https?://(www\\.)?tiktok\\.com(/|$)", replace: "https://tnktok.com/" },
  { name: "Bluesky → fxbsky", enabled: true, match: "^https?://(www\\.)?bsky\\.app(/|$)", replace: "https://fxbsky.app/" }
];

async function getRules() {
  const data = await chrome.storage.sync.get({ rules: null });
  if (!Array.isArray(data.rules) || data.rules.length === 0) {
    await chrome.storage.sync.set({ rules: DEFAULT_RULES });
    return DEFAULT_RULES;
  }
  return data.rules;
}

function applyRules(url, rules) {
  for (const rule of rules) {
    if (!rule?.enabled) continue;
    try {
      const re = new RegExp(rule.match, "i");
      if (re.test(url)) return url.replace(re, rule.replace);
    } catch (e) {
      console.warn("Règle invalide ignorée:", rule, e);
    }
  }
  return "";
}

async function convertAndCopyFromTab(tab) {
  const url = tab?.url || "";
  if (!url) return;

  const rules = await getRules();
  const newUrl = applyRules(url, rules);
  if (!newUrl) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (urlToCopy) => {
      // Méthode 1 : textarea + execCommand (très compatible)
      try {
        const ta = document.createElement("textarea");
        ta.value = urlToCopy;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        ta.style.left = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) return;
      } catch (_) {
        // continue vers fallback
      }

      // Méthode 2 : Clipboard API (si dispo)
      try {
        await navigator.clipboard.writeText(urlToCopy);
      } catch (e) {
        console.error("Impossible de copier :", e);
      }
    },
    args: [newUrl]
  });

}

chrome.action.onClicked.addListener(async (tab) => {
  await convertAndCopyFromTab(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "convert-and-copy") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await convertAndCopyFromTab(tab);
});
