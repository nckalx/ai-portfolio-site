const assert = require("node:assert/strict");
const test = require("node:test");

const { loadBrowserScript } = require("./helpers/load-browser-script");

loadBrowserScript("js/schedule-date-utils.js", "ScheduleDateUtils");
const ScheduleCriticalPath = loadBrowserScript("js/schedule-critical-path.js", "ScheduleCriticalPath");

const ONE_ROW_WARNING =
  "Estimated critical path contains only one eligible row. This may indicate incomplete dependency data, missing hierarchy information, or overly broad summary-row classification.";

function makeParsedDate(year, month, day) {
  return {
    date: new Date(year, month - 1, day),
    displayValue: `${month}/${day}/${year}`,
    isMissing: false,
    isValid: true
  };
}

function makeParsedDates({
  baselineStart = [2026, 2, 2],
  baselineFinish = [2026, 2, 2],
  currentStart = [2026, 2, 2],
  currentFinish = [2026, 2, 2]
} = {}) {
  return {
    baselineStart: makeParsedDate(...baselineStart),
    baselineFinish: makeParsedDate(...baselineFinish),
    currentStart: makeParsedDate(...currentStart),
    currentFinish: makeParsedDate(...currentFinish)
  };
}

function makeInvalidParsedDates() {
  return {
    baselineStart: { date: null, displayValue: "", isMissing: true, isValid: false },
    baselineFinish: makeParsedDate(2026, 2, 2),
    currentStart: makeParsedDate(2026, 2, 2),
    currentFinish: makeParsedDate(2026, 2, 2)
  };
}

function makeRow(overrides = {}) {
  return {
    sourceDataRowNumber: 1,
    taskId: "A",
    taskName: "Task A",
    projectName: "Project Alpha",
    rowType: "Task",
    includeInCriticalPathOverride: null,
    hasChildRows: false,
    classification: "detail",
    excludeFromFutureCriticalPath: false,
    validForMovement: true,
    dateWarnings: [],
    parsedDates: makeParsedDates(),
    resolvedPredecessors: [],
    criticalPathEligible: false,
    criticalPathExclusionReason: "",
    isOnBaselineCriticalPath: false,
    isOnCurrentCriticalPath: false,
    criticalPathStatus: "",
    criticalPathSequenceBaseline: "",
    criticalPathSequenceCurrent: "",
    ...overrides
  };
}

function makeLink(predecessorRow, overrides = {}) {
  return {
    resolved: true,
    predecessorRow,
    relationshipType: "FS",
    lagDays: 0,
    ...overrides
  };
}

function runCriticalPath(rows, mappingValues = { projectNameRaw: "Project Name" }, analyzerOptions = {}) {
  return ScheduleCriticalPath.addCriticalPathAnalysis(rows, mappingValues, analyzerOptions);
}

test("loads the ScheduleCriticalPath browser namespace", () => {
  assert.ok(ScheduleCriticalPath);

  [
    "addCriticalPathAnalysis",
    "isSameProjectGroup",
    "isSupportedCriticalPathRelationship",
    "getEligibleDependencyLinks",
    "buildCriticalPathSummary"
  ].forEach((functionName) => {
    assert.equal(typeof ScheduleCriticalPath[functionName], "function");
  });
});

test("recognizes supported and unsupported dependency relationships", () => {
  ["FS", "SS", "FF", "SF"].forEach((relationshipType) => {
    assert.equal(ScheduleCriticalPath.isSupportedCriticalPathRelationship(relationshipType), true);
  });

  assert.equal(ScheduleCriticalPath.isSupportedCriticalPathRelationship("XX"), false);
  assert.equal(ScheduleCriticalPath.isSupportedCriticalPathRelationship(""), false);
  assert.equal(ScheduleCriticalPath.isSupportedCriticalPathRelationship("fs"), false);
});

test("compares project groups using the current projectName values", () => {
  assert.equal(
    ScheduleCriticalPath.isSameProjectGroup({ projectName: "Project Alpha" }, { projectName: "Project Alpha" }),
    true
  );
  assert.equal(
    ScheduleCriticalPath.isSameProjectGroup({ projectName: "Project Alpha" }, { projectName: "Project Beta" }),
    false
  );
  assert.equal(ScheduleCriticalPath.isSameProjectGroup({ projectName: "" }, { projectName: "" }), true);
});

test("applies critical path eligibility exclusions and exact reason strings", () => {
  const rows = [
    makeRow({ taskId: "TASK", rowType: "Task" }),
    makeRow({
      taskId: "INVALID",
      validForMovement: false,
      dateWarnings: ["Missing baseline start."],
      parsedDates: makeInvalidParsedDates()
    }),
    makeRow({ taskId: "WARNING", validForMovement: false }),
    makeRow({ taskId: "PARENT", hasChildRows: true }),
    makeRow({ taskId: "SUMMARY", classification: "likely-summary", excludeFromFutureCriticalPath: true }),
    makeRow({ taskId: "SPEND", rowType: "Spend" }),
    makeRow({ taskId: "REPORT", rowType: "Reporting" }),
    makeRow({ taskId: "NO", includeInCriticalPathOverride: false }),
    makeRow({ taskId: "ACTIVITY", rowType: "Activity" }),
    makeRow({ taskId: "MILESTONE", rowType: "Milestone" })
  ];

  runCriticalPath(rows);

  const reasonByTaskId = new Map(rows.map((row) => [row.taskId, row.criticalPathExclusionReason]));

  assert.equal(reasonByTaskId.get("TASK"), "Eligible");
  assert.equal(reasonByTaskId.get("INVALID"), "Invalid or missing schedule dates");
  assert.equal(reasonByTaskId.get("WARNING"), "Warning/non-calculable row");
  assert.equal(reasonByTaskId.get("PARENT"), "Parent/summary row based on hierarchy");
  assert.equal(reasonByTaskId.get("SUMMARY"), "Likely parent/summary row based on fallback heuristic");
  assert.equal(reasonByTaskId.get("SPEND"), "Excluded by Row Type mapping");
  assert.equal(reasonByTaskId.get("REPORT"), "Excluded by Row Type mapping");
  assert.equal(reasonByTaskId.get("NO"), "Excluded by Include in Critical Path mapping");
  assert.equal(reasonByTaskId.get("ACTIVITY"), "Eligible");
  assert.equal(reasonByTaskId.get("MILESTONE"), "Eligible");
});

test("keeps existing include override priority below other exclusions", () => {
  const rows = [
    makeRow({
      taskId: "INCLUDE_INVALID",
      includeInCriticalPathOverride: true,
      validForMovement: false,
      dateWarnings: ["Missing baseline start."],
      parsedDates: makeInvalidParsedDates()
    }),
    makeRow({ taskId: "INCLUDE_PARENT", includeInCriticalPathOverride: true, hasChildRows: true }),
    makeRow({
      taskId: "INCLUDE_SUMMARY",
      includeInCriticalPathOverride: true,
      classification: "likely-summary",
      excludeFromFutureCriticalPath: true
    }),
    makeRow({ taskId: "INCLUDE_SPEND", includeInCriticalPathOverride: true, rowType: "Spend" })
  ];

  runCriticalPath(rows);

  const reasonByTaskId = new Map(rows.map((row) => [row.taskId, row.criticalPathExclusionReason]));

  assert.equal(reasonByTaskId.get("INCLUDE_INVALID"), "Invalid or missing schedule dates");
  assert.equal(reasonByTaskId.get("INCLUDE_PARENT"), "Parent/summary row based on hierarchy");
  assert.equal(reasonByTaskId.get("INCLUDE_SUMMARY"), "Likely parent/summary row based on fallback heuristic");
  assert.equal(reasonByTaskId.get("INCLUDE_SPEND"), "Excluded by Row Type mapping");
});

test("addCriticalPathAnalysis stamps critical path fields onto original rows", () => {
  const row = makeRow({ criticalPathExclusionReason: "Not evaluated", criticalPathStatus: "Not Critical" });
  const result = runCriticalPath([row]);

  assert.equal(result.currentPathRows[0], row);
  assert.equal(row.criticalPathEligible, true);
  assert.equal(row.criticalPathExclusionReason, "Eligible");
  assert.equal(row.isOnBaselineCriticalPath, true);
  assert.equal(row.isOnCurrentCriticalPath, true);
  assert.equal(row.criticalPathStatus, "Both");
  assert.equal(row.criticalPathSequenceBaseline, 1);
  assert.equal(row.criticalPathSequenceCurrent, 1);
});

test("builds a deterministic same-project three-task chain", () => {
  const taskA = makeRow({
    sourceDataRowNumber: 1,
    taskId: "A",
    taskName: "Task A",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 2],
      baselineFinish: [2026, 2, 2],
      currentStart: [2026, 2, 2],
      currentFinish: [2026, 2, 2]
    })
  });
  const taskB = makeRow({
    sourceDataRowNumber: 2,
    taskId: "B",
    taskName: "Task B",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 3],
      baselineFinish: [2026, 2, 3],
      currentStart: [2026, 2, 3],
      currentFinish: [2026, 2, 3]
    })
  });
  const taskC = makeRow({
    sourceDataRowNumber: 3,
    taskId: "C",
    taskName: "Task C",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 4],
      baselineFinish: [2026, 2, 4],
      currentStart: [2026, 2, 4],
      currentFinish: [2026, 2, 4]
    })
  });

  taskB.resolvedPredecessors = [makeLink(taskA)];
  taskC.resolvedPredecessors = [makeLink(taskB)];

  const result = runCriticalPath([taskA, taskB, taskC]);

  assert.deepEqual(result.baselinePathRows.map((row) => row.taskId), ["A", "B", "C"]);
  assert.deepEqual(result.currentPathRows.map((row) => row.taskId), ["A", "B", "C"]);
  assert.equal(result.projectResults.length, 1);
  assert.equal(result.projectResults[0].summary.currentCriticalPathTaskCount, 3);
  assert.deepEqual(
    [taskA, taskB, taskC].map((row) => row.criticalPathSequenceCurrent),
    [1, 2, 3]
  );
  assert.deepEqual(
    [taskA, taskB, taskC].map((row) => row.criticalPathStatus),
    ["Both", "Both", "Both"]
  );
});

test("omits dependency links with ineligible predecessors or successors from graph logic", () => {
  const ineligiblePredecessor = makeRow({ taskId: "SPEND", rowType: "Spend" });
  const eligibleSuccessor = makeRow({ taskId: "SUCCESSOR" });
  const eligiblePredecessor = makeRow({ taskId: "PREDECESSOR" });
  const ineligibleSuccessor = makeRow({ taskId: "REPORT", rowType: "Reporting" });

  eligibleSuccessor.resolvedPredecessors = [makeLink(ineligiblePredecessor)];
  ineligibleSuccessor.resolvedPredecessors = [makeLink(eligiblePredecessor)];

  const rows = [ineligiblePredecessor, eligibleSuccessor, eligiblePredecessor, ineligibleSuccessor];
  runCriticalPath(rows);

  const eligibleRows = new Set(rows.filter((row) => row.criticalPathEligible));

  assert.deepEqual(ScheduleCriticalPath.getEligibleDependencyLinks(eligibleSuccessor, eligibleRows), []);
  assert.deepEqual(ScheduleCriticalPath.getEligibleDependencyLinks(ineligibleSuccessor, eligibleRows), []);
  assert.equal(eligibleSuccessor.isOnCurrentCriticalPath, true);
  assert.equal(ineligiblePredecessor.isOnCurrentCriticalPath, false);
  assert.equal(ineligibleSuccessor.isOnCurrentCriticalPath, false);
});

test("omits cross-project predecessor links while completing grouped analysis", () => {
  const projectARow = makeRow({ taskId: "A", projectName: "Project Alpha" });
  const projectBRow = makeRow({
    taskId: "B",
    projectName: "Project Beta",
    resolvedPredecessors: [makeLink(projectARow)]
  });

  const result = runCriticalPath([projectARow, projectBRow]);

  assert.equal(result.projectResults.length, 2);
  assert.equal(result.summary.projectGroupCount, 2);
  assert.ok(result.summary.warnings.includes("1 cross-project predecessor link(s) omitted from estimated critical path."));
  assert.deepEqual(
    result.projectResults.map((projectResult) => projectResult.currentPathRows.map((row) => row.taskId)),
    [["A"], ["B"]]
  );
});

test("adds the current one-row warning for a one-row eligible project", () => {
  const result = runCriticalPath([makeRow()]);

  assert.ok(result.summary.warnings.includes(ONE_ROW_WARNING));
  assert.ok(result.projectResults[0].summary.warnings.includes(ONE_ROW_WARNING));
});

test("returns circular dependency warnings without hanging or throwing", () => {
  const taskA = makeRow({ taskId: "A", taskName: "Task A" });
  const taskB = makeRow({
    taskId: "B",
    taskName: "Task B",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 3],
      baselineFinish: [2026, 2, 3],
      currentStart: [2026, 2, 3],
      currentFinish: [2026, 2, 3]
    })
  });

  taskA.resolvedPredecessors = [makeLink(taskB)];
  taskB.resolvedPredecessors = [makeLink(taskA)];

  const result = runCriticalPath([taskA, taskB]);

  assert.ok(
    result.summary.warnings.some((warning) => {
      return warning.startsWith("Circular dependency detected near ");
    })
  );
});

test("analyzes two project groups separately without cross-group sequence chaining", () => {
  const alphaA = makeRow({ taskId: "A1", projectName: "Project Alpha" });
  const alphaB = makeRow({
    taskId: "A2",
    projectName: "Project Alpha",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 3],
      baselineFinish: [2026, 2, 3],
      currentStart: [2026, 2, 3],
      currentFinish: [2026, 2, 3]
    })
  });
  const betaA = makeRow({ taskId: "B1", projectName: "Project Beta" });
  const betaB = makeRow({
    taskId: "B2",
    projectName: "Project Beta",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 3],
      baselineFinish: [2026, 2, 3],
      currentStart: [2026, 2, 3],
      currentFinish: [2026, 2, 3]
    })
  });

  alphaB.resolvedPredecessors = [makeLink(alphaA)];
  betaB.resolvedPredecessors = [makeLink(betaA)];

  const result = runCriticalPath([alphaA, alphaB, betaA, betaB]);

  assert.equal(result.projectResults.length, 2);
  assert.equal(result.summary.projectGroupCount, 2);
  assert.deepEqual(
    result.projectResults.map((projectResult) => projectResult.currentPathRows.map((row) => row.taskId)),
    [
      ["A1", "A2"],
      ["B1", "B2"]
    ]
  );
  assert.deepEqual([alphaA.criticalPathSequenceCurrent, alphaB.criticalPathSequenceCurrent], [1, 2]);
  assert.deepEqual([betaA.criticalPathSequenceCurrent, betaB.criticalPathSequenceCurrent], [1, 2]);
});

test("uses supplied holidays for estimated finish-shift workday metrics", () => {
  const weekendOnlyRow = makeRow({
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 13],
      baselineFinish: [2026, 2, 13],
      currentStart: [2026, 2, 16],
      currentFinish: [2026, 2, 16]
    })
  });
  const holidayAwareRow = makeRow({
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 13],
      baselineFinish: [2026, 2, 13],
      currentStart: [2026, 2, 16],
      currentFinish: [2026, 2, 16]
    })
  });

  const weekendOnlyResult = runCriticalPath([weekendOnlyRow], {}, { holidayDateSet: new Set() });
  const holidayAwareResult = runCriticalPath(
    [holidayAwareRow],
    {},
    { holidayDateSet: new Set(["2026-02-16"]) }
  );

  assert.equal(weekendOnlyResult.summary.finishShiftWorkdays, 1);
  assert.equal(holidayAwareResult.summary.finishShiftWorkdays, 0);
});
