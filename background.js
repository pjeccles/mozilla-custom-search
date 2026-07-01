const DEFAULT_ENGINES = {
  g: {
    name: "Google",
    url: "https://www.google.com/search?q={searchTerms}"
  },
  c: {
    name: "Confluence",
    url: "https://confluence.netcommwireless.com/dosearchsite.action?cql=siteSearch+~+%22{searchTerms}%22&queryString={searchTerms}"
  },
  yt: {
    name: "YouTube",
    url: "https://www.youtube.com/results?search_query={searchTerms}"
  }
};

const FALLBACK_ENGINE_KEY = "g";

async function getEngines() {
  const { engines } = await browser.storage.sync.get("engines");
  return engines && Object.keys(engines).length ? engines : DEFAULT_ENGINES;
}

browser.runtime.onInstalled.addListener(async () => {
  const { engines } = await browser.storage.sync.get("engines");
  if (!engines) {
    await browser.storage.sync.set({ engines: DEFAULT_ENGINES });
  }
  await refreshDefaultSuggestion();
});

function parseInput(text) {
  const trimmed = text.trim();
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) {
    return { key: trimmed, terms: "" };
  }
  return {
    key: trimmed.slice(0, spaceIdx),
    terms: trimmed.slice(spaceIdx + 1).trim()
  };
}

function buildUrl(template, terms) {
  const encoded = encodeURIComponent(terms);
  return template.split("{searchTerms}").join(encoded);
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function describeEngines(engines) {
  const list = Object.entries(engines)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, engine]) => `${k} (${engine.name})`)
    .join(", ");
  return `Keywords: ${escapeXml(list)}`;
}

async function refreshDefaultSuggestion() {
  const engines = await getEngines();
  browser.omnibox.setDefaultSuggestion({ description: describeEngines(engines) });
}

// Set eagerly, well ahead of any omnibox interaction: onInputChanged doesn't
// fire until the user types a character beyond "ms ", so updating the
// default suggestion reactively (e.g. from onInputStarted) is too late to
// affect the row that's already on screen. Keeping it fresh proactively
// avoids that race entirely.
refreshDefaultSuggestion();
browser.runtime.onStartup.addListener(refreshDefaultSuggestion);
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.engines) {
    refreshDefaultSuggestion();
  }
});

browser.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const engines = await getEngines();
  const { key, terms } = parseInput(text);

  const matches = Object.entries(engines)
    .filter(([k]) => k.startsWith(key))
    .sort(([a], [b]) => a.localeCompare(b));

  const suggestions = matches.map(([k, engine]) => {
    const content = terms ? `${k} ${terms}` : `${k} `;
    const label = `${escapeXml(k)} — ${escapeXml(engine.name)}`;
    const description = terms
      ? `${label}: search for "${escapeXml(terms)}"`
      : label;
    return { content, description };
  });

  suggest(suggestions);
});

browser.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const engines = await getEngines();
  const { key, terms } = parseInput(text);

  let url;
  const engine = engines[key];

  if (engine && terms) {
    url = buildUrl(engine.url, terms);
  } else {
    const fallback = engines[FALLBACK_ENGINE_KEY] || Object.values(engines)[0];
    url = buildUrl(fallback.url, text.trim());
  }

  switch (disposition) {
    case "currentTab":
      browser.tabs.update({ url });
      break;
    case "newForegroundTab":
      browser.tabs.create({ url });
      break;
    case "newBackgroundTab":
      browser.tabs.create({ url, active: false });
      break;
  }
});
