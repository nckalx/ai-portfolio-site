// Extension discovery policy only; the canonical catalog and engine retain all 26 types.
(() => {
  const libraryIds = ["advanced", "common"]; // Advanced remains the transitional preference.
  const isAvailable = config => config.availability?.extension === true && libraryIds.includes(config.libraryId);

  function resolveDiscoveryState(catalog, categories, { libraryId = "advanced", categoryId = "" } = {}) {
    const available = Object.values(catalog).filter(isAvailable);
    const availableLibraries = libraryIds.filter(id => available.some(config => config.libraryId === id));
    if (!availableLibraries.includes(libraryId)) libraryId = availableLibraries[0] ?? null;
    const categoryIds = new Set(available.filter(config => config.libraryId === libraryId).map(config => config.categoryId));
    const availableCategories = categories.filter(category => categoryIds.has(category.id));
    if (!availableCategories.some(category => category.id === categoryId)) categoryId = "";
    return { libraryId, categoryId, availableLibraries, availableCategories };
  }

  function findFormulas(catalog, categories, query = "", categoryId = "", libraryId = "advanced") {
    if (!libraryIds.includes(libraryId)) return [];
    if (categoryId && !categories.some(category => category.id === categoryId)) return [];
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return Object.values(catalog).filter(config => {
      if (!isAvailable(config) || config.libraryId !== libraryId) return false;
      if (categoryId && config.categoryId !== categoryId) return false;
      const category = categories.find(entry => entry.id === config.categoryId);
      // Deliberately index user-facing metadata only, never internal IDs or field defaults.
      const text = [config.label, config.explanation, category?.label || "", ...config.keywords].join(" ").toLowerCase();
      return terms.every(term => text.includes(term));
    });
  }

  globalThis.FormulaDiscovery = { findFormulas, resolveDiscoveryState };
})();
