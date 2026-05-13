// Phase 1 shell for the future uploaded Smartsheet .xlsx schedule analyzer.
//
// Later phases can add:
// - client-side .xlsx parsing for exported Smartsheet workbooks,
// - validation that mapped columns exist in the selected workbook,
// - schedule movement calculations using only mapped columns,
// - predecessor parsing and dependency/data-quality warnings,
// - estimated critical path logic,
// - generated Excel summary export logic.
//
// This file intentionally does not call the Smartsheet API and does not parse
// workbook contents yet. Extra exported columns should be ignored by future
// analysis unless the user maps them.

(() => {
  const requiredScheduleMappings = [
    { id: "scheduleTaskNameColumn", label: "Task or Milestone Name column" },
    { id: "scheduleBaselineStartColumn", label: "Baseline Start column" },
    { id: "scheduleBaselineFinishColumn", label: "Baseline Finish column" },
    { id: "scheduleCurrentStartColumn", label: "Actual / Current Start column" },
    { id: "scheduleCurrentFinishColumn", label: "Actual / Current Finish column" },
    { id: "schedulePredecessorsColumn", label: "Predecessors column" }
  ];

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

  function getMissingRequiredScheduleMappings() {
    return requiredScheduleMappings.filter((mapping) => {
      const input = getScheduleAnalyzerElement(mapping.id);
      return !input || input.value.trim() === "";
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

  function handleAnalyzeUploadedSchedule() {
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

    setScheduleAnalyzerStatus(
      `The upload shell is ready for ${selectedFile.name}. Workbook parsing and schedule calculations will be added in Phase 2.`,
      "is-ready"
    );
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
  }

  wireScheduleAnalyzerEvents();
})();
