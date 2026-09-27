// Synthetic metadata and builders stay in isolated test VMs, before engine loading.
const { config, descriptor, pair } = require("./formula-structured-fixtures");

function installStructuredFixtures(core) {
  const metadata = {
    label: "Synthetic structured criteria", libraryId: "common", categoryId: "lookups",
    availability: { extension: true, portfolio: false }, keywords: ["synthetic", "criteria"]
  };
  const first = config([
    { id: "criteria", label: "Criteria", type: "criteria[]", defaultValue: [pair()] },
    { id: "note", label: "Note", type: "text", required: false }
  ], metadata);
  const second = { ...first, id: "syntheticSecond", label: "Synthetic second criteria" };
  // Use an existing category without inventing production discovery metadata.
  first.categoryId = second.categoryId = core.categories[0].id;
  core.catalog = { ...core.catalog, [first.id]: first, [second.id]: second };
  core.commonBuilders = { ...core.commonBuilders,
    registry: core.commonBuilders.createRegistry({ criteriaAggregate: descriptor() }) };
}

const descendants = node => [node, ...node.children.flatMap(descendants)];
function structuredControl(panel, label, index = 0) {
  const match = descendants(panel.get("fields")).filter(node => node.tagName === "label" && node.textContent === label)[index];
  if (!match) throw new Error(`Missing structured label: ${label}`);
  return panel.get(match.getAttribute("for"));
}
function editStructured(panel, label, value, index = 0) {
  const control = structuredControl(panel, label, index);
  control.focus(); control.value = value;
  control.dispatch(control.tagName === "select" ? "change" : "input");
  return control;
}
module.exports = { installStructuredFixtures, descendants, structuredControl, editStructured };
