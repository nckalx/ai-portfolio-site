// Extension discovery policy only; the canonical catalog and engine retain all 26 types.
(() => {
  const excludedIds = new Set(["multiLineReportLabel", "rioIdLookup"]);

  function findFormulas(catalog, categories, query = "", categoryId = "") {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return Object.values(catalog).filter(config => {
      if (excludedIds.has(config.id) || (categoryId && config.categoryId !== categoryId)) return false;
      const category = categories.find(entry => entry.id === config.categoryId);
      // Deliberately index user-facing metadata only, never internal IDs or field defaults.
      const text = [config.label, config.explanation, category?.label || "", ...config.keywords].join(" ").toLowerCase();
      return terms.every(term => text.includes(term));
    });
  }

  globalThis.FormulaDiscovery = { findFormulas };
})();
