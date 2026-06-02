// Phase 3+ implementation for the uploaded Smartsheet .xlsx schedule analyzer.
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
    {
      key: "hierarchyLevelRaw",
      id: "scheduleHierarchyLevelColumn",
      label: "Row Hierarchy / Outline Level column",
      required: false
    },
    {
      key: "projectNameRaw",
      id: "scheduleProjectNameColumn",
      label: "Project Name / Project Grouping column",
      required: false
    },
    { key: "rowTypeRaw", id: "scheduleRowTypeColumn", label: "Row Type column", required: false },
    {
      key: "includeInCriticalPathRaw",
      id: "scheduleIncludeCriticalPathColumn",
      label: "Include in Critical Path? column",
      required: false
    },
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
    { key: "hierarchyLevelRaw", label: "Hierarchy Level" },
    { key: "projectName", label: "Project Name" },
    { key: "rowTypeRaw", label: "Row Type" },
    { key: "includeInCriticalPathRaw", label: "Include in Critical Path?" },
    { key: "status", label: "Status / % Complete" }
  ];

  const normalizedRowPresenceColumns = previewColumns.filter((column) => {
    return (
      column.key !== "hierarchyLevelRaw" &&
      column.key !== "projectName" &&
      column.key !== "rowTypeRaw" &&
      column.key !== "includeInCriticalPathRaw"
    );
  });

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
    dependencyValidation: "Dependency Validation",
    allDependencyLinks: "All Dependency Links",
    estimatedCriticalPath: "Estimated Critical Path",
    columnMapping: "Column Mapping Used"
  };

  const scheduleReportHeaders = [
    "Project Name",
    "Task ID",
    "Task / Milestone",
    "Row Classification",
    "Row Type",
    "Include in Critical Path?",
    "Hierarchy Level",
    "Has Child Rows",
    "Critical Path Eligible",
    "Critical Path Exclusion Reason",
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
    "Project Name",
    "Task ID",
    "Task / Milestone",
    "Row Classification",
    "Row Type",
    "Include in Critical Path?",
    "Hierarchy Level",
    "Has Child Rows",
    "Critical Path Eligible",
    "Critical Path Exclusion Reason",
    "Baseline Start",
    "Baseline Finish",
    "Current Start",
    "Current Finish",
    "Movement Status",
    "Warnings",
    "Excluded From Movement Calculations",
    "Excluded From Future Critical Path"
  ];

  const dependencyReportHeaders = [
    "Source Row Number",
    "Excel Row Number",
    "Task ID",
    "Task / Milestone",
    "Row Classification",
    "Predecessor Value",
    "Parsed Reference",
    "Relationship Type",
    "Lag Days",
    "Resolved?",
    "Resolved Task ID",
    "Resolved Task / Milestone",
    "Issue / Warning"
  ];

  const allDependencyLinkReportHeaders = [
    "Project Name",
    "Successor Row Number",
    "Successor Task ID",
    "Successor Task Name",
    "Successor Row Type",
    "Successor Critical Path Eligible",
    "Successor Critical Path Exclusion Reason",
    "Predecessor Reference",
    "Relationship Type",
    "Lag Days",
    "Resolved Predecessor Row Number",
    "Resolved Predecessor Task ID",
    "Resolved Predecessor Task Name",
    "Predecessor Row Type",
    "Predecessor Critical Path Eligible",
    "Predecessor Critical Path Exclusion Reason",
    "Is Cross-Project Link?",
    "Link Included in Critical Path Logic?",
    "Warning / Issue"
  ];

  const dependencyWarningColumns = [
    { key: "sourceDataRowNumber", label: "Source Row" },
    { key: "excelRowNumber", label: "Excel Row" },
    { key: "taskName", label: "Task / Milestone" },
    { key: "predecessorValue", label: "Predecessor Value" },
    { key: "parsedReference", label: "Parsed Reference" },
    { key: "relationshipType", label: "Relationship" },
    { key: "lagDays", label: "Lag Days" },
    { key: "resolved", label: "Resolved?" },
    { key: "issueMessage", label: "Issue / Warning" }
  ];

  const criticalPathDetailColumns = [
    { key: "projectName", label: "Project Name" },
    { key: "criticalPathSequenceCurrent", label: "Sequence" },
    { key: "taskId", label: "Task ID" },
    { key: "taskName", label: "Task / Milestone" },
    { key: "baselineStart", label: "Baseline Start" },
    { key: "baselineFinish", label: "Baseline Finish" },
    { key: "currentStart", label: "Current Start" },
    { key: "currentFinish", label: "Current Finish" },
    { key: "finishWorkdayMovement", label: "Finish Workday Movement" },
    { key: "movementDirection", label: "Movement Status" },
    { key: "criticalPathStatus", label: "Critical Path Status" },
    { key: "predecessors", label: "Predecessors" }
  ];

  const criticalPathReportHeaders = [
    "Project Name",
    "Path Type",
    "Sequence",
    "Task ID",
    "Task / Milestone",
    "Row Classification",
    "Row Type",
    "Include in Critical Path?",
    "Hierarchy Level",
    "Has Child Rows",
    "Critical Path Eligible",
    "Critical Path Exclusion Reason",
    "Baseline Start",
    "Baseline Finish",
    "Current Start",
    "Current Finish",
    "Finish Calendar Movement",
    "Finish Workday Movement",
    "Movement Status",
    "Critical Path Status",
    "Baseline Critical Path Sequence",
    "Current Critical Path Sequence",
    "Predecessors",
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
    const dependencySummary = getScheduleAnalyzerElement("scheduleDependencySummary");
    const dependencyWarningHeader = getScheduleAnalyzerElement("scheduleDependencyWarningHeader");
    const dependencyWarningBody = getScheduleAnalyzerElement("scheduleDependencyWarningBody");
    const criticalPathSummary = getScheduleAnalyzerElement("scheduleCriticalPathSummary");
    const criticalPathDetailHeader = getScheduleAnalyzerElement("scheduleCriticalPathDetailHeader");
    const criticalPathDetailBody = getScheduleAnalyzerElement("scheduleCriticalPathDetailBody");

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
      movementDetailBody,
      dependencySummary,
      dependencyWarningHeader,
      dependencyWarningBody,
      criticalPathSummary,
      criticalPathDetailHeader,
      criticalPathDetailBody
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

  function getRowCells(row) {
    return Array.isArray(row) ? row : row.cells;
  }

  function getDateOnly(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function getDateKey(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day}`;
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

  function addDays(date, dayCount) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + dayCount);
    return getDateOnly(nextDate);
  }

  function getNthWeekdayOfMonth(year, monthIndex, dayOfWeek, occurrence) {
    const date = new Date(year, monthIndex, 1);
    let matchingDayCount = 0;

    while (date.getMonth() === monthIndex) {
      if (date.getDay() === dayOfWeek) {
        matchingDayCount += 1;

        if (matchingDayCount === occurrence) {
          return getDateOnly(date);
        }
      }

      date.setDate(date.getDate() + 1);
    }

    return null;
  }

  function getLastWeekdayOfMonth(year, monthIndex, dayOfWeek) {
    const date = new Date(year, monthIndex + 1, 0);

    while (date.getMonth() === monthIndex) {
      if (date.getDay() === dayOfWeek) {
        return getDateOnly(date);
      }

      date.setDate(date.getDate() - 1);
    }

    return null;
  }

  function getObservedFixedHoliday(year, monthIndex, day, label) {
    const actualDate = new Date(year, monthIndex, day);
    const observedDate = getDateOnly(actualDate);

    if (actualDate.getDay() === 6) {
      return {
        date: addDays(actualDate, -1),
        label: `${label} (observed)`
      };
    }

    if (actualDate.getDay() === 0) {
      return {
        date: addDays(actualDate, 1),
        label: `${label} (observed)`
      };
    }

    return {
      date: observedDate,
      label
    };
  }

  function addHolidayToMap(holidayMap, holiday) {
    if (!holiday || !holiday.date) {
      return;
    }

    const dateKey = getDateKey(holiday.date);
    const labels = holidayMap.get(dateKey) || [];

    if (!labels.includes(holiday.label)) {
      labels.push(holiday.label);
    }

    holidayMap.set(dateKey, labels);
  }

  function getCommonUsHolidayEntriesForYear(year) {
    const thanksgivingDate = getNthWeekdayOfMonth(year, 10, 4, 4);

    return [
      getObservedFixedHoliday(year, 0, 1, "New Year's Day"),
      { date: getNthWeekdayOfMonth(year, 0, 1, 3), label: "MLK Day" },
      { date: getNthWeekdayOfMonth(year, 1, 1, 3), label: "Presidents' Day" },
      { date: getLastWeekdayOfMonth(year, 4, 1), label: "Memorial Day" },
      getObservedFixedHoliday(year, 6, 4, "Independence Day / July 4th"),
      { date: getNthWeekdayOfMonth(year, 8, 1, 1), label: "Labor Day" },
      { date: thanksgivingDate, label: "Thanksgiving" },
      { date: thanksgivingDate ? addDays(thanksgivingDate, 1) : null, label: "Day after Thanksgiving" },
      getObservedFixedHoliday(year, 11, 24, "Christmas Eve"),
      getObservedFixedHoliday(year, 11, 25, "Christmas Day")
    ];
  }

  function getDefaultHolidayText() {
    const currentYear = new Date().getFullYear();
    const holidayMap = new Map();

    [currentYear, currentYear + 1].forEach((year) => {
      getCommonUsHolidayEntriesForYear(year).forEach((holiday) => {
        addHolidayToMap(holidayMap, holiday);
      });
    });

    return Array.from(holidayMap.entries())
      .sort((firstEntry, secondEntry) => firstEntry[0].localeCompare(secondEntry[0]))
      .map(([dateKey, labels]) => {
        const [year, month, day] = dateKey.split("-");
        return `${month}/${day}/${year} - ${labels.join("; ")}`;
      })
      .join("\n");
  }

  function getHolidayDateCandidates(text) {
    const datePattern =
      /\b(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}|[2-5]\d{4}(?:\.\d+)?|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4})\b/gi;

    return text.match(datePattern) || [];
  }

  function parseHolidayDateText(holidayText) {
    const dateSet = new Set();
    const invalidEntries = [];
    const normalizedText = normalizeCellValue(holidayText);

    if (normalizedText === "") {
      return {
        dateSet,
        invalidEntries
      };
    }

    getHolidayDateCandidates(normalizedText).forEach((candidate) => {
      const parsedDate = parseDateString(candidate);

      if (parsedDate) {
        dateSet.add(getDateKey(parsedDate));
      } else {
        invalidEntries.push(candidate);
      }
    });

    normalizedText
      .split(/[\n;]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "")
      .forEach((entry) => {
        if (/\d/.test(entry) && getHolidayDateCandidates(entry).length === 0) {
          invalidEntries.push(entry);
        }
      });

    return {
      dateSet,
      invalidEntries: Array.from(new Set(invalidEntries))
    };
  }

  function getHolidaySettings() {
    const holidayInput = getScheduleAnalyzerElement("scheduleHolidayDates");
    const holidayText = holidayInput ? holidayInput.value : "";
    const parsedHolidayDates = parseHolidayDateText(holidayText);
    const holidayDates = Array.from(parsedHolidayDates.dateSet).sort();

    return {
      holidayText,
      holidayDateSet: parsedHolidayDates.dateSet,
      holidayDates,
      invalidHolidayEntries: parsedHolidayDates.invalidEntries,
      holidayCalendarUsed: holidayDates.length > 0
    };
  }

  function getHolidayDateSet(analyzerOptions) {
    return analyzerOptions && analyzerOptions.holidayDateSet instanceof Set
      ? analyzerOptions.holidayDateSet
      : new Set();
  }

  function initializeDefaultHolidayInput() {
    const holidayInput = getScheduleAnalyzerElement("scheduleHolidayDates");

    if (holidayInput && holidayInput.value.trim() === "") {
      holidayInput.value = getDefaultHolidayText();
    }
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

  function isHoliday(date, holidayDateSet) {
    return holidayDateSet instanceof Set && holidayDateSet.has(getDateKey(date));
  }

  function isWorkingDay(date, holidayDateSet) {
    return isWeekday(date) && !isHoliday(date, holidayDateSet);
  }

  function countWeekdaysInclusive(startDate, endDate, holidayDateSet) {
    const currentDate = new Date(startDate);
    let weekdayCount = 0;

    while (currentDate <= endDate) {
      if (isWorkingDay(currentDate, holidayDateSet)) {
        weekdayCount += 1;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return weekdayCount;
  }

  function calculateWorkdaysMoved(baselineDate, currentDate, holidayDateSet) {
    if (currentDate.getTime() === baselineDate.getTime()) {
      return 0;
    }

    if (currentDate > baselineDate) {
      return countWeekdaysInclusive(baselineDate, currentDate, holidayDateSet) - 1;
    }

    return -(countWeekdaysInclusive(currentDate, baselineDate, holidayDateSet) - 1);
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
    const cells = row ? getRowCells(row) : null;

    return !cells || cells.every((cell) => normalizeCellValue(cell) === "");
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
    if (!worksheet["!ref"]) {
      return [];
    }

    const worksheetRange = window.XLSX.utils.decode_range(worksheet["!ref"]);
    const rawRows = window.XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      blankrows: true,
      raw: false
    });

    return rawRows
      .map((row, index) => {
        return {
          cells: row,
          excelRowNumber: worksheetRange.s.r + index + 1
        };
      })
      .filter((row) => !isBlankRow(row));
  }

  function findHeaderRowIndex(rows) {
    return rows.findIndex((row) => !isBlankRow(row));
  }

  function getHeaderNames(headerRow) {
    return getRowCells(headerRow).map((cell) => normalizeCellValue(cell));
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
      .map((row, index) => {
        const rowCells = getRowCells(row);
        const normalizedRow = {
          sourceDataRowNumber: index + 1,
          excelRowNumber: row.excelRowNumber || "",
          taskId: "",
          taskName: "",
          baselineStart: "",
          baselineFinish: "",
          currentStart: "",
          currentFinish: "",
          predecessors: "",
          hierarchyLevelRaw: "",
          hierarchyLevel: null,
          hasChildRows: false,
          projectNameRaw: "",
          projectName: "",
          rowTypeRaw: "",
          rowType: "",
          includeInCriticalPathRaw: "",
          includeInCriticalPathOverride: null,
          status: ""
        };

        mappedColumns.forEach((mapping) => {
          const columnIndex = headerIndexByName.get(mappingValues[mapping.key]);
          normalizedRow[mapping.key] = normalizeCellValue(rowCells[columnIndex]);
        });

        return normalizedRow;
      })
      .filter((row) => {
        return normalizedRowPresenceColumns.some((column) => row[column.key] !== "");
      });
  }

  function parseHierarchyLevelValue(value) {
    const normalizedValue = normalizeCellValue(value);

    if (normalizedValue === "") {
      return null;
    }

    const numericLevel = Number(normalizedValue);

    if (Number.isFinite(numericLevel)) {
      return numericLevel;
    }

    const embeddedNumberMatch = normalizedValue.match(/-?\d+(?:\.\d+)?/);

    return embeddedNumberMatch ? Number(embeddedNumberMatch[0]) : null;
  }

  function isHierarchyMappingProvided(mappingValues) {
    return Boolean(mappingValues.hierarchyLevelRaw);
  }

  function isProjectGroupingMapped(mappingValues) {
    return Boolean(mappingValues.projectNameRaw);
  }

  function normalizeRowType(value) {
    return normalizeCellValue(value);
  }

  function normalizeControlKeyword(value) {
    return normalizeCellValue(value).toLowerCase();
  }

  function parseIncludeInCriticalPathOverride(value) {
    const normalizedValue = normalizeControlKeyword(value);
    const includeValues = new Set(["yes", "y", "true", "checked", "include", "1"]);
    const excludeValues = new Set(["no", "n", "false", "unchecked", "exclude", "0"]);

    if (normalizedValue === "") {
      return null;
    }

    if (includeValues.has(normalizedValue)) {
      return true;
    }

    if (excludeValues.has(normalizedValue)) {
      return false;
    }

    return null;
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

  function normalizeProjectName(row, mappingValues) {
    if (!isProjectGroupingMapped(mappingValues)) {
      return "Uploaded Schedule";
    }

    const projectName = normalizeCellValue(row.projectNameRaw);

    return projectName === "" ? "Ungrouped Project" : projectName;
  }

  function addProjectGroupingAnalysis(rows, mappingValues) {
    rows.forEach((row) => {
      row.projectName = normalizeProjectName(row, mappingValues);
    });

    return rows;
  }

  function addHierarchyAnalysis(rows, mappingValues) {
    const hierarchyMapped = isHierarchyMappingProvided(mappingValues);

    rows.forEach((row) => {
      row.hierarchyLevel = hierarchyMapped ? parseHierarchyLevelValue(row.hierarchyLevelRaw) : null;
      row.hasChildRows = false;
    });

    if (!hierarchyMapped || rows.every((row) => row.hierarchyLevel === null)) {
      return rows;
    }

    rows.forEach((row, rowIndex) => {
      if (row.hierarchyLevel === null) {
        return;
      }

      // Smartsheet outline helper columns usually show depth by row order. A row
      // is treated as a parent only when a later row has a deeper level before
      // the outline returns to the same or a shallower level. If every row is
      // level 0, this marks no parent rows.
      for (let nextIndex = rowIndex + 1; nextIndex < rows.length; nextIndex += 1) {
        const nextLevel = rows[nextIndex].hierarchyLevel;

        if (nextLevel === null) {
          continue;
        }

        if (nextLevel <= row.hierarchyLevel) {
          break;
        }

        row.hasChildRows = true;
        break;
      }
    });

    return rows;
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
    if (row.hasChildRows) {
      return "likely-summary";
    }

    const summarySignals = getLikelySummarySignals(row, parsedDates, mappingValues);

    // When hierarchy data is unavailable or inconclusive, this remains an
    // intentionally conservative estimate.
    // Row Type and Include in Critical Path mappings refine CPM eligibility
    // later; they do not infer summary status from task names.
    if (isLikelySummaryRow(summarySignals)) {
      return "likely-summary";
    }

    if (dateWarnings.length > 0) {
      return "warning";
    }

    return "detail";
  }

  function buildMovementValues(parsedDates, analyzerOptions) {
    const holidayDateSet = getHolidayDateSet(analyzerOptions);
    const startCalendarMovement = calculateCalendarDaysBetween(
      parsedDates.baselineStart.date,
      parsedDates.currentStart.date
    );
    const finishCalendarMovement = calculateCalendarDaysBetween(
      parsedDates.baselineFinish.date,
      parsedDates.currentFinish.date
    );
    const startWorkdayMovement = calculateWorkdaysMoved(
      parsedDates.baselineStart.date,
      parsedDates.currentStart.date,
      holidayDateSet
    );
    const finishWorkdayMovement = calculateWorkdaysMoved(
      parsedDates.baselineFinish.date,
      parsedDates.currentFinish.date,
      holidayDateSet
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

  function analyzeNormalizedRow(row, mappingValues, analyzerOptions) {
    const parsedDates = getParsedRowDates(row);
    const dateWarnings = getDateWarnings(parsedDates);
    const validForMovement = dateWarnings.length === 0;
    const classification = classifyScheduleRow(row, parsedDates, dateWarnings, mappingValues);
    const rowType = normalizeRowType(row.rowTypeRaw);
    const includeInCriticalPathOverride = parseIncludeInCriticalPathOverride(row.includeInCriticalPathRaw);
    const movementValues = validForMovement
      ? buildMovementValues(parsedDates, analyzerOptions)
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
      rowType,
      includeInCriticalPathOverride,
      classification,
      dateWarnings,
      excludeFromFutureCriticalPath: classification === "likely-summary" || row.hasChildRows,
      parsedDates,
      parsedPredecessors: [],
      resolvedPredecessors: [],
      dependencyWarnings: [],
      criticalPathEligible: false,
      criticalPathExclusionReason: "",
      validForMovement,
      ...movementValues
    };
  }

  function analyzeNormalizedRows(rows, mappingValues, analyzerOptions) {
    return rows.map((row) => analyzeNormalizedRow(row, mappingValues, analyzerOptions));
  }

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

  function getHolidayReportSummary(analyzerOptions) {
    const holidayDates = analyzerOptions && Array.isArray(analyzerOptions.holidayDates) ? analyzerOptions.holidayDates : [];
    const invalidHolidayEntries =
      analyzerOptions && Array.isArray(analyzerOptions.invalidHolidayEntries)
        ? analyzerOptions.invalidHolidayEntries
        : [];

    return {
      calendarUsed: holidayDates.length > 0,
      holidayDateCount: holidayDates.length,
      invalidHolidayEntryCount: invalidHolidayEntries.length
    };
  }

  function renderMovementSummary(summary, dependencySummary, analyzerOptions) {
    const movementSummary = getScheduleAnalyzerElement("scheduleMovementSummary");

    if (!movementSummary) {
      return;
    }

    const holidaySummary = getHolidayReportSummary(analyzerOptions);

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
    appendDescriptionItem(movementSummary, "Holiday calendar used", formatYesNo(holidaySummary.calendarUsed));
    appendDescriptionItem(
      movementSummary,
      "Unique holiday/non-working dates parsed",
      String(holidaySummary.holidayDateCount)
    );
    appendDescriptionItem(
      movementSummary,
      "Invalid holiday entries ignored",
      String(holidaySummary.invalidHolidayEntryCount)
    );
    appendDescriptionItem(
      movementSummary,
      "Rows with predecessor values",
      String(dependencySummary.rowsWithPredecessorValues)
    );
    appendDescriptionItem(
      movementSummary,
      "Total predecessor references parsed",
      String(dependencySummary.totalPredecessorReferences)
    );
    appendDescriptionItem(
      movementSummary,
      "Resolved predecessor links",
      String(dependencySummary.resolvedPredecessorLinks)
    );
    appendDescriptionItem(
      movementSummary,
      "Unresolved predecessor links",
      String(dependencySummary.unresolvedPredecessorLinks)
    );
    appendDescriptionItem(
      movementSummary,
      "Rows with dependency warnings",
      String(dependencySummary.rowsWithDependencyWarnings)
    );
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

  function renderDependencySummary(summary) {
    const dependencySummary = getScheduleAnalyzerElement("scheduleDependencySummary");

    if (!dependencySummary) {
      return;
    }

    dependencySummary.replaceChildren();

    appendDescriptionItem(dependencySummary, "Rows with predecessor values", String(summary.rowsWithPredecessorValues));
    appendDescriptionItem(
      dependencySummary,
      "Total predecessor references parsed",
      String(summary.totalPredecessorReferences)
    );
    appendDescriptionItem(dependencySummary, "Resolved predecessor links", String(summary.resolvedPredecessorLinks));
    appendDescriptionItem(
      dependencySummary,
      "Unresolved predecessor links",
      String(summary.unresolvedPredecessorLinks)
    );
    appendDescriptionItem(
      dependencySummary,
      "Predecessor links to likely-summary rows",
      String(summary.summaryPredecessorLinks)
    );
    appendDescriptionItem(dependencySummary, "Rows with dependency warnings", String(summary.rowsWithDependencyWarnings));
  }

  function buildDependencyWarningTableRow(issueLink) {
    const row = issueLink.row;
    const link = issueLink.link;

    return {
      sourceDataRowNumber: String(row.sourceDataRowNumber),
      excelRowNumber: String(row.excelRowNumber || ""),
      taskName: row.taskName,
      predecessorValue: link.predecessorValue,
      parsedReference: link.parsedReference,
      relationshipType: link.relationshipType,
      lagDays: String(link.lagDays),
      resolved: formatYesNo(link.resolved),
      issueMessage: link.issueMessage
    };
  }

  function renderDependencyWarningTable(issueLinks) {
    const dependencyWarningHeader = getScheduleAnalyzerElement("scheduleDependencyWarningHeader");
    const dependencyWarningBody = getScheduleAnalyzerElement("scheduleDependencyWarningBody");

    if (!dependencyWarningHeader || !dependencyWarningBody) {
      return;
    }

    dependencyWarningHeader.replaceChildren();
    dependencyWarningBody.replaceChildren();

    dependencyWarningColumns.forEach((column) => {
      const headerCell = document.createElement("th");
      headerCell.textContent = column.label;
      dependencyWarningHeader.appendChild(headerCell);
    });

    if (issueLinks.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");

      emptyCell.colSpan = dependencyWarningColumns.length;
      emptyCell.textContent = "No dependency warnings were found in the parsed predecessor values.";
      emptyRow.appendChild(emptyCell);
      dependencyWarningBody.appendChild(emptyRow);
      return;
    }

    issueLinks.forEach((issueLink) => {
      const tableRow = document.createElement("tr");
      const rowValues = buildDependencyWarningTableRow(issueLink);

      dependencyWarningColumns.forEach((column) => {
        appendTableCell(tableRow, rowValues[column.key]);
      });

      dependencyWarningBody.appendChild(tableRow);
    });
  }

  function renderDependencyValidation(result) {
    renderDependencySummary(result.dependencySummary);
    renderDependencyWarningTable(getDependencyIssueLinks(result.analyzedRows));
  }

  function formatCriticalPathFinishShift(summary) {
    if (summary.finishShiftWorkdays === "" || summary.finishShiftCalendarDays === "") {
      return "Not calculated";
    }

    return `${summary.finishShiftWorkdays} workdays (${summary.finishShiftCalendarDays} calendar days)`;
  }

  function formatCriticalPathWarnings(warnings) {
    return warnings.length > 0 ? warnings.join(" ") : "None";
  }

  function appendCriticalPathProjectSummary(criticalPathSummary, summary) {
    appendDescriptionItem(criticalPathSummary, "Project Name", summary.projectName);
    appendDescriptionItem(criticalPathSummary, "Eligible rows considered", String(summary.eligibleRowCount));
    appendDescriptionItem(
      criticalPathSummary,
      "Rows excluded as likely parent/summary rows",
      String(summary.excludedLikelySummaryRows)
    );
    appendDescriptionItem(
      criticalPathSummary,
      "Rows excluded by Row Type mapping",
      String(summary.excludedByRowTypeMapping)
    );
    appendDescriptionItem(
      criticalPathSummary,
      "Rows excluded by Include in Critical Path mapping",
      String(summary.excludedByIncludeMapping)
    );
    appendDescriptionItem(
      criticalPathSummary,
      "Baseline critical path task count",
      String(summary.baselineCriticalPathTaskCount)
    );
    appendDescriptionItem(
      criticalPathSummary,
      "Current critical path task count",
      String(summary.currentCriticalPathTaskCount)
    );
    appendDescriptionItem(
      criticalPathSummary,
      "Baseline estimated project finish",
      summary.baselineEstimatedProjectFinish
    );
    appendDescriptionItem(criticalPathSummary, "Current estimated project finish", summary.currentEstimatedProjectFinish);
    appendDescriptionItem(criticalPathSummary, "Estimated finish shift", formatCriticalPathFinishShift(summary));
    appendDescriptionItem(
      criticalPathSummary,
      "Critical path calculation warnings",
      formatCriticalPathWarnings(summary.warnings)
    );
  }

  function renderCriticalPathSummary(criticalPathResult) {
    const criticalPathSummary = getScheduleAnalyzerElement("scheduleCriticalPathSummary");

    if (!criticalPathSummary) {
      return;
    }

    criticalPathSummary.replaceChildren();

    const summary = criticalPathResult.summary;

    appendDescriptionItem(
      criticalPathSummary,
      "Project grouping column mapped",
      formatYesNo(summary.projectGroupingMapped)
    );
    appendDescriptionItem(criticalPathSummary, "Project groups analyzed", String(summary.projectGroupCount));
    appendDescriptionItem(
      criticalPathSummary,
      "Latest current estimated finish across project groups",
      summary.latestCurrentEstimatedProjectFinishAcrossProjectGroups
    );
    appendDescriptionItem(criticalPathSummary, "Eligible rows considered", String(summary.eligibleRowCount));
    appendDescriptionItem(
      criticalPathSummary,
      "Rows excluded as likely parent/summary rows",
      String(summary.excludedLikelySummaryRows)
    );
    appendDescriptionItem(
      criticalPathSummary,
      "Rows excluded by Row Type mapping",
      String(summary.excludedByRowTypeMapping)
    );
    appendDescriptionItem(
      criticalPathSummary,
      "Rows excluded by Include in Critical Path mapping",
      String(summary.excludedByIncludeMapping)
    );
    appendDescriptionItem(
      criticalPathSummary,
      "Baseline critical path task count",
      String(summary.baselineCriticalPathTaskCount)
    );
    appendDescriptionItem(
      criticalPathSummary,
      "Current critical path task count",
      String(summary.currentCriticalPathTaskCount)
    );
    appendDescriptionItem(
      criticalPathSummary,
      "Baseline estimated project finish",
      summary.baselineEstimatedProjectFinish
    );
    appendDescriptionItem(criticalPathSummary, "Current estimated project finish", summary.currentEstimatedProjectFinish);
    appendDescriptionItem(
      criticalPathSummary,
      "Estimated critical path finish shift",
      formatCriticalPathFinishShift(summary)
    );
    appendDescriptionItem(criticalPathSummary, "Tasks on both baseline and current path", String(summary.tasksOnBothPath));
    appendDescriptionItem(criticalPathSummary, "Tasks newly on current path", String(summary.tasksNewlyOnCurrentPath));
    appendDescriptionItem(criticalPathSummary, "Tasks no longer on current path", String(summary.tasksNoLongerOnCurrentPath));
    appendDescriptionItem(
      criticalPathSummary,
      "Critical path calculation warnings",
      formatCriticalPathWarnings(summary.warnings)
    );

    appendDescriptionItem(
      criticalPathSummary,
      "Critical path grouping note",
      "When a Project Name / Project Grouping column is mapped, estimated critical paths are calculated separately for each project group."
    );

    criticalPathResult.projectSummaries.forEach((projectSummary) => {
      appendCriticalPathProjectSummary(criticalPathSummary, projectSummary);
    });
  }

  function getCriticalPathDetailValue(row, columnKey) {
    if (
      columnKey === "baselineStart" ||
      columnKey === "baselineFinish" ||
      columnKey === "currentStart" ||
      columnKey === "currentFinish"
    ) {
      return formatDateForDetail(row, columnKey);
    }

    if (columnKey === "finishWorkdayMovement") {
      return formatMovementValue(row, columnKey);
    }

    return row[columnKey] === undefined ? "" : String(row[columnKey]);
  }

  function renderCriticalPathDetailTable(rows) {
    const criticalPathDetailHeader = getScheduleAnalyzerElement("scheduleCriticalPathDetailHeader");
    const criticalPathDetailBody = getScheduleAnalyzerElement("scheduleCriticalPathDetailBody");

    if (!criticalPathDetailHeader || !criticalPathDetailBody) {
      return;
    }

    criticalPathDetailHeader.replaceChildren();
    criticalPathDetailBody.replaceChildren();

    criticalPathDetailColumns.forEach((column) => {
      const headerCell = document.createElement("th");
      headerCell.textContent = column.label;
      criticalPathDetailHeader.appendChild(headerCell);
    });

    if (rows.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");

      emptyCell.colSpan = criticalPathDetailColumns.length;
      emptyCell.textContent = "No current estimated critical path rows were available.";
      emptyRow.appendChild(emptyCell);
      criticalPathDetailBody.appendChild(emptyRow);
      return;
    }

    rows
      .slice()
      .sort((firstRow, secondRow) => {
        const projectCompare = firstRow.projectName.localeCompare(secondRow.projectName);

        if (projectCompare !== 0) {
          return projectCompare;
        }

        return firstRow.criticalPathSequenceCurrent - secondRow.criticalPathSequenceCurrent;
      })
      .forEach((row) => {
        const tableRow = document.createElement("tr");

        criticalPathDetailColumns.forEach((column) => {
          appendTableCell(tableRow, getCriticalPathDetailValue(row, column.key));
        });

        criticalPathDetailBody.appendChild(tableRow);
      });
  }

  function renderCriticalPathAnalysis(result) {
    renderCriticalPathSummary(result.criticalPathResult);
    renderCriticalPathDetailTable(result.criticalPathResult.currentPathRows);
  }

  function renderMovementAnalysis(result) {
    const resultsPanel = getScheduleAnalyzerElement("schedulePhase3Results");

    if (resultsPanel) {
      resultsPanel.hidden = false;
    }

    renderMovementSummary(result.movementSummary, result.dependencySummary, result.analyzerOptions);
    renderMovementDetailTable(getDisplayedMovementRows(result.analyzedRows));
    renderDependencyValidation(result);
    renderCriticalPathAnalysis(result);
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

  function formatIncludeInCriticalPathOverride(value) {
    if (value === true) {
      return "Yes";
    }

    if (value === false) {
      return "No";
    }

    return "";
  }

  function getWarningsText(row) {
    return row.dateWarnings.length > 0 ? row.dateWarnings.join(" ") : "";
  }

  function getReportMovementValue(row, key) {
    return row.validForMovement ? row[key] : "";
  }

  function getReportHierarchyLevel(row) {
    return row.hierarchyLevel === null || row.hierarchyLevel === undefined ? "" : row.hierarchyLevel;
  }

  function buildScheduleReportRow(row) {
    return {
      "Project Name": row.projectName,
      "Task ID": row.taskId,
      "Task / Milestone": row.taskName,
      "Row Classification": row.classification,
      "Row Type": row.rowType,
      "Include in Critical Path?": formatIncludeInCriticalPathOverride(row.includeInCriticalPathOverride),
      "Hierarchy Level": getReportHierarchyLevel(row),
      "Has Child Rows": formatYesNo(row.hasChildRows),
      "Critical Path Eligible": formatYesNo(row.criticalPathEligible),
      "Critical Path Exclusion Reason": row.criticalPathExclusionReason,
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
      "Project Name": row.projectName,
      "Task ID": row.taskId,
      "Task / Milestone": row.taskName,
      "Row Classification": row.classification,
      "Row Type": row.rowType,
      "Include in Critical Path?": formatIncludeInCriticalPathOverride(row.includeInCriticalPathOverride),
      "Hierarchy Level": getReportHierarchyLevel(row),
      "Has Child Rows": formatYesNo(row.hasChildRows),
      "Critical Path Eligible": formatYesNo(row.criticalPathEligible),
      "Critical Path Exclusion Reason": row.criticalPathExclusionReason,
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

  function buildDependencyReportRow(issueLink) {
    const row = issueLink.row;
    const link = issueLink.link;

    return {
      "Source Row Number": row.sourceDataRowNumber,
      "Excel Row Number": row.excelRowNumber,
      "Task ID": row.taskId,
      "Task / Milestone": row.taskName,
      "Row Classification": row.classification,
      "Predecessor Value": link.predecessorValue,
      "Parsed Reference": link.parsedReference,
      "Relationship Type": link.relationshipType,
      "Lag Days": link.lagDays,
      "Resolved?": formatYesNo(link.resolved),
      "Resolved Task ID": link.predecessorTaskId,
      "Resolved Task / Milestone": link.predecessorTaskName,
      "Issue / Warning": link.issueMessage
    };
  }

  function getAllDependencyLinks(rows) {
    return rows.flatMap((row) => {
      return row.resolvedPredecessors.map((link) => {
        return {
          row,
          link
        };
      });
    });
  }

  function isDependencyLinkIncludedInCriticalPathLogic(row, link) {
    return (
      link.resolved &&
      link.predecessorRow &&
      row.criticalPathEligible &&
      link.predecessorRow.criticalPathEligible &&
      isSameProjectGroup(row, link.predecessorRow) &&
      isSupportedCriticalPathRelationship(link.relationshipType) &&
      link.issueMessages.length === 0
    );
  }

  function getAllDependencyLinkIssueText(row, link) {
    const issues = [...link.issueMessages];

    if (link.resolved && link.predecessorRow) {
      if (!isSameProjectGroup(row, link.predecessorRow)) {
        issues.push("Cross-project predecessor link omitted from estimated critical path.");
      }

      if (!row.criticalPathEligible) {
        issues.push(`Successor is not eligible for estimated critical path: ${row.criticalPathExclusionReason}.`);
      }

      if (!link.predecessorRow.criticalPathEligible) {
        issues.push(
          `Predecessor is not eligible for estimated critical path: ${link.predecessorRow.criticalPathExclusionReason}.`
        );
      }
    }

    if (!isSupportedCriticalPathRelationship(link.relationshipType)) {
      issues.push("Relationship type is not supported by estimated critical path logic.");
    }

    return Array.from(new Set(issues.filter((issue) => issue !== ""))).join(" ");
  }

  function buildAllDependencyLinkReportRow(dependencyLink) {
    const row = dependencyLink.row;
    const link = dependencyLink.link;
    const predecessorRow = link.predecessorRow || null;

    return {
      "Project Name": row.projectName,
      "Successor Row Number": row.sourceDataRowNumber,
      "Successor Task ID": row.taskId,
      "Successor Task Name": row.taskName,
      "Successor Row Type": row.rowType,
      "Successor Critical Path Eligible": formatYesNo(row.criticalPathEligible),
      "Successor Critical Path Exclusion Reason": row.criticalPathExclusionReason,
      "Predecessor Reference": link.originalText || link.parsedReference,
      "Relationship Type": link.relationshipType,
      "Lag Days": link.lagDays,
      "Resolved Predecessor Row Number": predecessorRow ? predecessorRow.sourceDataRowNumber : "",
      "Resolved Predecessor Task ID": predecessorRow ? predecessorRow.taskId : "",
      "Resolved Predecessor Task Name": predecessorRow ? predecessorRow.taskName : "",
      "Predecessor Row Type": predecessorRow ? predecessorRow.rowType : "",
      "Predecessor Critical Path Eligible": predecessorRow ? formatYesNo(predecessorRow.criticalPathEligible) : "",
      "Predecessor Critical Path Exclusion Reason": predecessorRow
        ? predecessorRow.criticalPathExclusionReason
        : "",
      "Is Cross-Project Link?": predecessorRow ? formatYesNo(!isSameProjectGroup(row, predecessorRow)) : "",
      "Link Included in Critical Path Logic?": formatYesNo(isDependencyLinkIncludedInCriticalPathLogic(row, link)),
      "Warning / Issue": getAllDependencyLinkIssueText(row, link)
    };
  }

  function buildCriticalPathReportRow(row, pathType, sequence) {
    return {
      "Project Name": row.projectName,
      "Path Type": pathType,
      Sequence: sequence,
      "Task ID": row.taskId,
      "Task / Milestone": row.taskName,
      "Row Classification": row.classification,
      "Row Type": row.rowType,
      "Include in Critical Path?": formatIncludeInCriticalPathOverride(row.includeInCriticalPathOverride),
      "Hierarchy Level": getReportHierarchyLevel(row),
      "Has Child Rows": formatYesNo(row.hasChildRows),
      "Critical Path Eligible": formatYesNo(row.criticalPathEligible),
      "Critical Path Exclusion Reason": row.criticalPathExclusionReason,
      "Baseline Start": formatDateForDetail(row, "baselineStart"),
      "Baseline Finish": formatDateForDetail(row, "baselineFinish"),
      "Current Start": formatDateForDetail(row, "currentStart"),
      "Current Finish": formatDateForDetail(row, "currentFinish"),
      "Finish Calendar Movement": getReportMovementValue(row, "finishCalendarMovement"),
      "Finish Workday Movement": getReportMovementValue(row, "finishWorkdayMovement"),
      "Movement Status": row.movementDirection,
      "Critical Path Status": row.criticalPathStatus,
      "Baseline Critical Path Sequence": row.criticalPathSequenceBaseline,
      "Current Critical Path Sequence": row.criticalPathSequenceCurrent,
      Predecessors: row.predecessors,
      "Excluded From Future Critical Path": formatYesNo(row.excludeFromFutureCriticalPath)
    };
  }

  function buildCriticalPathReportRows(result) {
    return result.criticalPathResult.projectResults.flatMap((projectResult) => {
      const baselineRows = projectResult.baselinePathRows.map((row) => {
        return buildCriticalPathReportRow(row, "Baseline", row.criticalPathSequenceBaseline);
      });
      const currentRows = projectResult.currentPathRows.map((row) => {
        return buildCriticalPathReportRow(row, "Current", row.criticalPathSequenceCurrent);
      });

      return [...baselineRows, ...currentRows];
    });
  }

  function getWarningReportRows(rows) {
    return rows.filter((row) => row.dateWarnings.length > 0 || !row.validForMovement);
  }

  function buildExecutiveSummaryRows(result) {
    const summary = result.movementSummary;
    const criticalPathSummary = result.criticalPathResult.summary;
    const holidaySummary = getHolidayReportSummary(result.analyzerOptions);

    return [
      ["Source workbook file", result.fileName],
      ["Worksheet used", result.worksheetName],
      ["Analysis generated timestamp", formatReportTimestamp(result.analysisGeneratedAt)],
      ["Holiday/non-working calendar used", formatYesNo(holidaySummary.calendarUsed)],
      ["Unique holiday/non-working dates parsed", holidaySummary.holidayDateCount],
      ["Invalid holiday entries ignored", holidaySummary.invalidHolidayEntryCount],
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
      ["Rows with predecessor values", result.dependencySummary.rowsWithPredecessorValues],
      ["Total predecessor references parsed", result.dependencySummary.totalPredecessorReferences],
      ["Resolved predecessor links", result.dependencySummary.resolvedPredecessorLinks],
      ["Unresolved predecessor links", result.dependencySummary.unresolvedPredecessorLinks],
      ["Rows with dependency warnings", result.dependencySummary.rowsWithDependencyWarnings],
      ["Project grouping column mapped", formatYesNo(criticalPathSummary.projectGroupingMapped)],
      ["Number of project groups analyzed", criticalPathSummary.projectGroupCount],
      [
        "Latest current estimated project finish across project groups",
        criticalPathSummary.latestCurrentEstimatedProjectFinishAcrossProjectGroups
      ],
      ["Eligible critical path rows considered", criticalPathSummary.eligibleRowCount],
      ["Rows excluded as likely parent/summary rows", criticalPathSummary.excludedLikelySummaryRows],
      ["Rows excluded from estimated critical path by Row Type mapping", criticalPathSummary.excludedByRowTypeMapping],
      [
        "Rows excluded from estimated critical path by Include in Critical Path mapping",
        criticalPathSummary.excludedByIncludeMapping
      ],
      ["Baseline critical path task count", criticalPathSummary.baselineCriticalPathTaskCount],
      ["Current critical path task count", criticalPathSummary.currentCriticalPathTaskCount],
      ["Baseline estimated project finish", criticalPathSummary.baselineEstimatedProjectFinish],
      ["Current estimated project finish", criticalPathSummary.currentEstimatedProjectFinish],
      ["Estimated critical path finish shift", formatCriticalPathFinishShift(criticalPathSummary)],
      ["Tasks on both baseline and current path", criticalPathSummary.tasksOnBothPath],
      ["Tasks newly on current path", criticalPathSummary.tasksNewlyOnCurrentPath],
      ["Tasks no longer on current path", criticalPathSummary.tasksNoLongerOnCurrentPath],
      ["Critical path calculation warnings", formatCriticalPathWarnings(criticalPathSummary.warnings)],
      ["Largest finish delay", formatMovementSummaryRow(summary.largestFinishDelay)],
      ["Largest finish acceleration", formatMovementSummaryRow(summary.largestFinishAcceleration)],
      [
        "Note",
        "Parent/summary rows are excluded from estimated critical path analysis when hierarchy data or fallback heuristics identify them."
      ],
      [
        "Note",
        "When a Project Name / Project Grouping column is mapped, estimated critical paths are calculated separately for each project group."
      ],
      ["Note", "The analyzer works best when a Row Hierarchy / Outline Level helper column is mapped."],
      [
        "Note",
        "Holiday/non-working dates are excluded from workday movement and estimated finish-shift workday metrics in addition to weekends."
      ],
      ["Note", "This is not a full replacement for Smartsheet, P6, or MS Project CPM calculations."]
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
    const dependencyIssueLinks = getDependencyIssueLinks(result.analyzedRows);
    const allDependencyLinks = getAllDependencyLinks(result.analyzedRows);
    const criticalPathRows = buildCriticalPathReportRows(result);

    addAoaWorksheet(reportWorkbook, reportSheetNames.executiveSummary, buildExecutiveSummaryRows(result), [36, 80]);
    addJsonWorksheet(
      reportWorkbook,
      reportSheetNames.changedItems,
      changedRows.map((row) => buildScheduleReportRow(row)),
      scheduleReportHeaders,
      [26, 16, 34, 22, 18, 24, 16, 16, 22, 38, 16, 16, 22, 22, 16, 16, 22, 22, 26, 18, 20, 46, 30]
    );
    addJsonWorksheet(
      reportWorkbook,
      reportSheetNames.allItems,
      result.analyzedRows.map((row) => buildScheduleReportRow(row)),
      scheduleReportHeaders,
      [26, 16, 34, 22, 18, 24, 16, 16, 22, 38, 16, 16, 22, 22, 16, 16, 22, 22, 26, 18, 20, 46, 30]
    );
    addJsonWorksheet(
      reportWorkbook,
      reportSheetNames.warnings,
      warningRows.map((row) => buildWarningReportRow(row)),
      warningReportHeaders,
      [26, 16, 34, 22, 18, 24, 16, 16, 22, 38, 16, 16, 16, 16, 26, 52, 34, 30]
    );
    addJsonWorksheet(
      reportWorkbook,
      reportSheetNames.dependencyValidation,
      dependencyIssueLinks.map((issueLink) => buildDependencyReportRow(issueLink)),
      dependencyReportHeaders,
      [18, 16, 16, 34, 22, 24, 18, 18, 12, 12, 18, 34, 52]
    );
    addJsonWorksheet(
      reportWorkbook,
      reportSheetNames.allDependencyLinks,
      allDependencyLinks.map((dependencyLink) => buildAllDependencyLinkReportRow(dependencyLink)),
      allDependencyLinkReportHeaders,
      [26, 18, 18, 34, 18, 22, 36, 22, 18, 12, 26, 22, 34, 18, 24, 38, 20, 28, 58]
    );
    addJsonWorksheet(
      reportWorkbook,
      reportSheetNames.estimatedCriticalPath,
      criticalPathRows,
      criticalPathReportHeaders,
      [26, 14, 12, 16, 34, 22, 18, 24, 16, 16, 22, 38, 16, 16, 16, 16, 22, 22, 26, 22, 28, 28, 20, 30]
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

  function parseWorkbookRows(workbook, selectedFile, mappingValues, analyzerOptions) {
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
    const normalizedRows = addHierarchyAnalysis(
      addProjectGroupingAnalysis(buildNormalizedRows(dataRows, mappedColumns, headerIndexByName, mappingValues), mappingValues),
      mappingValues
    );
    const analyzedRows = addDependencyAnalysis(analyzeNormalizedRows(normalizedRows, mappingValues, analyzerOptions));
    const criticalPathResult = addCriticalPathAnalysis(analyzedRows, mappingValues, analyzerOptions);
    const movementSummary = buildMovementSummary(analyzedRows);
    const dependencySummary = buildDependencySummary(analyzedRows);

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
      dependencySummary,
      criticalPathResult,
      mappedColumns,
      mappingValues,
      analyzerOptions
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
      const analyzerOptions = getHolidaySettings();
      const fileContents = await readFileAsArrayBuffer(selectedFile);
      const workbook = window.XLSX.read(fileContents, { type: "array", cellDates: true });
      const parseResult = parseWorkbookRows(workbook, selectedFile, mappingValues, analyzerOptions);

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
    const holidayInput = getScheduleAnalyzerElement("scheduleHolidayDates");

    if (fileInput) {
      fileInput.addEventListener("change", clearSchedulePreview);
    }

    if (holidayInput) {
      holidayInput.addEventListener("input", clearSchedulePreview);
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

    initializeDefaultHolidayInput();

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
