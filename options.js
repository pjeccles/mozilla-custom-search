const DEFAULT_ENGINES = {
  g: {
    name: "Google",
    url: "https://www.google.com/search?q={searchTerms}"
  },
  c: {
    name: "Confluence",
    url: "https://confluence.mycompany.com/dosearchsite.action?cql=siteSearch+~+%22{searchTerms}%22&queryString={searchTerms}"
  },
  yt: {
    name: "YouTube",
    url: "https://www.youtube.com/results?search_query={searchTerms}"
  }
};

const body = document.getElementById("engines-body");
const statusEl = document.getElementById("status");
const syncBanner = document.getElementById("sync-banner");

let dirty = false;
let lastSavedJson = null;

function markDirty() {
  dirty = true;
}

function addRow(key = "", engine = { name: "", url: "" }) {
  const tr = document.createElement("tr");

  const keyTd = document.createElement("td");
  keyTd.className = "keyword";
  const keyInput = document.createElement("input");
  keyInput.type = "text";
  keyInput.value = key;
  keyInput.placeholder = "g";
  keyTd.appendChild(keyInput);

  const nameTd = document.createElement("td");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = engine.name;
  nameInput.placeholder = "Google";
  nameTd.appendChild(nameInput);

  const urlTd = document.createElement("td");
  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.value = engine.url;
  urlInput.placeholder = "https://example.com/search?q={searchTerms}";
  urlTd.appendChild(urlInput);

  const removeTd = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-row";
  removeBtn.textContent = "✕";
  removeBtn.title = "Remove this keyword";
  removeBtn.addEventListener("click", () => {
    tr.remove();
    markDirty();
  });
  removeTd.appendChild(removeBtn);

  tr.append(keyTd, nameTd, urlTd, removeTd);
  body.appendChild(tr);
}

async function load() {
  const { engines } = await browser.storage.sync.get("engines");
  const data = engines && Object.keys(engines).length ? engines : DEFAULT_ENGINES;
  body.innerHTML = "";
  for (const [key, engine] of Object.entries(data)) {
    addRow(key, engine);
  }
  dirty = false;
  syncBanner.hidden = true;
}

function readRows() {
  const engines = {};
  const errors = [];

  for (const tr of body.children) {
    const [keyInput, nameInput, urlInput] = tr.querySelectorAll("input");
    const key = keyInput.value.trim().toLowerCase();
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (!key && !name && !url) {
      continue;
    }

    if (!key || /\s/.test(key)) {
      errors.push(`Keyword "${key || "(empty)"}" must be a single word.`);
      continue;
    }
    if (!url) {
      errors.push(`Keyword "${key}" needs a URL.`);
      continue;
    }
    if (!url.includes("{searchTerms}")) {
      errors.push(`URL for "${key}" should include {searchTerms}.`);
    }
    if (engines[key]) {
      errors.push(`Keyword "${key}" is defined more than once.`);
      continue;
    }

    engines[key] = { name: name || key, url };
  }

  return { engines, errors };
}

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#c00" : "#2a7d2a";
}

body.addEventListener("input", markDirty);

document.getElementById("add-row").addEventListener("click", () => {
  addRow();
  markDirty();
});

document.getElementById("save").addEventListener("click", async () => {
  const { engines, errors } = readRows();

  if (Object.keys(engines).length === 0) {
    showStatus("Add at least one keyword before saving.", true);
    return;
  }
  if (errors.length) {
    showStatus(errors.join(" "), true);
    return;
  }

  lastSavedJson = JSON.stringify(engines);
  await browser.storage.sync.set({ engines });
  dirty = false;
  syncBanner.hidden = true;
  showStatus("Saved. This will sync to your other Firefox Account devices shortly.");
});

document.getElementById("reset").addEventListener("click", async () => {
  lastSavedJson = JSON.stringify(DEFAULT_ENGINES);
  await browser.storage.sync.set({ engines: DEFAULT_ENGINES });
  await load();
  showStatus("Reset to defaults.");
});

document.getElementById("open-sync-settings").addEventListener("click", () => {
  browser.tabs.create({ url: "about:preferences#sync" });
});

document.getElementById("reload-remote").addEventListener("click", async () => {
  await load();
  showStatus("Reloaded settings synced from another device.");
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.engines) {
    return;
  }

  // Ignore the echo of our own save() call.
  if (JSON.stringify(changes.engines.newValue) === lastSavedJson) {
    return;
  }

  if (dirty) {
    syncBanner.hidden = false;
  } else {
    load();
    showStatus("Settings synced from another device.");
  }
});

load();
