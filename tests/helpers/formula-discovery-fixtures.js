// Discovery metadata only. Never ship these entries or send them to generation.
function discoveryFixture() {
  const categories = [
    { id: "text-labels", label: "Text & labels" },
    { id: "dates-status", label: "Dates & status" },
    { id: "counts-calculations", label: "Counts & calculations" },
    { id: "row-hierarchy", label: "Row hierarchy" },
    { id: "logic-conditions", label: "Logic & conditions" }
  ];
  const entry = (id, libraryId, categoryId, label, keyword) => ({
    id, libraryId, categoryId, label,
    explanation: "Shared discovery example", keywords: [keyword],
    availability: { extension: true, portfolio: false }
  });
  const catalog = {
    advancedRow: entry("advancedRow", "advanced", "row-hierarchy", "Zulu branch", "outline"),
    commonCount: entry("commonCount", "common", "counts-calculations", "Zebra total", "tally"),
    advancedText: entry("advancedText", "advanced", "text-labels", "Alpha caption", "caption"),
    commonText: entry("commonText", "common", "text-labels", "Alpha phrase", "caption"),
    advancedCount: entry("advancedCount", "advanced", "counts-calculations", "Middle total", "tally"),
    commonLogic: entry("commonLogic", "common", "logic-conditions", "Middle decision", "branching")
  };
  return { catalog, categories };
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

module.exports = { discoveryFixture, deepFreeze };
