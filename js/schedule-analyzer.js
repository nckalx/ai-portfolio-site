// Phase 3 implementation for the uploaded Smartsheet .xlsx schedule analyzer.
//
// Later phases can add:
// - predecessor parsing and dependency/data-quality warnings,
// - estimated critical path logic.
//
// This file intentionally does not call the Smartsheet API. It parses exported
// workbooks in the browser, validates only mapped columns, and ignores unrelated
// workbook columns.

(() => {
  const scheduleMappings = [
    { key: "taskId", id: "scheduleTaskIdColumn", label: "Task ID / Row ID column", required: false },
    { key: "taskName", id: "scheduleTaskNameColumn", label: "Task or Milestone Name column", required: true },
    { key: "baselineStart", id: "scheduleBaselineStartColumn", label: "Baseline Start column", required: true },
    { key: "baselineFinish", id: "scheduleBaselineFinishColumn", label: "Baseline Finish column", required: true },
    { key: "currentStart", id: "scheduleCurrentStartColumn", label: "Actual / Current Start column", required: true },
    { key: "currentFinish", id: "scheduleCurrentFinishColumn", label: "Actual / Current Finish column", required: true },
    { key: "predecessors", id: "schedulePredecessorsColumn", label: "Predecessors column", required: true },
    { key: "status", id: "scheduleStatusColumn", label: "Status / % Complete column", required: false }
  ];

  const previewColumns = [
    { key: "taskId", label: "Task ID" },
    { key: "taskName", label: "Task / Milestone" },
    { key: "baselineStart", label: "Baseline Start" },
    { key: "baselineFinish", label: "Baseline Finish" },
    { key: "currentStart", label: "Current Start" },
    { key: "currentFinish", label: "Current Finish" },
    { key: "predecessors", label: "Predecessors" },
    { key: "status", label: "Status / % Complete" }
  ];

  const dateColumns = [
    { key: "baselineStart", label: "baseline start" },
    { key: "baselineFinish", label: "baseline finish" },
    { key: "currentStart", label: "current start" },
    { key: "currentFinish", label: "current finish" }
  ];

  const movementDetailColumns = [
    { key: "taskId", label: "Task ID" },
    { key: "taskName", label: "Task / Milestone" },
    { key: "classification", label: "Row Classification" },
    { key: "baselineStart", label: "Baseline Start" },
    { key: "currentStart", label: "Current Start" },
    { key: "startWorkdayMovement", label: "Start Workday Movement" },
    { key: "baselineFinish", label: "Baseline Finish" },
    { key: "currentFinish", label: "Current Finish" },
    { key: "finishWorkdayMovement", label: "Finish Workday Movement" },
    { key: "movementDirection", label: "Movement Status" },
    { key: "warnings", label: "Warnings" }
  ];

  const reportSheetNames = {
    executiveSummary: "Executive Summary",
    changedItems: "Changed Schedule Items",
    allItems: "All Schedule Items",
    warnings: "Warnings - Data Quality",
    columnMapping: "Column Mapping Used"
  };

  const scheduleReportHeaders = [
    "Task ID",
    "Task / Milestone",
    "Row Classification",
    "Baseline Start",
    "Current Start",
    "Start Calendar Movement",
    "Start Workday Movement",
    "Baseline Finish",
    "Current Finish",
    "Finish Calendar Movement",
    "Finish Workday Movement",
    "Movement Status",
    "Predecessors",
    "Status / % Complete",
    "Warnings",
    "Excluded From Future Critical Path"
  ];

  const warningReportHeaders = [
    "Task ID",
    "Task / Milestone",
    "Row Classification",
    "Baseline Start",
    "Baseline Finish",
    "Current Start",
    "Current Finish",
    "Movement Status",
    "Warnings",
    "Excluded From Movement Calculations",
    "Excluded From Future Critical Path"
  ];

  let normalizedScheduleRows = [];
  let latestAnalysisResult = null;

  function getScheduleAnalyzerElement(id) {
    return document.getElementById(id);
  }

  function setScheduleAnalyzerStatus(message, statusType) {
    const statusMessage = getScheduleAnalyzerElement("scheduleAnalyzerStatus");

    if (!statusMessage) {
      return;
    }

    statusMessage.classList.remove("is-error", "is-ready", "is-info");
    statusMessage.classList.add(statusType);
    statusMessage.textContent = message;
  }

  function setReportDownloadReady(isReady) {
    const downloadButton = getScheduleAnalyzerElement("downloadScheduleReportButton");

    if (downloadButton) {
      downloadButton.disabled = !isReady;
    }
  }

  function clearSchedulePreview() {
    const previewPanel = getScheduleAnalyzerElement("scheduleAnalyzerPreview");
    const resultsPanel = getScheduleAnalyzerElement("schedulePhase3Results");
    const summaryList = getScheduleAnalyzerElement("scheduleWorkbookSummary");
    const mappedColumnsList = getScheduleAnalyzerElement("scheduleMappedColumns");
    const previewHeader = getScheduleAnalyzerElement("schedulePreviewHeader");
    const previewBody = getScheduleAnalyzerElement("schedulePreviewBody");
    const movementSummary = getScheduleAnalyzerElement("scheduleMovementSummary");
    const movementDetailHeader = getScheduleAnalyzerElement("scheduleMovementDetailHeader");
    const movementDetailBody = getScheduleAnalyzerElement("scheduleMovementDetailBody");

    latestAnalysisResult = null;
    setReportDownloadReady(false);

    if (previewPanel) {
      previewPanel.hidden = true;
    }

    if (resultsPanel) {
      resultsPanel.hidden = true;
    }

    [
      summaryList,
      mappedColumnsList,
      previewHeader,
      previewBody,
      movementSummary,
      movementDetailHeader,
      movementDetailBody
    ].forEach((element) => {
      if (element) {
        element.replaceChildren();
      }
    });
  }

  function formatDateValue(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
  }

  function normalizeCellValue(value) {
    if (value === null || value === undefined) {
      return "";
    }

    if (value instanceof Date) {
      return formatDateValue(value);
    }

    return String(value).trim();
  }

  function getDateOnly(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function isValidDateObject(value) {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }

  function createDateFromParts(year, month, day) {
    const date = new Date(year, month - 1, day);

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }

    return date;
  }

  function normalizeTwoDigitYear(year) {
    if (year >= 100) {
      return year;
    }

    return year < 50 ? 2000 + year : 1900 + year;
  }

  function parseExcelSerialDate(value) {
    const serialDate = Number(value);

    if (!Number.isFinite(serialDate) || serialDate < 20000 || serialDate > 60000) {
      return null;
    }

    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch);
    date.setDate(excelEpoch.getDate() + Math.floor(serialDate));

    return getDateOnly(date);
  }

  function parseDateString(value) {
    const trimmedValue = value.trim();
    const numericDateMatch = trimmedValue.match(/^\d+(\.\d+)?$/);

    if (numericDateMatch) {
      if (/^(19|20)\d{6}$/.test(trimmedValue)) {
        const year = Number(trimmedValue.slice(0, 4));
        const month = Number(trimmedValue.slice(4, 6));
        const day = Number(trimmedValue.slice(6, 8));
        return createDateFromParts(year, month, day);
      }

      return parseExcelSerialDate(trimmedValue);
    }

    const yearFirstMatch = trimmedValue.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);

    if (yearFirstMatch) {
      const year = Number(yearFirstMatch[1]);
      const month = Number(yearFirstMatch[2]);
      const day = Number(yearFirstMatch[3]);
      return createDateFromParts(year, month, day);
    }

    const monthFirstMatch = trimmedValue.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s+.*)?$/);

    if (monthFirstMatch) {
      const month = Number(monthFirstMatch[1]);
      const day = Number(monthFirstMatch[2]);
      const year = normalizeTwoDigitYear(Number(monthFirstMatch[3]));
      return createDateFromParts(year, month, day);
    }

    const fallbackDate = new Date(trimmedValue);

    if (isValidDateObject(fallbackDate)) {
      return getDateOnly(fallbackDate);
    }

    return null;
  }

  function parseMappedScheduleDate(value) {
    const displayValue = normalizeCellValue(value);

    if (displayValue === "") {
      return {
        date: null,
        displayValue,
        isMissing: true,
        isValid: false
      };
    }

    if (isValidDateObject(value)) {
      return {
        date: getDateOnly(value),
        displayValue,
        isMissing: false,
        isValid: true
      };
    }

    if (typeof value === "number") {
      const excelDate = parseExcelSerialDate(value);

      return {
        date: excelDate,
        displayValue,
        isMissing: false,
        isValid: excelDate !== null
      };
    }

    const parsedDate = parseDateString(displayValue);

    return {
      date: parsedDate,
      displayValue,
      isMissing: false,
      isValid: parsedDate !== null
    };
  }

  function getUtcDayValue(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function calculateCalendarDaysBetween(startDate, endDate) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.round((getUtcDayValue(endDate) - getUtcDayValue(startDate)) / millisecondsPerDay);
  }

  function isWeekday(date) {
    const dayOfWeek = date.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  }

  function countWeekdaysInclusive(startDate, endDate) {
    const currentDate = new Date(startDate);
    let weekdayCount = 0;

    while (currentDate <= endDate) {
      if (isWeekday(currentDate)) {
        weekdayCount += 1;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return weekdayCount;
  }

  function calculateWorkdaysMoved(baselineDate, currentDate) {
    if (currentDate.getTime() === baselineDate.getTime()) {
      return 0;
    }

    if (currentDate > baselineDate) {
      return countWeekdaysInclusive(baselineDate, currentDate) - 1;
    }

    return -(countWeekdaysInclusive(currentDate, baselineDate) - 1);
  }

  function getMovementSign(calendarMovement, workdayMovement) {
    const movementValue = calendarMovement !== 0 ? calendarMovement : workdayMovement;

    if (movementValue > 0) {
      return 1;
    }

    if (movementValue < 0) {
      return -1;
    }

    return 0;
  }

  function hasAnyScheduleMovement(movementValues) {
    return (
      movementValues.startCalendarMovement !== 0 ||
      movementValues.startWorkdayMovement !== 0 ||
      movementValues.finishCalendarMovement !== 0 ||
      movementValues.finishWorkdayMovement !== 0
    );
  }

  function getMovementDirection(movementValues) {
    const startSign = getMovementSign(movementValues.startCalendarMovement, movementValues.startWorkdayMovement);
    const finishSign = getMovementSign(movementValues.finishCalendarMovement, movementValues.finishWorkdayMovement);

    if (startSign !== 0 && finishSign !== 0 && startSign !== finishSign) {
      return "Mixed Movement";
    }

    if (finishSign > 0) {
      return "Delayed";
    }

    if (finishSign < 0) {
      return "Accelerated";
    }

    if (startSign > 0) {
      return "Start Delayed / Finish Unchanged";
    }

    if (startSign < 0) {
      return "Start Accelerated / Finish Unchanged";
    }

    return "Unchanged";
  }

  function isBlankRow(row) {
    return !row || row.every((cell) => normalizeCellValue(cell) === "");
  }

  function getMappingValues() {
    const values = {};

    scheduleMappings.forEach((mapping) => {
      const input = getScheduleAnalyzerElement(mapping.id);
      values[mapping.key] = input ? input.value.trim() : "";
    });

    return values;
  }

  function getMissingRequiredScheduleMappings() {
    const mappingValues = getMappingValues();

    return scheduleMappings.filter((mapping) => {
      return mapping.required && mappingValues[mapping.key] === "";
    });
  }

  function getSelectedScheduleFile() {
    const fileInput = getScheduleAnalyzerElement("scheduleAnalyzerFile");

    if (!fileInput || fileInput.files.length === 0) {
      return null;
    }

    return fileInput.files[0];
  }

  function isXlsxFile(file) {
    return file.name.toLowerCase().endsWith(".xlsx");
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(reader.error);
      };

      reader.readAsArrayBuffer(file);
    });
  }

  function getFirstWorksheet(workbook) {
    const worksheetName = workbook.SheetNames[0];

    if (!worksheetName) {
      return null;
    }

    return {
      name: worksheetName,
      worksheet: workbook.Sheets[worksheetName]
    };
  }

  function getWorksheetRows(worksheet) {
    const rawRows = window.XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: false
    });

    return rawRows.filter((row) => !isBlankRow(row));
  }

  function findHeaderRowIndex(rows) {
    return rows.findIndex((row) => !isBlankRow(row));
  }

  function getHeaderNames(headerRow) {
    return headerRow.map((cell) => normalizeCellValue(cell));
  }

  function getHeaderIndexByName(headerNames) {
    const headerIndexByName = new Map();

    headerNames.forEach((headerName, index) => {
      if (headerName !== "" && !headerIndexByName.has(headerName)) {
        headerIndexByName.set(headerName, index);
      }
    });

    return headerIndexByName;
  }

  function getMappedColumns(mappingValues) {
    return scheduleMappings.filter((mapping) => mappingValues[mapping.key] !== "");
  }

  function getMissingMappedColumnNames(mappedColumns, headerIndexByName, mappingValues) {
    return mappedColumns
      .filter((mapping) => !headerIndexByName.has(mappingValues[mapping.key]))
      .map((mapping) => mappingValues[mapping.key]);
  }

  function buildNormalizedRows(dataRows, mappedColumns, headerIndexByName, mappingValues) {
    return dataRows
      .map((row) => {
        const normalizedRow = {
          taskId: "",
          taskName: "",
          baselineStart: "",
          baselineFinish: "",
          currentStart: "",
          currentFinish: "",
          predecessors: "",
          status: ""
        };

        mappedColumns.forEach((mapping) => {
          const columnIndex = headerIndexByName.get(mappingValues[mapping.key]);
          normalizedRow[mapping.key] = normalizeCellValue(row[columnIndex]);
        });

        return normalizedRow;
      })
      .filter((row) => {
        return Object.values(row).some((value) => value !== "");
      });
  }

  function hasAnyMappedDateValue(row) {
    return dateColumns.some((column) => row[column.key] !== "");
  }

  function getParsedRowDates(row) {
    const parsedDates = {};

    dateColumns.forEach((column) => {
      parsedDates[column.key] = parseMappedScheduleDate(row[column.key]);
    });

    return parsedDates;
  }

  function getDateWarnings(parsedDates) {
    const warnings = [];

    dateColumns.forEach((column) => {
      const parsedDate = parsedDates[column.key];

      if (parsedDate.isMissing) {
        warnings.push(`Missing ${column.label}.`);
      } else if (!parsedDate.isValid) {
        warnings.push(`Invalid ${column.label}: ${parsedDate.displayValue}.`);
      }
    });

    if (
      parsedDates.baselineStart.isValid &&
      parsedDates.baselineFinish.isValid &&
      parsedDates.baselineFinish.date < parsedDates.baselineStart.date
    ) {
      warnings.push("Baseline finish is earlier than baseline start.");
    }

    if (
      parsedDates.currentStart.isValid &&
      parsedDates.currentFinish.isValid &&
      parsedDates.currentFinish.date < parsedDates.currentStart.date
    ) {
      warnings.push("Current finish is earlier than current start.");
    }

    return warnings;
  }

  function hasLongDateSpan(parsedDates) {
    const minimumSummarySpanDays = 20;
    const baselineSpan =
      parsedDates.baselineStart.isValid && parsedDates.baselineFinish.isValid
        ? calculateCalendarDaysBetween(parsedDates.baselineStart.date, parsedDates.baselineFinish.date)
        : 0;
    const currentSpan =
      parsedDates.currentStart.isValid && parsedDates.currentFinish.isValid
        ? calculateCalendarDaysBetween(parsedDates.currentStart.date, parsedDates.currentFinish.date)
        : 0;

    return baselineSpan >= minimumSummarySpanDays || currentSpan >= minimumSummarySpanDays;
  }

  function hasSummaryLikeText(row) {
    const combinedText = `${row.taskName} ${row.status}`.toLowerCase();

    return (
      /\b(summary|rollup|parent|subtotal|total|overall|program|workstream)\b/.test(combinedText) ||
      /\b(phase|stage|section|area|package)\s+\d*[a-z]?\b/.test(combinedText) ||
      /\b(project|schedule)\s+(summary|total|rollup)\b/.test(combinedText)
    );
  }

  function getLikelySummarySignals(row, parsedDates, mappingValues) {
    const signals = {
      hasDateValues: hasAnyMappedDateValue(row),
      hasBlankMappedTaskId: mappingValues.taskId !== "" && row.taskId === "",
      hasBlankPredecessors: row.predecessors === "",
      hasBlankMappedStatus: mappingValues.status !== "" && row.status === "",
      hasLongDateSpan: hasLongDateSpan(parsedDates),
      hasSummaryLikeText: hasSummaryLikeText(row)
    };

    return signals;
  }

  function isLikelySummaryRow(signals) {
    if (!signals.hasDateValues) {
      return false;
    }

    return (
      (signals.hasSummaryLikeText &&
        (signals.hasBlankPredecessors || signals.hasBlankMappedTaskId || signals.hasBlankMappedStatus)) ||
      (signals.hasBlankMappedTaskId &&
        signals.hasBlankPredecessors &&
        (signals.hasLongDateSpan || signals.hasBlankMappedStatus)) ||
      (signals.hasBlankPredecessors && signals.hasLongDateSpan && signals.hasBlankMappedStatus)
    );
  }

  function classifyScheduleRow(row, parsedDates, dateWarnings, mappingValues) {
    const summarySignals = getLikelySummarySignals(row, parsedDates, mappingValues);

    // Smartsheet exports in this mapped-column flow do not provide hierarchy metadata.
    // This is a conservative estimate; a future version may support an explicit
    // hierarchy, row-type, or parent/child mapping from the workbook.
    if (isLikelySummaryRow(summarySignals)) {
      return "likely-summary";
    }

    if (dateWarnings.length > 0) {
      return "warning";
    }

    return "detail";
  }

  function buildMovementValues(parsedDates) {
    const startCalendarMovement = calculateCalendarDaysBetween(
      parsedDates.baselineStart.date,
      parsedDates.currentStart.date
    );
    const finishCalendarMovement = calculateCalendarDaysBetween(
      parsedDates.baselineFinish.date,
      parsedDates.currentFinish.date
    );
    const startWorkdayMovement = calculateWorkdaysMoved(parsedDates.baselineStart.date, parsedDates.currentStart.date);
    const finishWorkdayMovement = calculateWorkdaysMoved(
      parsedDates.baselineFinish.date,
      parsedDates.currentFinish.date
    );
    const movementValues = {
      startCalendarMovement,
      finishCalendarMovement,
      startWorkdayMovement,
      finishWorkdayMovement
    };

    return {
      ...movementValues,
      hasScheduleMovement: hasAnyScheduleMovement(movementValues),
      movementDirection: getMovementDirection(movementValues)
    };
  }

  function analyzeNormalizedRow(row, mappingValues) {
    const parsedDates = getParsedRowDates(row);
    const dateWarnings = getDateWarnings(parsedDates);
    const validForMovement = dateWarnings.length === 0;
    const classification = classifyScheduleRow(row, parsedDates, dateWarnings, mappingValues);
    const movementValues = validForMovement
      ? buildMovementValues(parsedDates)
      : {
          startCalendarMovement: null,
          finishCalendarMovement: null,
          startWorkdayMovement: null,
          finishWorkdayMovement: null,
          hasScheduleMovement: false,
          movementDirection: "Not calculated"
        };

    return {
      ...row,
      classification,
      dateWarnings,
      excludeFromFutureCriticalPath: classification === "likely-summary",
      parsedDates,
      validForMovement,
      ...movementValues
    };
  }

  function analyzeNormalizedRows(rows, mappingValues) {
    return rows.map((row) => analyzeNormalizedRow(row, mappingValues));
  }

  function getLargestFinishDelay(rows) {
    return rows
      .filter((row) => row.validForMovement && row.finishCalendarMovement > 0)
      .reduce((largestRow, row) => {
        if (!largestRow || row.finishCalendarMovement > largestRow.finishCalendarMovement) {
          return row;
        }

        return largestRow;
      }, null);
  }

  function getLargestFinishAcceleration(rows) {
    return rows
      .filter((row) => row.validForMovement && row.finishCalendarMovement < 0)
      .reduce((largestRow, row) => {
        if (!largestRow || row.finishCalendarMovement < largestRow.finishCalendarMovement) {
          return row;
        }

        return largestRow;
      }, null);
  }

  function buildMovementSummary(rows) {
    const validRows = rows.filter((row) => row.validForMovement);

    return {
      totalRows: rows.length,
      detailRows: rows.filter((row) => row.classification === "detail").length,
      likelySummaryRows: rows.filter((row) => row.classification === "likely-summary").length,
      dateWarningRows: rows.filter((row) => row.dateWarnings.length > 0).length,
      excludedMovementRows: rows.filter((row) => !row.validForMovement).length,
      changedRows: validRows.filter((row) => row.hasScheduleMovement).length,
      unchangedRows: validRows.filter((row) => !row.hasScheduleMovement).length,
      delayedRows: validRows.filter((row) => {
        return getMovementSign(row.finishCalendarMovement, row.finishWorkdayMovement) > 0;
      }).length,
      acceleratedRows: validRows.filter((row) => {
        return getMovementSign(row.finishCalendarMovement, row.finishWorkdayMovement) < 0;
      }).length,
      startOnlyMovementRows: validRows.filter((row) => {
        return (
          getMovementSign(row.finishCalendarMovement, row.finishWorkdayMovement) === 0 &&
          getMovementSign(row.startCalendarMovement, row.startWorkdayMovement) !== 0
        );
      }).length,
      largestFinishDelay: getLargestFinishDelay(rows),
      largestFinishAcceleration: getLargestFinishAcceleration(rows)
    };
  }

  function appendDescriptionItem(list, term, description) {
    const termElement = document.createElement("dt");
    const descriptionElement = document.createElement("dd");

    termElement.textContent = term;
    descriptionElement.textContent = description;
    list.appendChild(termElement);
    list.appendChild(descriptionElement);
  }

  function formatMovementSummaryRow(row) {
    if (!row) {
      return "None";
    }

    const taskLabel = row.taskName || row.taskId || "Unnamed row";
    return `${row.finishWorkdayMovement} workdays (${row.finishCalendarMovement} calendar days) - ${taskLabel}`;
  }

  function renderMovementSummary(summary) {
    const movementSummary = getScheduleAnalyzerElement("scheduleMovementSummary");

    if (!movementSummary) {
      return;
    }

    movementSummary.replaceChildren();

    appendDescriptionItem(movementSummary, "Total normalized rows", String(summary.totalRows));
    appendDescriptionItem(movementSummary, "Detail rows", String(summary.detailRows));
    appendDescriptionItem(movementSummary, "Likely parent/summary rows", String(summary.likelySummaryRows));
    appendDescriptionItem(movementSummary, "Rows with date warnings", String(summary.dateWarningRows));
    appendDescriptionItem(
      movementSummary,
      "Rows excluded from movement calculations",
      String(summary.excludedMovementRows)
    );
    appendDescriptionItem(movementSummary, "Rows with any schedule movement", String(summary.changedRows));
    appendDescriptionItem(movementSummary, "Unchanged rows", String(summary.unchangedRows));
    appendDescriptionItem(movementSummary, "Delayed rows", String(summary.delayedRows));
    appendDescriptionItem(movementSummary, "Accelerated rows", String(summary.acceleratedRows));
    appendDescriptionItem(movementSummary, "Start-only movement rows", String(summary.startOnlyMovementRows));
    appendDescriptionItem(
      movementSummary,
      "Largest finish delay",
      formatMovementSummaryRow(summary.largestFinishDelay)
    );
    appendDescriptionItem(
      movementSummary,
      "Largest finish acceleration",
      formatMovementSummaryRow(summary.largestFinishAcceleration)
    );
  }

  function formatDateForDetail(row, key) {
    const parsedDate = row.parsedDates[key];

    if (parsedDate.isValid) {
      return formatDateValue(parsedDate.date);
    }

    return parsedDate.displayValue || "Missing";
  }

  function formatMovementValue(row, key) {
    if (!row.validForMovement) {
      return "Not calculated";
    }

    return String(row[key]);
  }

  function appendTableCell(tableRow, value, className) {
    const tableCell = document.createElement("td");

    if (className) {
      tableCell.className = className;
    }

    tableCell.textContent = value;
    tableRow.appendChild(tableCell);

    return tableCell;
  }

  function appendClassificationCell(tableRow, classification) {
    const tableCell = document.createElement("td");
    const classificationBadge = document.createElement("span");

    classificationBadge.className = `classification-badge is-${classification}`;
    classificationBadge.textContent = classification;
    tableCell.appendChild(classificationBadge);
    tableRow.appendChild(tableCell);
  }

  function getMovementDetailValue(row, columnKey) {
    if (
      columnKey === "baselineStart" ||
      columnKey === "baselineFinish" ||
      columnKey === "currentStart" ||
      columnKey === "currentFinish"
    ) {
      return formatDateForDetail(row, columnKey);
    }

    if (columnKey === "startWorkdayMovement" || columnKey === "finishWorkdayMovement") {
      return formatMovementValue(row, columnKey);
    }

    if (columnKey === "movementDirection") {
      return row.movementDirection;
    }

    if (columnKey === "warnings") {
      return row.dateWarnings.length > 0 ? row.dateWarnings.join(" ") : "None";
    }

    return row[columnKey] || "";
  }

  function shouldShowMovementDetailRow(row) {
    return row.hasScheduleMovement;
  }

  function getDisplayedMovementRows(rows) {
    return rows.filter((row) => shouldShowMovementDetailRow(row));
  }

  function renderMovementDetailTable(rows) {
    const movementDetailHeader = getScheduleAnalyzerElement("scheduleMovementDetailHeader");
    const movementDetailBody = getScheduleAnalyzerElement("scheduleMovementDetailBody");

    if (!movementDetailHeader || !movementDetailBody) {
      return;
    }

    movementDetailHeader.replaceChildren();
    movementDetailBody.replaceChildren();

    movementDetailColumns.forEach((column) => {
      const headerCell = document.createElement("th");
      headerCell.textContent = column.label;
      movementDetailHeader.appendChild(headerCell);
    });

    if (rows.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");

      emptyCell.colSpan = movementDetailColumns.length;
      emptyCell.textContent =
        "No changed schedule rows were found. Unchanged rows and warning-only rows are included in the downloadable Excel report.";
      emptyRow.appendChild(emptyCell);
      movementDetailBody.appendChild(emptyRow);
      return;
    }

    rows.forEach((row) => {
      const tableRow = document.createElement("tr");

      tableRow.classList.add(`is-${row.classification}`);

      if (row.dateWarnings.length > 0) {
        tableRow.classList.add("has-date-warning");
      }

      movementDetailColumns.forEach((column) => {
        if (column.key === "classification") {
          appendClassificationCell(tableRow, row.classification);
          return;
        }

        appendTableCell(tableRow, getMovementDetailValue(row, column.key));
      });

      movementDetailBody.appendChild(tableRow);
    });
  }

  function renderMovementAnalysis(result) {
    const resultsPanel = getScheduleAnalyzerElement("schedulePhase3Results");

    if (resultsPanel) {
      resultsPanel.hidden = false;
    }

    renderMovementSummary(result.movementSummary);
    renderMovementDetailTable(getDisplayedMovementRows(result.analyzedRows));
  }

  function formatReportTimestamp(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString();
  }

  function formatYesNo(value) {
    return value ? "Yes" : "No";
  }

  function getWarningsText(row) {
    return row.dateWarnings.length > 0 ? row.dateWarnings.join(" ") : "";
  }

  function getReportMovementValue(row, key) {
    return row.validForMovement ? row[key] : "";
  }

  function buildScheduleReportRow(row) {
    return {
      "Task ID": row.taskId,
      "Task / Milestone": row.taskName,
      "Row Classification": row.classification,
      "Baseline Start": formatDateForDetail(row, "baselineStart"),
      "Current Start": formatDateForDetail(row, "currentStart"),
      "Start Calendar Movement": getReportMovementValue(row, "startCalendarMovement"),
      "Start Workday Movement": getReportMovementValue(row, "startWorkdayMovement"),
      "Baseline Finish": formatDateForDetail(row, "baselineFinish"),
      "Current Finish": formatDateForDetail(row, "currentFinish"),
      "Finish Calendar Movement": getReportMovementValue(row, "finishCalendarMovement"),
      "Finish Workday Movement": getReportMovementValue(row, "finishWorkdayMovement"),
      "Movement Status": row.movementDirection,
      Predecessors: row.predecessors,
      "Status / % Complete": row.status,
      Warnings: getWarningsText(row),
      "Excluded From Future Critical Path": formatYesNo(row.excludeFromFutureCriticalPath)
    };
  }

  function buildWarningReportRow(row) {
    return {
      "Task ID": row.taskId,
      "Task / Milestone": row.taskName,
      "Row Classification": row.classification,
      "Baseline Start": formatDateForDetail(row, "baselineStart"),
      "Baseline Finish": formatDateForDetail(row, "baselineFinish"),
      "Current Start": formatDateForDetail(row, "currentStart"),
      "Current Finish": formatDateForDetail(row, "currentFinish"),
      "Movement Status": row.movementDirection,
      Warnings: getWarningsText(row),
      "Excluded From Movement Calculations": formatYesNo(!row.validForMovement),
      "Excluded From Future Critical Path": formatYesNo(row.excludeFromFutureCriticalPath)
    };
  }

  function getWarningReportRows(rows) {
    return rows.filter((row) => row.dateWarnings.length > 0 || !row.validForMovement);
  }

  function buildExecutiveSummaryRows(result) {
    const summary = result.movementSummary;

    return [
      ["Source workbook file", result.fileName],
      ["Worksheet used", result.worksheetName],
      ["Analysis generated timestamp", formatReportTimestamp(result.analysisGeneratedAt)],
      ["Total normalized rows", summary.totalRows],
      ["Detail rows", summary.detailRows],
      ["Likely parent/summary rows", summary.likelySummaryRows],
      ["Rows with date warnings", summary.dateWarningRows],
      ["Rows excluded from movement calculations", summary.excludedMovementRows],
      ["Rows with any schedule movement", summary.changedRows],
      ["Unchanged rows", summary.unchangedRows],
      ["Delayed rows", summary.delayedRows],
      ["Accelerated rows", summary.acceleratedRows],
      ["Start-only movement rows", summary.startOnlyMovementRows],
      ["Largest finish delay", formatMovementSummaryRow(summary.largestFinishDelay)],
      ["Largest finish acceleration", formatMovementSummaryRow(summary.largestFinishAcceleration)],
      [
        "Note",
        "Likely parent/summary rows are excluded from future critical path analysis by default."
      ],
      ["Note", "Critical path analysis has not been added yet."]
    ];
  }

  function buildColumnMappingRows(result) {
    return scheduleMappings.map((mapping) => {
      return [mapping.label, result.mappingValues[mapping.key] || ""];
    });
  }

  function setWorksheetColumnWidths(worksheet, widths) {
    worksheet["!cols"] = widths.map((width) => {
      return { wch: width };
    });
  }

  function addAoaWorksheet(reportWorkbook, sheetName, rows, widths) {
    const worksheet = window.XLSX.utils.aoa_to_sheet(rows);

    setWorksheetColumnWidths(worksheet, widths);
    window.XLSX.utils.book_append_sheet(reportWorkbook, worksheet, sheetName);
  }

  function addJsonWorksheet(reportWorkbook, sheetName, rows, headers, widths) {
    const worksheet =
      rows.length > 0
        ? window.XLSX.utils.json_to_sheet(rows, { header: headers })
        : window.XLSX.utils.aoa_to_sheet([headers]);

    setWorksheetColumnWidths(worksheet, widths);
    window.XLSX.utils.book_append_sheet(reportWorkbook, worksheet, sheetName);
  }

  function createScheduleReportWorkbook(result) {
    const reportWorkbook = window.XLSX.utils.book_new();
    const changedRows = result.analyzedRows.filter((row) => row.hasScheduleMovement);
    const warningRows = getWarningReportRows(result.analyzedRows);

    addAoaWorksheet(reportWorkbook, reportSheetNames.executiveSummary, buildExecutiveSummaryRows(result), [36, 80]);
    addJsonWorksheet(
      reportWorkbook,
      reportSheetNames.changedItems,
      changedRows.map((row) => buildScheduleReportRow(row)),
      scheduleReportHeaders,
      [16, 34, 22, 16, 16, 22, 22, 16, 16, 22, 22, 26, 18, 20, 46, 30]
    );
    addJsonWorksheet(
      reportWorkbook,
      reportSheetNames.allItems,
      result.analyzedRows.map((row) => buildScheduleReportRow(row)),
      scheduleReportHeaders,
      [16, 34, 22, 16, 16, 22, 22, 16, 16, 22, 22, 26, 18, 20, 46, 30]
    );
    addJsonWorksheet(
      reportWorkbook,
      reportSheetNames.warnings,
      warningRows.map((row) => buildWarningReportRow(row)),
      warningReportHeaders,
      [16, 34, 22, 16, 16, 16, 16, 26, 52, 34, 30]
    );
    addAoaWorksheet(
      reportWorkbook,
      reportSheetNames.columnMapping,
      [["Mapped Column Category", "Workbook Column Name"], ...buildColumnMappingRows(result)],
      [36, 40]
    );

    return reportWorkbook;
  }

  function getFileNameWithoutExtension(fileName) {
    return fileName.replace(/\.[^.]*$/, "");
  }

  function getSafeReportFileName(result) {
    const baseName = getFileNameWithoutExtension(result.fileName)
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return `schedule-movement-analysis-${baseName || "uploaded-schedule"}.xlsx`;
  }

  function handleDownloadScheduleReport() {
    if (!latestAnalysisResult) {
      setScheduleAnalyzerStatus(
        "Please analyze an uploaded schedule before downloading the Excel summary.",
        "is-info"
      );
      return;
    }

    if (!window.XLSX || !window.XLSX.utils || !window.XLSX.writeFile) {
      setScheduleAnalyzerStatus(
        "The Excel report generator could not load. Please check your connection and try again.",
        "is-error"
      );
      return;
    }

    try {
      const reportWorkbook = createScheduleReportWorkbook(latestAnalysisResult);

      window.XLSX.writeFile(reportWorkbook, getSafeReportFileName(latestAnalysisResult));
      setScheduleAnalyzerStatus("Excel summary report generated from the latest analysis.", "is-ready");
    } catch (error) {
      setScheduleAnalyzerStatus(
        "The Excel summary report could not be generated. Please rerun the analysis and try again.",
        "is-error"
      );
    }
  }

  function renderMappedColumns(mappedColumns, mappingValues) {
    const mappedColumnsList = getScheduleAnalyzerElement("scheduleMappedColumns");

    if (!mappedColumnsList) {
      return;
    }

    mappedColumnsList.replaceChildren();

    mappedColumns.forEach((mapping) => {
      const listItem = document.createElement("li");
      const fieldLabel = document.createElement("strong");
      const columnName = document.createElement("span");

      fieldLabel.textContent = `${mapping.label}: `;
      columnName.textContent = mappingValues[mapping.key];
      listItem.appendChild(fieldLabel);
      listItem.appendChild(columnName);
      mappedColumnsList.appendChild(listItem);
    });
  }

  function renderPreviewTable(rows) {
    const previewHeader = getScheduleAnalyzerElement("schedulePreviewHeader");
    const previewBody = getScheduleAnalyzerElement("schedulePreviewBody");

    if (!previewHeader || !previewBody) {
      return;
    }

    previewHeader.replaceChildren();
    previewBody.replaceChildren();

    previewColumns.forEach((column) => {
      const headerCell = document.createElement("th");
      headerCell.textContent = column.label;
      previewHeader.appendChild(headerCell);
    });

    rows.slice(0, 5).forEach((row) => {
      const tableRow = document.createElement("tr");

      previewColumns.forEach((column) => {
        const tableCell = document.createElement("td");
        tableCell.textContent = row[column.key];
        tableRow.appendChild(tableCell);
      });

      previewBody.appendChild(tableRow);
    });

    if (rows.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");

      emptyCell.colSpan = previewColumns.length;
      emptyCell.textContent = "No normalized rows were created from the mapped columns.";
      emptyRow.appendChild(emptyCell);
      previewBody.appendChild(emptyRow);
    }
  }

  function renderWorkbookPreview(result) {
    const previewPanel = getScheduleAnalyzerElement("scheduleAnalyzerPreview");
    const summaryList = getScheduleAnalyzerElement("scheduleWorkbookSummary");

    if (!previewPanel || !summaryList) {
      return;
    }

    summaryList.replaceChildren();

    appendDescriptionItem(summaryList, "Workbook file", result.fileName);
    appendDescriptionItem(summaryList, "Worksheet used", result.worksheetName);
    appendDescriptionItem(summaryList, "Detected workbook columns", String(result.detectedColumnCount));
    appendDescriptionItem(summaryList, "Unmapped columns ignored", String(result.unmappedColumnCount));
    appendDescriptionItem(summaryList, "Data rows found", String(result.dataRowCount));
    appendDescriptionItem(summaryList, "Normalized rows created", String(result.normalizedRows.length));

    renderMappedColumns(result.mappedColumns, result.mappingValues);
    renderPreviewTable(result.normalizedRows);
    previewPanel.hidden = false;
  }

  function parseWorkbookRows(workbook, selectedFile, mappingValues) {
    const firstWorksheet = getFirstWorksheet(workbook);

    if (!firstWorksheet) {
      throw new Error("Workbook does not include a worksheet.");
    }

    const rows = getWorksheetRows(firstWorksheet.worksheet);
    const headerRowIndex = findHeaderRowIndex(rows);

    if (headerRowIndex === -1) {
      throw new Error("Workbook does not include a non-empty header row.");
    }

    const headerNames = getHeaderNames(rows[headerRowIndex]);
    const headerIndexByName = getHeaderIndexByName(headerNames);
    const mappedColumns = getMappedColumns(mappingValues);
    const missingMappedColumnNames = getMissingMappedColumnNames(mappedColumns, headerIndexByName, mappingValues);

    if (missingMappedColumnNames.length > 0) {
      return {
        ok: false,
        missingMappedColumnNames
      };
    }

    const dataRows = rows.slice(headerRowIndex + 1).filter((row) => !isBlankRow(row));
    const detectedColumnCount = headerNames.filter((headerName) => headerName !== "").length;
    const mappedWorkbookColumnNames = new Set(mappedColumns.map((mapping) => mappingValues[mapping.key]));
    const unmappedColumnCount = Math.max(detectedColumnCount - mappedWorkbookColumnNames.size, 0);
    const normalizedRows = buildNormalizedRows(dataRows, mappedColumns, headerIndexByName, mappingValues);
    const analyzedRows = analyzeNormalizedRows(normalizedRows, mappingValues);
    const movementSummary = buildMovementSummary(analyzedRows);

    normalizedScheduleRows = normalizedRows;

    return {
      ok: true,
      fileName: selectedFile.name,
      worksheetName: firstWorksheet.name,
      analysisGeneratedAt: new Date(),
      detectedColumnCount,
      unmappedColumnCount,
      dataRowCount: dataRows.length,
      normalizedRows,
      analyzedRows,
      movementSummary,
      mappedColumns,
      mappingValues
    };
  }

  async function handleAnalyzeUploadedSchedule() {
    clearSchedulePreview();

    const missingMappings = getMissingRequiredScheduleMappings();

    if (missingMappings.length > 0) {
      const missingLabels = missingMappings.map((mapping) => mapping.label).join(", ");
      setScheduleAnalyzerStatus(
        `Please fill in the required schedule mappings before analyzing: ${missingLabels}.`,
        "is-error"
      );
      return;
    }

    const selectedFile = getSelectedScheduleFile();

    if (!selectedFile) {
      setScheduleAnalyzerStatus(
        "Please upload a Smartsheet .xlsx export before running the analyzer.",
        "is-error"
      );
      return;
    }

    if (!isXlsxFile(selectedFile)) {
      setScheduleAnalyzerStatus(
        "Please choose a .xlsx workbook exported from Smartsheet.",
        "is-error"
      );
      return;
    }

    if (!window.XLSX) {
      setScheduleAnalyzerStatus(
        "The workbook parser could not load. Please check your connection and try again.",
        "is-error"
      );
      return;
    }

    setScheduleAnalyzerStatus("Reading workbook and validating mapped columns...", "is-info");

    try {
      const mappingValues = getMappingValues();
      const fileContents = await readFileAsArrayBuffer(selectedFile);
      const workbook = window.XLSX.read(fileContents, { type: "array", cellDates: true });
      const parseResult = parseWorkbookRows(workbook, selectedFile, mappingValues);

      if (!parseResult.ok) {
        setScheduleAnalyzerStatus(
          `These mapped columns were not found in the detected header row: ${parseResult.missingMappedColumnNames.join(", ")}.`,
          "is-error"
        );
        return;
      }

      renderWorkbookPreview(parseResult);
      renderMovementAnalysis(parseResult);
      latestAnalysisResult = parseResult;
      setReportDownloadReady(true);
      setScheduleAnalyzerStatus(
        "Workbook analyzed successfully. Mapped columns were validated, unrelated columns were ignored, and movement results are ready below.",
        "is-ready"
      );
    } catch (error) {
      normalizedScheduleRows = [];
      latestAnalysisResult = null;
      setReportDownloadReady(false);
      clearSchedulePreview();
      setScheduleAnalyzerStatus(
        "The workbook could not be parsed. Please confirm this is a valid .xlsx export from Smartsheet.",
        "is-error"
      );
    }
  }

  function wirePreviewResetEvents() {
    const fileInput = getScheduleAnalyzerElement("scheduleAnalyzerFile");

    if (fileInput) {
      fileInput.addEventListener("change", clearSchedulePreview);
    }

    scheduleMappings.forEach((mapping) => {
      const input = getScheduleAnalyzerElement(mapping.id);

      if (input) {
        input.addEventListener("input", clearSchedulePreview);
      }
    });
  }

  function wireScheduleAnalyzerEvents() {
    const analyzeButton = getScheduleAnalyzerElement("analyzeUploadedScheduleButton");
    const downloadButton = getScheduleAnalyzerElement("downloadScheduleReportButton");
    const analyzerForm = getScheduleAnalyzerElement("scheduleAnalyzerForm");

    if (analyzerForm) {
      analyzerForm.addEventListener("submit", (event) => {
        event.preventDefault();
      });
    }

    if (analyzeButton) {
      analyzeButton.addEventListener("click", handleAnalyzeUploadedSchedule);
    }

    if (downloadButton) {
      downloadButton.addEventListener("click", handleDownloadScheduleReport);
      setReportDownloadReady(false);
    }

    wirePreviewResetEvents();
  }

  wireScheduleAnalyzerEvents();
})();
