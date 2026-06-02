// Estimated dependency-based critical path helpers for the Smartsheet schedule
// analyzer. This module preserves the same row mutation fields and result
// shapes used by the main analyzer.

(() => {
  const {
    formatDateValue,
    normalizeCellValue,
    getHolidayDateSet,
    calculateCalendarDaysBetween,
    calculateWorkdaysMoved
  } = window.ScheduleDateUtils || {};

  function normalizeControlKeyword(value) {
    return normalizeCellValue(value).toLowerCase();
  }

  function isExcludedCriticalPathRowType(rowType) {
    const excludedRowTypes = new Set([
      "reporting",
      "spend",
      "budget",
      "administrative",
      "admin",
      "placeholder",
      "summary"
    ]);

    return excludedRowTypes.has(normalizeControlKeyword(rowType));
  }

  function isProjectGroupingMapped(mappingValues) {
    return Boolean(mappingValues.projectNameRaw);
  }

  function hasUsableCriticalPathDates(row) {
    return (
      row.parsedDates.baselineStart.isValid &&
      row.parsedDates.baselineFinish.isValid &&
      row.parsedDates.currentStart.isValid &&
      row.parsedDates.currentFinish.isValid
    );
  }

  function getCriticalPathExclusionReason(row) {
    if (!row.validForMovement || !hasUsableCriticalPathDates(row)) {
      return row.dateWarnings.length > 0 ? "Invalid or missing schedule dates" : "Warning/non-calculable row";
    }

    if (row.hasChildRows) {
      return "Parent/summary row based on hierarchy";
    }

    if (row.classification === "likely-summary" || row.excludeFromFutureCriticalPath) {
      return "Likely parent/summary row based on fallback heuristic";
    }

    // Optional user mappings refine only estimated critical path eligibility.
    // An explicit include preference never overrides invalid dates or detected
    // parent/summary rows.
    if (row.includeInCriticalPathOverride === false) {
      return "Excluded by Include in Critical Path mapping";
    }

    if (isExcludedCriticalPathRowType(row.rowType)) {
      return "Excluded by Row Type mapping";
    }

    return "Eligible";
  }

  function updateCriticalPathEligibility(rows) {
    rows.forEach((row) => {
      const exclusionReason = getCriticalPathExclusionReason(row);

      row.criticalPathExclusionReason = exclusionReason;
      row.criticalPathEligible = exclusionReason === "Eligible";
    });
  }

  function isEligibleForCriticalPath(row) {
    return row.criticalPathEligible === true;
  }

  function getCriticalPathDate(row, dateKey) {
    return row.parsedDates[dateKey].date;
  }

  function getCriticalPathDurationDays(row, datePrefix) {
    const startDate = getCriticalPathDate(row, `${datePrefix}Start`);
    const finishDate = getCriticalPathDate(row, `${datePrefix}Finish`);

    return Math.max(calculateCalendarDaysBetween(startDate, finishDate) + 1, 1);
  }

  function isSameProjectGroup(firstRow, secondRow) {
    return firstRow.projectName === secondRow.projectName;
  }

  function isSupportedCriticalPathRelationship(relationshipType) {
    return new Set(["FS", "SS", "FF", "SF"]).has(relationshipType);
  }

  function getEligibleDependencyLinks(row, eligibleRows) {
    return row.resolvedPredecessors.filter((link) => {
      return (
        link.resolved &&
        link.predecessorRow &&
        eligibleRows.has(row) &&
        eligibleRows.has(link.predecessorRow) &&
        isSameProjectGroup(row, link.predecessorRow) &&
        isSupportedCriticalPathRelationship(link.relationshipType)
      );
    });
  }

  function buildCriticalPathIncomingLinks(rows, eligibleRows) {
    const incomingLinksByRow = new Map();

    rows.forEach((row) => {
      if (eligibleRows.has(row)) {
        incomingLinksByRow.set(row, getEligibleDependencyLinks(row, eligibleRows));
      }
    });

    return incomingLinksByRow;
  }

  function getCriticalPathInputWarnings(rows, eligibleRows) {
    const warnings = [];
    const allLinks = rows.flatMap((row) => row.resolvedPredecessors);
    const unresolvedLinkCount = allLinks.filter((link) => !link.resolved).length;
    const crossProjectLinkCount = rows.flatMap((row) => {
      return row.resolvedPredecessors.filter((link) => {
        return (
          link.resolved &&
          link.predecessorRow &&
          row.criticalPathEligible &&
          link.predecessorRow.criticalPathEligible &&
          !isSameProjectGroup(row, link.predecessorRow)
        );
      });
    }).length;
    const ineligibleLinkCount = rows.flatMap((row) => {
      return row.resolvedPredecessors.filter((link) => {
        return (
          link.resolved &&
          link.predecessorRow &&
          isSameProjectGroup(row, link.predecessorRow) &&
          (!eligibleRows.has(row) || !eligibleRows.has(link.predecessorRow))
        );
      });
    }).length;

    if (unresolvedLinkCount > 0) {
      warnings.push(`${unresolvedLinkCount} unresolved predecessor link(s) were omitted from the estimate.`);
    }

    if (crossProjectLinkCount > 0) {
      warnings.push(`${crossProjectLinkCount} cross-project predecessor link(s) omitted from estimated critical path.`);
    }

    if (ineligibleLinkCount > 0) {
      warnings.push(`${ineligibleLinkCount} resolved predecessor link(s) involved ineligible rows and were omitted.`);
    }

    return warnings;
  }

  function getOneRowCriticalPathWarnings(baselinePathRows, currentPathRows) {
    if (baselinePathRows.length === 1 || currentPathRows.length === 1) {
      return [
        "Estimated critical path contains only one eligible row. This may indicate incomplete dependency data, missing hierarchy information, or overly broad summary-row classification."
      ];
    }

    return [];
  }

  function getUniqueWarnings(warnings) {
    return Array.from(new Set(warnings));
  }

  function getLatestFinishRows(rows, datePrefix) {
    const finishKey = `${datePrefix}Finish`;
    let latestTime = null;

    rows.forEach((row) => {
      const finishTime = getCriticalPathDate(row, finishKey).getTime();

      if (latestTime === null || finishTime > latestTime) {
        latestTime = finishTime;
      }
    });

    return rows.filter((row) => {
      return latestTime !== null && getCriticalPathDate(row, finishKey).getTime() === latestTime;
    });
  }

  function getCriticalPathRowLabel(row) {
    return row.taskName || row.taskId || `source row ${row.sourceDataRowNumber}`;
  }

  function calculateEstimatedPath(eligibleRowsList, incomingLinksByRow, datePrefix) {
    const memo = new Map();
    const visitState = new Map();
    const warnings = [];
    const cycleWarnings = new Set();

    function calculateBestPathTo(row) {
      const rowState = visitState.get(row);

      if (rowState === "visiting") {
        const warningText = `Circular dependency detected near ${getCriticalPathRowLabel(row)}. Cyclic links were skipped for the estimated critical path.`;

        if (!cycleWarnings.has(warningText)) {
          cycleWarnings.add(warningText);
          warnings.push(warningText);
        }

        return null;
      }

      if (rowState === "done") {
        return memo.get(row);
      }

      visitState.set(row, "visiting");

      const rowDuration = getCriticalPathDurationDays(row, datePrefix);
      let bestResult = {
        score: rowDuration,
        path: [row]
      };

      (incomingLinksByRow.get(row) || []).forEach((link) => {
        const predecessorResult = calculateBestPathTo(link.predecessorRow);

        if (!predecessorResult) {
          return;
        }

        // This is an estimated dependency-based path, not a full CPM engine.
        // FS, SS, FF, and SF links are treated as ordering links for longest-chain
        // scoring; lag days adjust the chain score, while actual mapped dates still
        // determine the latest finish target.
        const candidateScore = predecessorResult.score + link.lagDays + rowDuration;

        if (candidateScore > bestResult.score) {
          bestResult = {
            score: candidateScore,
            path: [...predecessorResult.path, row]
          };
        }
      });

      visitState.set(row, "done");
      memo.set(row, bestResult);

      return bestResult;
    }

    eligibleRowsList.forEach((row) => {
      calculateBestPathTo(row);
    });

    const latestFinishRows = getLatestFinishRows(eligibleRowsList, datePrefix);
    let bestPathResult = null;

    latestFinishRows.forEach((row) => {
      const pathResult = memo.get(row) || calculateBestPathTo(row);

      if (pathResult && (!bestPathResult || pathResult.score > bestPathResult.score)) {
        bestPathResult = pathResult;
      }
    });

    return {
      path: bestPathResult ? bestPathResult.path : [],
      warnings
    };
  }

  function clearCriticalPathProperties(rows) {
    rows.forEach((row) => {
      row.isOnBaselineCriticalPath = false;
      row.isOnCurrentCriticalPath = false;
      row.criticalPathSequenceBaseline = "";
      row.criticalPathSequenceCurrent = "";
      row.criticalPathStatus = "Not Critical";
      row.criticalPathEligible = false;
      row.criticalPathExclusionReason = "Not evaluated";
    });
  }

  function applyCriticalPathSequences(pathRows, pathType) {
    const isBaseline = pathType === "baseline";

    pathRows.forEach((row, index) => {
      if (isBaseline) {
        row.isOnBaselineCriticalPath = true;
        row.criticalPathSequenceBaseline = index + 1;
      } else {
        row.isOnCurrentCriticalPath = true;
        row.criticalPathSequenceCurrent = index + 1;
      }
    });
  }

  function updateCriticalPathStatuses(rows) {
    rows.forEach((row) => {
      if (row.isOnBaselineCriticalPath && row.isOnCurrentCriticalPath) {
        row.criticalPathStatus = "Both";
      } else if (row.isOnBaselineCriticalPath) {
        row.criticalPathStatus = "Baseline Only";
      } else if (row.isOnCurrentCriticalPath) {
        row.criticalPathStatus = "Current Only";
      } else {
        row.criticalPathStatus = "Not Critical";
      }
    });
  }

  function getCriticalPathProjectGroups(rows) {
    const groupsByName = new Map();

    rows.forEach((row) => {
      if (!groupsByName.has(row.projectName)) {
        groupsByName.set(row.projectName, []);
      }

      groupsByName.get(row.projectName).push(row);
    });

    return Array.from(groupsByName.entries()).map(([projectName, projectRows]) => {
      return {
        projectName,
        rows: projectRows
      };
    });
  }

  function getLatestCriticalPathFinishDate(pathRows, finishKey) {
    return pathRows.reduce((latestDate, row) => {
      const finishDate = getCriticalPathDate(row, finishKey);

      if (!latestDate || finishDate.getTime() > latestDate.getTime()) {
        return finishDate;
      }

      return latestDate;
    }, null);
  }

  function countRowsExcludedByReason(rows, reason) {
    return rows.filter((row) => row.criticalPathExclusionReason === reason).length;
  }

  function buildCriticalPathSummary(projectName, rows, baselinePathRows, currentPathRows, warnings, analyzerOptions) {
    const holidayDateSet = getHolidayDateSet(analyzerOptions);
    const eligibleRows = rows.filter((row) => isEligibleForCriticalPath(row));
    const excludedLikelySummaryRows = rows.filter((row) => {
      return row.classification === "likely-summary" || row.excludeFromFutureCriticalPath;
    }).length;
    const excludedByRowTypeMapping = countRowsExcludedByReason(rows, "Excluded by Row Type mapping");
    const excludedByIncludeMapping = countRowsExcludedByReason(
      rows,
      "Excluded by Include in Critical Path mapping"
    );
    const baselineFinishRow = baselinePathRows[baselinePathRows.length - 1] || null;
    const currentFinishRow = currentPathRows[currentPathRows.length - 1] || null;
    const baselineFinishDate = baselineFinishRow ? getCriticalPathDate(baselineFinishRow, "baselineFinish") : null;
    const currentFinishDate = currentFinishRow ? getCriticalPathDate(currentFinishRow, "currentFinish") : null;
    const finishShiftCalendarDays =
      baselineFinishDate && currentFinishDate ? calculateCalendarDaysBetween(baselineFinishDate, currentFinishDate) : "";
    const finishShiftWorkdays =
      baselineFinishDate && currentFinishDate
        ? calculateWorkdaysMoved(baselineFinishDate, currentFinishDate, holidayDateSet)
        : "";

    return {
      projectName,
      eligibleRowCount: eligibleRows.length,
      excludedLikelySummaryRows,
      excludedByRowTypeMapping,
      excludedByIncludeMapping,
      baselineCriticalPathTaskCount: baselinePathRows.length,
      currentCriticalPathTaskCount: currentPathRows.length,
      baselineEstimatedProjectFinish: baselineFinishDate ? formatDateValue(baselineFinishDate) : "Not calculated",
      currentEstimatedProjectFinish: currentFinishDate ? formatDateValue(currentFinishDate) : "Not calculated",
      finishShiftCalendarDays,
      finishShiftWorkdays,
      tasksOnBothPath: rows.filter((row) => row.isOnBaselineCriticalPath && row.isOnCurrentCriticalPath).length,
      tasksNewlyOnCurrentPath: rows.filter((row) => !row.isOnBaselineCriticalPath && row.isOnCurrentCriticalPath)
        .length,
      tasksNoLongerOnCurrentPath: rows.filter((row) => row.isOnBaselineCriticalPath && !row.isOnCurrentCriticalPath)
        .length,
      warnings
    };
  }

  function buildProjectCriticalPathResult(projectName, projectRows, analyzerOptions) {
    const eligibleRowsList = projectRows.filter((row) => isEligibleForCriticalPath(row));
    const eligibleRows = new Set(eligibleRowsList);
    const incomingLinksByRow = buildCriticalPathIncomingLinks(projectRows, eligibleRows);
    const inputWarnings = getCriticalPathInputWarnings(projectRows, eligibleRows);

    if (eligibleRowsList.length === 0) {
      return {
        projectName,
        rows: projectRows,
        baselinePathRows: [],
        currentPathRows: [],
        summary: buildCriticalPathSummary(
          projectName,
          projectRows,
          [],
          [],
          [...inputWarnings, "No eligible rows were available for critical path estimation."],
          analyzerOptions
        )
      };
    }

    const baselineResult = calculateEstimatedPath(eligibleRowsList, incomingLinksByRow, "baseline");
    const currentResult = calculateEstimatedPath(eligibleRowsList, incomingLinksByRow, "current");
    const warnings = getUniqueWarnings([
      ...inputWarnings,
      ...baselineResult.warnings,
      ...currentResult.warnings,
      ...getOneRowCriticalPathWarnings(baselineResult.path, currentResult.path)
    ]);

    applyCriticalPathSequences(baselineResult.path, "baseline");
    applyCriticalPathSequences(currentResult.path, "current");

    return {
      projectName,
      rows: projectRows,
      baselinePathRows: baselineResult.path,
      currentPathRows: currentResult.path,
      summary: buildCriticalPathSummary(
        projectName,
        projectRows,
        baselineResult.path,
        currentResult.path,
        warnings,
        analyzerOptions
      )
    };
  }

  function buildOverallCriticalPathSummary(rows, projectResults, mappingValues, analyzerOptions) {
    const holidayDateSet = getHolidayDateSet(analyzerOptions);
    const baselinePathRows = projectResults.flatMap((projectResult) => projectResult.baselinePathRows);
    const currentPathRows = projectResults.flatMap((projectResult) => projectResult.currentPathRows);
    const baselineFinishDate = getLatestCriticalPathFinishDate(baselinePathRows, "baselineFinish");
    const currentFinishDate = getLatestCriticalPathFinishDate(currentPathRows, "currentFinish");
    const canCalculateOverallFinishShift = projectResults.length <= 1;
    const finishShiftCalendarDays =
      canCalculateOverallFinishShift && baselineFinishDate && currentFinishDate
        ? calculateCalendarDaysBetween(baselineFinishDate, currentFinishDate)
        : "";
    const finishShiftWorkdays =
      canCalculateOverallFinishShift && baselineFinishDate && currentFinishDate
        ? calculateWorkdaysMoved(baselineFinishDate, currentFinishDate, holidayDateSet)
        : "";
    const eligibleRows = rows.filter((row) => isEligibleForCriticalPath(row));
    const excludedLikelySummaryRows = rows.filter((row) => {
      return row.classification === "likely-summary" || row.excludeFromFutureCriticalPath;
    }).length;
    const excludedByRowTypeMapping = countRowsExcludedByReason(rows, "Excluded by Row Type mapping");
    const excludedByIncludeMapping = countRowsExcludedByReason(
      rows,
      "Excluded by Include in Critical Path mapping"
    );
    const warnings = getUniqueWarnings(projectResults.flatMap((projectResult) => projectResult.summary.warnings));

    return {
      projectName: "All project groups",
      projectGroupingMapped: isProjectGroupingMapped(mappingValues),
      projectGroupCount: projectResults.length,
      eligibleRowCount: eligibleRows.length,
      excludedLikelySummaryRows,
      excludedByRowTypeMapping,
      excludedByIncludeMapping,
      baselineCriticalPathTaskCount: baselinePathRows.length,
      currentCriticalPathTaskCount: currentPathRows.length,
      baselineEstimatedProjectFinish: baselineFinishDate ? formatDateValue(baselineFinishDate) : "Not calculated",
      currentEstimatedProjectFinish: currentFinishDate ? formatDateValue(currentFinishDate) : "Not calculated",
      latestCurrentEstimatedProjectFinishAcrossProjectGroups: currentFinishDate
        ? formatDateValue(currentFinishDate)
        : "Not calculated",
      finishShiftCalendarDays,
      finishShiftWorkdays,
      tasksOnBothPath: rows.filter((row) => row.isOnBaselineCriticalPath && row.isOnCurrentCriticalPath).length,
      tasksNewlyOnCurrentPath: rows.filter((row) => !row.isOnBaselineCriticalPath && row.isOnCurrentCriticalPath)
        .length,
      tasksNoLongerOnCurrentPath: rows.filter((row) => row.isOnBaselineCriticalPath && !row.isOnCurrentCriticalPath)
        .length,
      warnings
    };
  }

  function addCriticalPathAnalysis(rows, mappingValues, analyzerOptions) {
    clearCriticalPathProperties(rows);
    updateCriticalPathEligibility(rows);

    // When a project grouping column is mapped, each group gets its own graph so
    // row-number predecessor links cannot accidentally chain separate projects.
    const projectResults = getCriticalPathProjectGroups(rows).map((projectGroup) => {
      return buildProjectCriticalPathResult(projectGroup.projectName, projectGroup.rows, analyzerOptions);
    });

    updateCriticalPathStatuses(rows);

    return {
      baselinePathRows: projectResults.flatMap((projectResult) => projectResult.baselinePathRows),
      currentPathRows: projectResults.flatMap((projectResult) => projectResult.currentPathRows),
      projectResults,
      projectSummaries: projectResults.map((projectResult) => projectResult.summary),
      summary: buildOverallCriticalPathSummary(rows, projectResults, mappingValues, analyzerOptions)
    };
  }

  window.ScheduleCriticalPath = {
    hasUsableCriticalPathDates,
    getCriticalPathExclusionReason,
    updateCriticalPathEligibility,
    isEligibleForCriticalPath,
    getCriticalPathDate,
    getCriticalPathDurationDays,
    isSameProjectGroup,
    isSupportedCriticalPathRelationship,
    getEligibleDependencyLinks,
    buildCriticalPathIncomingLinks,
    getCriticalPathInputWarnings,
    getOneRowCriticalPathWarnings,
    getUniqueWarnings,
    getLatestFinishRows,
    getCriticalPathRowLabel,
    calculateEstimatedPath,
    clearCriticalPathProperties,
    applyCriticalPathSequences,
    updateCriticalPathStatuses,
    getCriticalPathProjectGroups,
    getLatestCriticalPathFinishDate,
    countRowsExcludedByReason,
    buildCriticalPathSummary,
    buildProjectCriticalPathResult,
    buildOverallCriticalPathSummary,
    addCriticalPathAnalysis
  };
})();
