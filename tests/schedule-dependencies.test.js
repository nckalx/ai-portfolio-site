const assert = require("node:assert/strict");
const test = require("node:test");

const { loadBrowserScript } = require("./helpers/load-browser-script");

const ScheduleDependencies = loadBrowserScript("js/schedule-dependencies.js", "ScheduleDependencies");

function makeRow(overrides = {}) {
  return {
    sourceDataRowNumber: 1,
    excelRowNumber: "",
    taskId: "",
    taskName: "Task",
    predecessors: "",
    classification: "detail",
    validForMovement: true,
    parsedPredecessors: [],
    resolvedPredecessors: [],
    dependencyWarnings: [],
    ...overrides
  };
}

test("loads the ScheduleDependencies browser namespace", () => {
  assert.ok(ScheduleDependencies);

  [
    "parsePredecessorToken",
    "parsePredecessorValue",
    "buildPredecessorResolutionIndex",
    "findPredecessorRow",
    "addDependencyAnalysis",
    "getDependencyIssueLinks",
    "buildDependencySummary"
  ].forEach((functionName) => {
    assert.equal(typeof ScheduleDependencies[functionName], "function");
  });
});

test("parses basic predecessor references with default and explicit FS relationships", () => {
  const [defaultRelationship] = ScheduleDependencies.parsePredecessorValue("4");
  const [explicitRelationship] = ScheduleDependencies.parsePredecessorValue("4FS");

  assert.equal(defaultRelationship.referenceText, "4");
  assert.equal(defaultRelationship.relationshipType, "FS");
  assert.equal(defaultRelationship.lagDays, 0);
  assert.equal(defaultRelationship.isMalformed, false);

  assert.equal(explicitRelationship.referenceText, "4");
  assert.equal(explicitRelationship.relationshipType, "FS");
  assert.equal(explicitRelationship.lagDays, 0);
});

test("parses positive and negative day lag values", () => {
  const [positiveLag] = ScheduleDependencies.parsePredecessorValue("4FS+2d");
  const [negativeLag] = ScheduleDependencies.parsePredecessorValue("4FS - 2d");

  assert.equal(positiveLag.referenceText, "4");
  assert.equal(positiveLag.relationshipType, "FS");
  assert.equal(positiveLag.lagDays, 2);

  assert.equal(negativeLag.referenceText, "4");
  assert.equal(negativeLag.relationshipType, "FS");
  assert.equal(negativeLag.lagDays, -2);
});

test("parses supported predecessor relationship types", () => {
  const relationships = ScheduleDependencies.parsePredecessorValue("4SS, 5FF, 6SF");

  assert.deepEqual(
    relationships.map((predecessor) => predecessor.relationshipType),
    ["SS", "FF", "SF"]
  );
  assert.deepEqual(
    relationships.map((predecessor) => predecessor.referenceText),
    ["4", "5", "6"]
  );
});

test("parses multiple predecessor tokens in order", () => {
  const predecessors = ScheduleDependencies.parsePredecessorValue("4, 7FS+2d, 10SS");

  assert.deepEqual(
    predecessors.map((predecessor) => predecessor.originalText),
    ["4", "7FS+2d", "10SS"]
  );
  assert.deepEqual(
    predecessors.map((predecessor) => predecessor.relationshipType),
    ["FS", "FS", "SS"]
  );
  assert.deepEqual(
    predecessors.map((predecessor) => predecessor.lagDays),
    [0, 2, 0]
  );
});

test("handles supported spacing and ignores blank predecessor tokens", () => {
  const spacedPredecessor = ScheduleDependencies.parsePredecessorToken("4 FS + 2 days");
  const predecessors = ScheduleDependencies.parsePredecessorValue(" , , 4, , 5SS, ");

  assert.equal(spacedPredecessor.referenceText, "4");
  assert.equal(spacedPredecessor.relationshipType, "FS");
  assert.equal(spacedPredecessor.lagDays, 2);

  assert.deepEqual(
    predecessors.map((predecessor) => predecessor.originalText),
    ["4", "5SS"]
  );
  assert.deepEqual(ScheduleDependencies.parsePredecessorValue(""), []);
});

test("preserves current malformed and unsupported predecessor behavior", () => {
  const unsupportedRelationship = ScheduleDependencies.parsePredecessorToken("4XX");
  const malformedLagText = ScheduleDependencies.parsePredecessorToken("4FS+xd");

  assert.equal(unsupportedRelationship.referenceText, "4");
  assert.equal(unsupportedRelationship.relationshipType, "XX");
  assert.equal(unsupportedRelationship.isMalformed, true);
  assert.equal(unsupportedRelationship.issueMessage, "Unsupported predecessor relationship type: XX.");

  assert.equal(malformedLagText.referenceText, "4FS+xd");
  assert.equal(malformedLagText.relationshipType, "FS");
  assert.equal(malformedLagText.lagDays, 0);
  assert.equal(malformedLagText.isMalformed, false);
});

test("resolves predecessor references by source row, Excel row, and mapped task ID", () => {
  const sourceRow = makeRow({ sourceDataRowNumber: 2, excelRowNumber: 12, taskId: "SRC", taskName: "Source row" });
  const excelRow = makeRow({ sourceDataRowNumber: 3, excelRowNumber: 20, taskId: "EXCEL", taskName: "Excel row" });
  const numericTaskIdRow = makeRow({
    sourceDataRowNumber: 4,
    excelRowNumber: 21,
    taskId: "300",
    taskName: "Numeric task ID"
  });
  const namedTaskIdRow = makeRow({
    sourceDataRowNumber: 5,
    excelRowNumber: 22,
    taskId: "TASK-A",
    taskName: "Named task ID"
  });
  const resolutionIndex = ScheduleDependencies.buildPredecessorResolutionIndex([
    sourceRow,
    excelRow,
    numericTaskIdRow,
    namedTaskIdRow
  ]);

  assert.equal(
    ScheduleDependencies.findPredecessorRow(ScheduleDependencies.parsePredecessorToken("2"), resolutionIndex),
    sourceRow
  );
  assert.equal(
    ScheduleDependencies.findPredecessorRow(ScheduleDependencies.parsePredecessorToken("20"), resolutionIndex),
    excelRow
  );
  assert.equal(
    ScheduleDependencies.findPredecessorRow(ScheduleDependencies.parsePredecessorToken("300"), resolutionIndex),
    numericTaskIdRow
  );
  assert.equal(
    ScheduleDependencies.findPredecessorRow(ScheduleDependencies.parsePredecessorToken("TASK-A"), resolutionIndex),
    namedTaskIdRow
  );
  assert.equal(
    ScheduleDependencies.findPredecessorRow(ScheduleDependencies.parsePredecessorToken("MISSING"), resolutionIndex),
    null
  );
});

test("adds dependency warnings for self, summary-row, invalid-date, and unresolved links", () => {
  const summaryRow = makeRow({
    sourceDataRowNumber: 1,
    taskId: "SUMMARY",
    classification: "likely-summary",
    taskName: "Summary row"
  });
  const invalidDateRow = makeRow({
    sourceDataRowNumber: 2,
    taskId: "INVALID",
    validForMovement: false,
    taskName: "Invalid date row"
  });
  const successorRow = makeRow({
    sourceDataRowNumber: 3,
    taskId: "SUCCESSOR",
    taskName: "Successor",
    predecessors: "1, 2, 3, 99"
  });

  ScheduleDependencies.addDependencyAnalysis([summaryRow, invalidDateRow, successorRow]);

  assert.deepEqual(successorRow.dependencyWarnings, [
    "Predecessor points to a likely parent/summary row.",
    "Predecessor points to a row with invalid or missing dates.",
    "Predecessor points to itself.",
    "Predecessor reference could not be resolved."
  ]);
});

test("addDependencyAnalysis stamps parsed and resolved predecessor fields onto original rows", () => {
  const predecessorRow = makeRow({ sourceDataRowNumber: 1, taskId: "A", taskName: "Predecessor" });
  const successorRow = makeRow({ sourceDataRowNumber: 2, taskId: "B", taskName: "Successor", predecessors: "1FS+2d" });
  const rows = [predecessorRow, successorRow];
  const analyzedRows = ScheduleDependencies.addDependencyAnalysis(rows);
  const [link] = successorRow.resolvedPredecessors;

  assert.equal(analyzedRows, rows);
  assert.equal(successorRow.parsedPredecessors.length, 1);
  assert.equal(successorRow.dependencyWarnings.length, 0);
  assert.equal(link.predecessorValue, "1FS+2d");
  assert.equal(link.parsedReference, "1");
  assert.equal(link.originalText, "1FS+2d");
  assert.equal(link.relationshipType, "FS");
  assert.equal(link.lagDays, 2);
  assert.equal(link.resolved, true);
  assert.equal(link.predecessorTaskId, "A");
  assert.equal(link.predecessorTaskName, "Predecessor");
  assert.equal(link.predecessorRowClassification, "detail");
  assert.equal(link.predecessorRow, predecessorRow);
  assert.deepEqual(link.issueMessages, []);
  assert.equal(link.issueMessage, "");
});

test("buildDependencySummary counts predecessor rows, links, resolutions, and warning rows", () => {
  const firstRow = makeRow({ sourceDataRowNumber: 1, taskId: "A" });
  const cleanSuccessor = makeRow({ sourceDataRowNumber: 2, taskId: "B", predecessors: "1" });
  const warningSuccessor = makeRow({ sourceDataRowNumber: 3, taskId: "C", predecessors: "99, 1XX" });
  const rows = ScheduleDependencies.addDependencyAnalysis([firstRow, cleanSuccessor, warningSuccessor]);

  assert.deepEqual(ScheduleDependencies.buildDependencySummary(rows), {
    rowsWithPredecessorValues: 2,
    totalPredecessorReferences: 3,
    resolvedPredecessorLinks: 1,
    unresolvedPredecessorLinks: 2,
    summaryPredecessorLinks: 0,
    rowsWithDependencyWarnings: 1
  });
});
