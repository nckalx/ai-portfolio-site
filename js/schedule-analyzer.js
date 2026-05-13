// Phase 2 shell for the uploaded Smartsheet .xlsx schedule analyzer.
//
// Later phases can add:
// - schedule movement calculations using the normalized mapped rows,
// - predecessor parsing and dependency/data-quality warnings,
// - estimated critical path logic,
// - generated Excel summary export logic.
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

  let normalizedScheduleRows = [];

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

  function clearSchedulePreview() {
    const previewPanel = getScheduleAnalyzerElement("scheduleAnalyzerPreview");
    const summaryList = getScheduleAnalyzerElement("scheduleWorkbookSummary");
    const mappedColumnsList = getScheduleAnalyzerElement("scheduleMappedColumns");
    const previewHeader = getScheduleAnalyzerElement("schedulePreviewHeader");
    const previewBody = getScheduleAnalyzerElement("schedulePreviewBody");

    if (previewPanel) {
      previewPanel.hidden = true;
    }

    [summaryList, mappedColumnsList, previewHeader, previewBody].forEach((element) => {
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

  function appendDescriptionItem(list, term, description) {
    const termElement = document.createElement("dt");
    const descriptionElement = document.createElement("dd");

    termElement.textContent = term;
    descriptionElement.textContent = description;
    list.appendChild(termElement);
    list.appendChild(descriptionElement);
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

    normalizedScheduleRows = normalizedRows;

    return {
      ok: true,
      fileName: selectedFile.name,
      worksheetName: firstWorksheet.name,
      detectedColumnCount,
      unmappedColumnCount,
      dataRowCount: dataRows.length,
      normalizedRows,
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
      setScheduleAnalyzerStatus(
        "Workbook parsed successfully. Mapped columns were validated and unrelated columns were ignored. Movement calculations will be added in Phase 3.",
        "is-ready"
      );
    } catch (error) {
      normalizedScheduleRows = [];
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
    const analyzerForm = getScheduleAnalyzerElement("scheduleAnalyzerForm");

    if (analyzerForm) {
      analyzerForm.addEventListener("submit", (event) => {
        event.preventDefault();
      });
    }

    if (analyzeButton) {
      analyzeButton.addEventListener("click", handleAnalyzeUploadedSchedule);
    }

    wirePreviewResetEvents();
  }

  wireScheduleAnalyzerEvents();
})();
