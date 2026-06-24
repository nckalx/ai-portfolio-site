const assert = require("node:assert/strict");
const test = require("node:test");

const { loadBrowserScript } = require("./helpers/load-browser-script");

loadBrowserScript("js/schedule-date-utils.js", "ScheduleDateUtils");
const ScheduleDependencies = loadBrowserScript("js/schedule-dependencies.js", "ScheduleDependencies");
const ScheduleCriticalPath = loadBrowserScript("js/schedule-critical-path.js", "ScheduleCriticalPath");

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

function makeAnalyzedRow(overrides = {}) {
  return {
    sourceDataRowNumber: 1,
    excelRowNumber: 2,
    taskId: "A",
    taskName: "Task A",
    projectName: "Project Alpha",
    baselineStart: "02/02/2026",
    baselineFinish: "02/02/2026",
    currentStart: "02/02/2026",
    currentFinish: "02/02/2026",
    predecessors: "",
    classification: "detail",
    rowType: "Task",
    includeInCriticalPathOverride: null,
    hasChildRows: false,
    excludeFromFutureCriticalPath: false,
    validForMovement: true,
    dateWarnings: [],
    parsedDates: makeParsedDates(),
    parsedPredecessors: [],
    resolvedPredecessors: [],
    dependencyWarnings: [],
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

function analyzeDependenciesThenCriticalPath(
  rows,
  mappingValues = { projectNameRaw: "Project Name" },
  analyzerOptions = {}
) {
  const dependencyRows = ScheduleDependencies.addDependencyAnalysis(rows);
  const criticalPathResult = ScheduleCriticalPath.addCriticalPathAnalysis(
    dependencyRows,
    mappingValues,
    analyzerOptions
  );

  return {
    rows: dependencyRows,
    criticalPathResult
  };
}

test("dependency analysis feeds a valid three-task chain into critical path analysis", () => {
  const taskA = makeAnalyzedRow({
    sourceDataRowNumber: 1,
    excelRowNumber: 2,
    taskId: "A",
    taskName: "Task A"
  });
  const taskB = makeAnalyzedRow({
    sourceDataRowNumber: 2,
    excelRowNumber: 3,
    taskId: "B",
    taskName: "Task B",
    predecessors: "1",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 3],
      baselineFinish: [2026, 2, 3],
      currentStart: [2026, 2, 3],
      currentFinish: [2026, 2, 3]
    })
  });
  const taskC = makeAnalyzedRow({
    sourceDataRowNumber: 3,
    excelRowNumber: 4,
    taskId: "C",
    taskName: "Task C",
    predecessors: "2FS",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 13],
      baselineFinish: [2026, 2, 13],
      currentStart: [2026, 2, 16],
      currentFinish: [2026, 2, 16]
    })
  });
  const originalRows = [taskA, taskB, taskC];

  const result = analyzeDependenciesThenCriticalPath(
    originalRows,
    { projectNameRaw: "Project Name" },
    { holidayDateSet: new Set(["2026-02-16"]) }
  );

  assert.equal(result.rows, originalRows);
  assert.deepEqual(taskB.parsedPredecessors.map((predecessor) => predecessor.originalText), ["1"]);
  assert.deepEqual(taskC.parsedPredecessors.map((predecessor) => predecessor.originalText), ["2FS"]);
  assert.equal(taskB.resolvedPredecessors[0].predecessorRow, taskA);
  assert.equal(taskC.resolvedPredecessors[0].predecessorRow, taskB);
  assert.deepEqual(originalRows.flatMap((row) => row.dependencyWarnings), []);
  assert.deepEqual(
    originalRows.map((row) => row.criticalPathEligible),
    [true, true, true]
  );
  assert.deepEqual(
    originalRows.map((row) => row.criticalPathSequenceCurrent),
    [1, 2, 3]
  );
  assert.deepEqual(
    originalRows.map((row) => row.criticalPathStatus),
    ["Both", "Both", "Both"]
  );
  assert.deepEqual(result.criticalPathResult.currentPathRows.map((row) => row.taskId), ["A", "B", "C"]);
  assert.equal(result.criticalPathResult.summary.finishShiftWorkdays, 0);
});

test("unresolved predecessor warnings do not prevent critical path analysis from completing", () => {
  const rootTask = makeAnalyzedRow({
    sourceDataRowNumber: 1,
    taskId: "ROOT",
    taskName: "Root Task"
  });
  const unresolvedTask = makeAnalyzedRow({
    sourceDataRowNumber: 2,
    taskId: "WAITING",
    taskName: "Waiting Task",
    predecessors: "99",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 3],
      baselineFinish: [2026, 2, 3],
      currentStart: [2026, 2, 3],
      currentFinish: [2026, 2, 3]
    })
  });
  const downstreamTask = makeAnalyzedRow({
    sourceDataRowNumber: 3,
    taskId: "DOWNSTREAM",
    taskName: "Downstream Task",
    predecessors: "2",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 4],
      baselineFinish: [2026, 2, 4],
      currentStart: [2026, 2, 4],
      currentFinish: [2026, 2, 4]
    })
  });

  const { criticalPathResult } = analyzeDependenciesThenCriticalPath([
    rootTask,
    unresolvedTask,
    downstreamTask
  ]);

  assert.deepEqual(unresolvedTask.dependencyWarnings, ["Predecessor reference could not be resolved."]);
  assert.equal(unresolvedTask.resolvedPredecessors[0].resolved, false);
  assert.deepEqual(
    [rootTask, unresolvedTask, downstreamTask].map((row) => row.criticalPathEligible),
    [true, true, true]
  );
  assert.deepEqual(criticalPathResult.currentPathRows.map((row) => row.taskId), ["WAITING", "DOWNSTREAM"]);
  assert.ok(
    criticalPathResult.summary.warnings.includes("1 unresolved predecessor link(s) were omitted from the estimate.")
  );
});

test("project grouping and exclusion boundaries are preserved across dependency and critical path modules", () => {
  const alphaRoot = makeAnalyzedRow({
    sourceDataRowNumber: 1,
    taskId: "ALPHA-ROOT",
    taskName: "Alpha Root",
    projectName: "Project Alpha"
  });
  const alphaSpend = makeAnalyzedRow({
    sourceDataRowNumber: 2,
    taskId: "ALPHA-SPEND",
    taskName: "Alpha Spend Review",
    projectName: "Project Alpha",
    rowType: "Spend",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 3],
      baselineFinish: [2026, 2, 3],
      currentStart: [2026, 2, 3],
      currentFinish: [2026, 2, 3]
    })
  });
  const alphaFinish = makeAnalyzedRow({
    sourceDataRowNumber: 3,
    taskId: "ALPHA-FINISH",
    taskName: "Alpha Finish",
    projectName: "Project Alpha",
    predecessors: "2",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 4],
      baselineFinish: [2026, 2, 4],
      currentStart: [2026, 2, 4],
      currentFinish: [2026, 2, 4]
    })
  });
  const betaRoot = makeAnalyzedRow({
    sourceDataRowNumber: 4,
    taskId: "BETA-ROOT",
    taskName: "Beta Root",
    projectName: "Project Beta",
    predecessors: "1"
  });
  const betaFinish = makeAnalyzedRow({
    sourceDataRowNumber: 5,
    taskId: "BETA-FINISH",
    taskName: "Beta Finish",
    projectName: "Project Beta",
    predecessors: "4",
    parsedDates: makeParsedDates({
      baselineStart: [2026, 2, 3],
      baselineFinish: [2026, 2, 3],
      currentStart: [2026, 2, 3],
      currentFinish: [2026, 2, 3]
    })
  });

  const { criticalPathResult } = analyzeDependenciesThenCriticalPath([
    alphaRoot,
    alphaSpend,
    alphaFinish,
    betaRoot,
    betaFinish
  ]);

  assert.equal(alphaSpend.criticalPathEligible, false);
  assert.equal(alphaSpend.criticalPathExclusionReason, "Excluded by Row Type mapping");
  assert.equal(alphaSpend.criticalPathSequenceCurrent, "");
  assert.equal(betaRoot.resolvedPredecessors[0].predecessorRow, alphaRoot);
  assert.equal(alphaFinish.resolvedPredecessors[0].predecessorRow, alphaSpend);
  assert.equal(criticalPathResult.summary.projectGroupCount, 2);
  assert.ok(
    criticalPathResult.summary.warnings.includes(
      "1 cross-project predecessor link(s) omitted from estimated critical path."
    )
  );
  assert.ok(
    criticalPathResult.summary.warnings.includes(
      "1 resolved predecessor link(s) involved ineligible rows and were omitted."
    )
  );
  assert.deepEqual(
    criticalPathResult.projectResults.map((projectResult) => {
      return projectResult.currentPathRows.map((row) => row.taskId);
    }),
    [
      ["ALPHA-FINISH"],
      ["BETA-ROOT", "BETA-FINISH"]
    ]
  );
  assert.deepEqual([alphaFinish.criticalPathSequenceCurrent, betaRoot.criticalPathSequenceCurrent, betaFinish.criticalPathSequenceCurrent], [1, 1, 2]);
});
