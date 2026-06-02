// Predecessor parsing and dependency validation helpers for the Smartsheet
// schedule analyzer. These helpers intentionally preserve the row mutation and
// resolved-link object shape used by the main analyzer.

(() => {
  function splitPredecessorTokens(predecessorValue) {
    return predecessorValue
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token !== "");
  }

  function parsePredecessorToken(token) {
    let workingText = token.trim();
    let relationshipType = "FS";
    let lagDays = 0;
    let isMalformed = false;
    let issueMessage = "";

    const lagMatch = workingText.match(/([+-])\s*(\d+)\s*(?:d|day|days)?\s*$/i);

    if (lagMatch) {
      const lagSign = lagMatch[1] === "-" ? -1 : 1;
      lagDays = lagSign * Number(lagMatch[2]);
      workingText = workingText.slice(0, lagMatch.index).trim();
    }

    const relationshipMatch = workingText.match(/(FS|SS|FF|SF)\s*$/i);

    if (relationshipMatch) {
      relationshipType = relationshipMatch[1].toUpperCase();
      workingText = workingText.slice(0, relationshipMatch.index).trim();
    } else {
      const unsupportedRelationshipMatch = workingText.match(/^(\d+)\s*([A-Za-z]{2})$/);

      if (unsupportedRelationshipMatch) {
        workingText = unsupportedRelationshipMatch[1];
        relationshipType = unsupportedRelationshipMatch[2].toUpperCase();
        isMalformed = true;
        issueMessage = `Unsupported predecessor relationship type: ${relationshipType}.`;
      }
    }

    if (workingText === "") {
      isMalformed = true;
      issueMessage = issueMessage || "Malformed predecessor token.";
    }

    return {
      originalText: token,
      referenceText: workingText,
      relationshipType,
      lagDays,
      isMalformed,
      issueMessage
    };
  }

  function parsePredecessorValue(predecessorValue) {
    if (predecessorValue === "") {
      return [];
    }

    return splitPredecessorTokens(predecessorValue).map((token) => parsePredecessorToken(token));
  }

  function buildPredecessorResolutionIndex(rows) {
    const sourceDataRowByNumber = new Map();
    const excelRowByNumber = new Map();
    const rowByTaskId = new Map();

    rows.forEach((row) => {
      sourceDataRowByNumber.set(String(row.sourceDataRowNumber), row);

      if (row.excelRowNumber !== "") {
        excelRowByNumber.set(String(row.excelRowNumber), row);
      }

      if (row.taskId !== "" && !rowByTaskId.has(row.taskId)) {
        rowByTaskId.set(row.taskId, row);
      }
    });

    return {
      sourceDataRowByNumber,
      excelRowByNumber,
      rowByTaskId
    };
  }

  function isNumericPredecessorReference(referenceText) {
    return /^\d+$/.test(referenceText);
  }

  function findPredecessorRow(parsedPredecessor, resolutionIndex) {
    const referenceText = parsedPredecessor.referenceText;

    // Smartsheet predecessor numbers commonly refer to visible row positions,
    // not a mapped Milestone ID. Treat the 1-based source data row number as
    // the primary numeric match, then fall back to Excel row number and Task ID.
    if (isNumericPredecessorReference(referenceText)) {
      return (
        resolutionIndex.sourceDataRowByNumber.get(referenceText) ||
        resolutionIndex.excelRowByNumber.get(referenceText) ||
        resolutionIndex.rowByTaskId.get(referenceText) ||
        null
      );
    }

    return resolutionIndex.rowByTaskId.get(referenceText) || null;
  }

  function buildResolvedPredecessorLink(row, parsedPredecessor, resolutionIndex) {
    const issueMessages = [];
    let predecessorRow = null;
    let resolved = false;

    if (parsedPredecessor.isMalformed) {
      issueMessages.push(parsedPredecessor.issueMessage);
    } else {
      predecessorRow = findPredecessorRow(parsedPredecessor, resolutionIndex);
      resolved = predecessorRow !== null;

      if (!resolved) {
        issueMessages.push("Predecessor reference could not be resolved.");
      }
    }

    if (predecessorRow) {
      if (predecessorRow === row) {
        issueMessages.push("Predecessor points to itself.");
      }

      if (predecessorRow.classification === "likely-summary") {
        issueMessages.push("Predecessor points to a likely parent/summary row.");
      }

      if (!predecessorRow.validForMovement) {
        issueMessages.push("Predecessor points to a row with invalid or missing dates.");
      }
    }

    return {
      predecessorValue: row.predecessors,
      parsedReference: parsedPredecessor.referenceText || parsedPredecessor.originalText,
      originalText: parsedPredecessor.originalText,
      relationshipType: parsedPredecessor.relationshipType,
      lagDays: parsedPredecessor.lagDays,
      resolved,
      predecessorTaskId: predecessorRow ? predecessorRow.taskId : "",
      predecessorTaskName: predecessorRow ? predecessorRow.taskName : "",
      predecessorRowClassification: predecessorRow ? predecessorRow.classification : "",
      predecessorRow,
      issueMessages,
      issueMessage: issueMessages.join(" ")
    };
  }

  function addDependencyAnalysis(rows) {
    const resolutionIndex = buildPredecessorResolutionIndex(rows);

    rows.forEach((row) => {
      row.parsedPredecessors = parsePredecessorValue(row.predecessors);
      row.resolvedPredecessors = row.parsedPredecessors.map((parsedPredecessor) => {
        return buildResolvedPredecessorLink(row, parsedPredecessor, resolutionIndex);
      });
      row.dependencyWarnings = row.resolvedPredecessors
        .filter((link) => link.issueMessages.length > 0)
        .map((link) => link.issueMessage);
    });

    return rows;
  }

  function getDependencyIssueLinks(rows) {
    return rows.flatMap((row) => {
      return row.resolvedPredecessors
        .filter((link) => link.issueMessages.length > 0 || !link.resolved)
        .map((link) => {
          return {
            row,
            link
          };
        });
    });
  }

  function buildDependencySummary(rows) {
    const predecessorLinks = rows.flatMap((row) => row.resolvedPredecessors);

    return {
      rowsWithPredecessorValues: rows.filter((row) => row.predecessors !== "").length,
      totalPredecessorReferences: predecessorLinks.length,
      resolvedPredecessorLinks: predecessorLinks.filter((link) => link.resolved).length,
      unresolvedPredecessorLinks: predecessorLinks.filter((link) => !link.resolved).length,
      summaryPredecessorLinks: predecessorLinks.filter((link) => {
        return link.resolved && link.predecessorRowClassification === "likely-summary";
      }).length,
      rowsWithDependencyWarnings: rows.filter((row) => row.dependencyWarnings.length > 0).length
    };
  }

  window.ScheduleDependencies = {
    splitPredecessorTokens,
    parsePredecessorToken,
    parsePredecessorValue,
    buildPredecessorResolutionIndex,
    isNumericPredecessorReference,
    findPredecessorRow,
    buildResolvedPredecessorLink,
    addDependencyAnalysis,
    getDependencyIssueLinks,
    buildDependencySummary
  };
})();
