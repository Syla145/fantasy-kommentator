// ============================================================
// TEMPLATE-ENGINE – Auswahl & Platzhalter-Ersetzung
// ============================================================

const Templates = (() => {
  let data = null;
  // Merkt sich pro trigger+host, welche Indizes schon benutzt wurden,
  // damit sich Sätze innerhalb einer Show nicht zu schnell wiederholen.
  const usedIndices = {};

  async function load(path = "templates.json") {
    const res = await fetch(path);
    data = await res.json();
    return data;
  }

  function poolKey(trigger, host) {
    return `${trigger}::${host}`;
  }

  function pickVariant(trigger, host) {
    if (!data || !data[trigger] || !data[trigger][host]) {
      console.warn(`Kein Template-Pool für ${trigger}/${host}`);
      return null;
    }
    const pool = data[trigger][host];
    const key = poolKey(trigger, host);
    if (!usedIndices[key]) usedIndices[key] = new Set();

    // Wenn alle Varianten schon dran waren, Pool zurücksetzen
    if (usedIndices[key].size >= pool.length) {
      usedIndices[key].clear();
    }

    let idx;
    do {
      idx = Math.floor(Math.random() * pool.length);
    } while (usedIndices[key].has(idx));
    usedIndices[key].add(idx);

    return pool[idx];
  }

  function fillPlaceholders(template, context) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return context[key] !== undefined && context[key] !== null
        ? context[key]
        : match; // Platzhalter unverändert lassen, falls Wert fehlt
    });
  }

  // host: "kevin" | "jeremy" | null (null = zufällig einer der beiden)
  function generate(trigger, context, host = null) {
    const chosenHost = host || (Math.random() < 0.5 ? "kevin" : "jeremy");
    const raw = pickVariant(trigger, chosenHost);
    if (!raw) return null;
    return { host: chosenHost, text: fillPlaceholders(raw, context) };
  }

  return { load, generate };
})();
