const scheduleData = [
  {
    milestone: "Design Complete",
    originalDate: "2026-02-06",
    newDate: "2026-02-13"
  },
  {
    milestone: "Permit Submitted",
    originalDate: "2026-03-02",
    newDate: "2026-02-27"
  },
  {
    milestone: "Construction Start",
    originalDate: "2026-04-01",
    newDate: "2026-04-01"
  },
  {
    milestone: "Substantial Completion",
    originalDate: "2026-06-15",
    newDate: "2026-06-29"
  }
];

const formulaBuilderConfigs = {
  totalDateLabel: {
    fields: [
      {
        id: "milestoneLabelColumn",
        label: "Milestone label column",
        defaultValue: "Milestone Label",
        help: "The current-sheet column that stores the readable milestone name."
      },
      {
        id: "totalDateColumn",
        label: "Total date column",
        defaultValue: "Total Date",
        help: "The current-sheet date column to append when it has a value."
      }
    ],
    buildFormula(values) {
      return (
        `=IF(ISBLANK(${rowColumn(values.totalDateColumn)}), ` +
        `${rowColumn(values.milestoneLabelColumn)}, ` +
        `${rowColumn(values.milestoneLabelColumn)} + " - " + ${rowColumn(values.totalDateColumn)})`
      );
    },
    getReferences() {
      return [];
    },
    getInstructions(values) {
      return [
        `Add this formula to the helper column where you want the combined label to appear.`,
        `Confirm the column names match ${values.milestoneLabelColumn} and ${values.totalDateColumn}.`,
        `Use a Text/Number column for the formula output.`
      ];
    }
  },
  scheduleMovedWorkdays: {
    fields: [
      {
        id: "originalDateColumn",
        label: "Original date column",
        defaultValue: "Original Date",
        help: "The baseline or previous milestone date on the current sheet."
      },
      {
        id: "updatedDateColumn",
        label: "Updated date column",
        defaultValue: "New Date",
        help: "The current or revised milestone date on the current sheet."
      }
    ],
    buildFormula(values) {
      return (
        `=IF(OR(ISBLANK(${rowColumn(values.originalDateColumn)}), ` +
        `ISBLANK(${rowColumn(values.updatedDateColumn)})), "", ` +
        `IF(${rowColumn(values.updatedDateColumn)} >= ${rowColumn(values.originalDateColumn)}, ` +
        `NETWORKDAYS(${rowColumn(values.originalDateColumn)}, ${rowColumn(values.updatedDateColumn)}) - 1, ` +
        `-(NETWORKDAYS(${rowColumn(values.updatedDateColumn)}, ${rowColumn(values.originalDateColumn)}) - 1)))`
      );
    },
    getReferences() {
      return [];
    },
    getInstructions(values) {
      return [
        `Add this formula to a Text/Number column on the same sheet as the date columns.`,
        `Positive values mean ${values.updatedDateColumn} is later than ${values.originalDateColumn}.`,
        `Negative values mean the milestone moved earlier. NETWORKDAYS excludes Saturdays and Sundays.`
      ];
    }
  },
  twoCriteriaLookup: {
    fields: [
      {
        id: "lookupCurrentCriteriaOneColumn",
        label: "Current sheet criteria column 1",
        defaultValue: "Project ID",
        help: "The first value to match from the current row."
      },
      {
        id: "lookupCurrentCriteriaTwoColumn",
        label: "Current sheet criteria column 2",
        defaultValue: "Milestone",
        help: "The second value to match from the current row."
      },
      {
        id: "lookupSourceSheetName",
        label: "Source sheet name",
        defaultValue: "Master Schedule",
        help: "The Smartsheet sheet that contains the lookup data."
      },
      {
        id: "lookupSourceReturnColumn",
        label: "Source return column",
        defaultValue: "Forecast Date",
        help: "The source-sheet column that contains the value you want returned."
      },
      {
        id: "lookupSourceCriteriaOneColumn",
        label: "Source criteria column 1",
        defaultValue: "Project ID",
        help: "The source-sheet column that should match criteria column 1."
      },
      {
        id: "lookupSourceCriteriaTwoColumn",
        label: "Source criteria column 2",
        defaultValue: "Milestone",
        help: "The source-sheet column that should match criteria column 2."
      },
      {
        id: "lookupReturnReference",
        label: "Return range reference name",
        defaultValue: "Lookup Result Range",
        help: "The name to use for the cross-sheet return range."
      },
      {
        id: "lookupCriteriaOneReference",
        label: "Criteria 1 range reference name",
        defaultValue: "Lookup Project ID Range",
        help: "The name to use for the first cross-sheet criteria range."
      },
      {
        id: "lookupCriteriaTwoReference",
        label: "Criteria 2 range reference name",
        defaultValue: "Lookup Milestone Range",
        help: "The name to use for the second cross-sheet criteria range."
      }
    ],
    buildFormula(values) {
      return (
        `=IFERROR(INDEX(COLLECT(${sheetReference(values.lookupReturnReference)}, ` +
        `${sheetReference(values.lookupCriteriaOneReference)}, ${rowColumn(values.lookupCurrentCriteriaOneColumn)}, ` +
        `${sheetReference(values.lookupCriteriaTwoReference)}, ${rowColumn(values.lookupCurrentCriteriaTwoColumn)}), 1), "")`
      );
    },
    getReferences(values) {
      return [
        {
          name: values.lookupReturnReference,
          sheet: values.lookupSourceSheetName,
          range: values.lookupSourceReturnColumn
        },
        {
          name: values.lookupCriteriaOneReference,
          sheet: values.lookupSourceSheetName,
          range: values.lookupSourceCriteriaOneColumn
        },
        {
          name: values.lookupCriteriaTwoReference,
          sheet: values.lookupSourceSheetName,
          range: values.lookupSourceCriteriaTwoColumn
        }
      ];
    },
    getInstructions(values) {
      return [
        `Create each cross-sheet reference from the source sheet named ${values.lookupSourceSheetName}.`,
        `Make sure each reference points to a full column or same-height range on the source sheet.`,
        `Paste the formula into the current sheet where you want ${values.lookupSourceReturnColumn} returned.`
      ];
    }
  },
  checkboxMatch: {
    fields: [
      {
        id: "checkboxCurrentMatchColumn",
        label: "Current sheet match column",
        defaultValue: "Milestone ID",
        help: "The value from the current row to search for in another sheet."
      },
      {
        id: "checkboxSourceSheetName",
        label: "Source sheet name",
        defaultValue: "RIO Log",
        help: "The sheet that contains the matching IDs."
      },
      {
        id: "checkboxSourceMatchColumn",
        label: "Source match column",
        defaultValue: "Related Milestone ID",
        help: "The source-sheet column that should contain the current row value."
      },
      {
        id: "checkboxMatchReference",
        label: "Match range reference name",
        defaultValue: "Source Match Range",
        help: "The name to use for the cross-sheet match range."
      }
    ],
    buildFormula(values) {
      return `=IF(COUNTIF(${sheetReference(values.checkboxMatchReference)}, ${rowColumn(values.checkboxCurrentMatchColumn)}) > 0, 1, 0)`;
    },
    getReferences(values) {
      return [
        {
          name: values.checkboxMatchReference,
          sheet: values.checkboxSourceSheetName,
          range: values.checkboxSourceMatchColumn
        }
      ];
    },
    getInstructions(values) {
      return [
        `Create the cross-sheet reference from ${values.checkboxSourceSheetName}.`,
        `Select the source column named ${values.checkboxSourceMatchColumn}.`,
        `Paste the formula into a Checkbox column on the current sheet.`
      ];
    }
  },
  rioIdLookup: {
    fields: [
      {
        id: "rioCurrentIdColumn",
        label: "Current sheet milestone ID column",
        defaultValue: "Milestone ID",
        help: "The current row value used to find a related RIO item."
      },
      {
        id: "rioSourceSheetName",
        label: "RIO source sheet name",
        defaultValue: "RIO Log",
        help: "The Risk, Issue, and Opportunity log that stores RIO IDs."
      },
      {
        id: "rioSourceIdColumn",
        label: "Source RIO ID column",
        defaultValue: "RIO ID",
        help: "The source-sheet column that contains the RIO ID to return."
      },
      {
        id: "rioSourceMatchColumn",
        label: "Source match column",
        defaultValue: "Related Milestone ID",
        help: "The source-sheet column that links a RIO item to the current milestone."
      },
      {
        id: "rioIdReference",
        label: "RIO ID range reference name",
        defaultValue: "RIO ID Range",
        help: "The name to use for the cross-sheet RIO ID range."
      },
      {
        id: "rioMatchReference",
        label: "RIO match range reference name",
        defaultValue: "RIO Match ID Range",
        help: "The name to use for the cross-sheet match range."
      }
    ],
    buildFormula(values) {
      return (
        `=IFERROR(INDEX(COLLECT(${sheetReference(values.rioIdReference)}, ` +
        `${sheetReference(values.rioMatchReference)}, ${rowColumn(values.rioCurrentIdColumn)}), 1), "")`
      );
    },
    getReferences(values) {
      return [
        {
          name: values.rioIdReference,
          sheet: values.rioSourceSheetName,
          range: values.rioSourceIdColumn
        },
        {
          name: values.rioMatchReference,
          sheet: values.rioSourceSheetName,
          range: values.rioSourceMatchColumn
        }
      ];
    },
    getInstructions(values) {
      return [
        `Create both cross-sheet references from ${values.rioSourceSheetName}.`,
        `Use ${values.rioSourceIdColumn} as the return range and ${values.rioSourceMatchColumn} as the match range.`,
        `Paste the formula into the current sheet where the related RIO ID should appear.`
      ];
    }
  }
};

function rowColumn(columnName) {
  return `[${columnName}]@row`;
}

function sheetReference(referenceName) {
  return `{${referenceName}}`;
}

function parseDate(dateString) {
  const dateParts = dateString.split("-").map(Number);
  return new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
}

function formatDate(dateString) {
  const date = parseDate(dateString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

function calculateCalendarDaysMoved(originalDate, newDate) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseDate(newDate) - parseDate(originalDate)) / millisecondsPerDay);
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

function calculateWorkdaysMoved(originalDate, newDate) {
  const original = parseDate(originalDate);
  const updated = parseDate(newDate);

  if (updated.getTime() === original.getTime()) {
    return 0;
  }

  if (updated > original) {
    return countWeekdaysInclusive(original, updated) - 1;
  }

  return -(countWeekdaysInclusive(updated, original) - 1);
}

function getMovementDirection(daysMoved) {
  if (daysMoved > 0) {
    return "Delayed";
  }

  if (daysMoved < 0) {
    return "Accelerated";
  }

  return "Unchanged";
}

function analyzeSchedule() {
  const tableBody = document.getElementById("scheduleResultsTable");
  const summaryBox = document.getElementById("scheduleSummary");

  tableBody.innerHTML = "";

  let delayedCount = 0;
  let acceleratedCount = 0;
  let unchangedCount = 0;

  scheduleData.forEach((item) => {
    const calendarDaysMoved = calculateCalendarDaysMoved(item.originalDate, item.newDate);
    const workdaysMoved = calculateWorkdaysMoved(item.originalDate, item.newDate);
    const direction = getMovementDirection(calendarDaysMoved);

    if (direction === "Delayed") {
      delayedCount += 1;
    } else if (direction === "Accelerated") {
      acceleratedCount += 1;
    } else {
      unchangedCount += 1;
    }

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${item.milestone}</td>
      <td>${formatDate(item.originalDate)}</td>
      <td>${formatDate(item.newDate)}</td>
      <td>${calendarDaysMoved}</td>
      <td>${workdaysMoved}</td>
      <td>${direction}</td>
    `;

    tableBody.appendChild(row);
  });

  summaryBox.textContent =
    `Analyzed ${scheduleData.length} milestones: ` +
    `${delayedCount} delayed, ` +
    `${acceleratedCount} accelerated, ` +
    `${unchangedCount} unchanged. ` +
    `Workday movement excludes Saturdays and Sundays.`;
}

function createFormulaInput(field) {
  const fieldWrapper = document.createElement("div");
  fieldWrapper.className = "builder-field";

  const label = document.createElement("label");
  label.setAttribute("for", field.id);
  label.textContent = field.label;

  const input = document.createElement("input");
  input.id = field.id;
  input.type = "text";
  input.value = field.defaultValue;
  input.addEventListener("input", renderFormulaBuilderOutput);

  const helpText = document.createElement("p");
  helpText.className = "field-help";
  helpText.textContent = field.help;

  fieldWrapper.appendChild(label);
  fieldWrapper.appendChild(input);
  fieldWrapper.appendChild(helpText);

  return fieldWrapper;
}

function getFormulaValues(config) {
  const values = {};

  config.fields.forEach((field) => {
    const input = document.getElementById(field.id);
    values[field.id] = input.value.trim();
  });

  return values;
}

function getMissingFields(config, values) {
  return config.fields.filter((field) => values[field.id] === "");
}

function renderList(container, listClassName, items) {
  const list = document.createElement(listClassName === "setup-steps" ? "ol" : "ul");
  list.className = listClassName;

  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    list.appendChild(listItem);
  });

  container.appendChild(list);
}

function renderReferenceInstructions(config, values) {
  const referenceInstructions = document.getElementById("referenceInstructions");
  const references = config.getReferences(values);
  const instructions = config.getInstructions(values);

  referenceInstructions.innerHTML = "";

  const referenceHeading = document.createElement("h3");
  referenceHeading.textContent = references.length > 0 ? "Cross-sheet references" : "Setup notes";
  referenceInstructions.appendChild(referenceHeading);

  if (references.length > 0) {
    const referenceIntro = document.createElement("p");
    referenceIntro.textContent = "Create these named reference placeholders in Smartsheet before using the formula.";
    referenceInstructions.appendChild(referenceIntro);

    const referenceItems = references.map((reference) => {
      return `{${reference.name}}: in "${reference.sheet}", select the "${reference.range}" column.`;
    });

    renderList(referenceInstructions, "reference-list", referenceItems);
  } else {
    const noReferenceText = document.createElement("p");
    noReferenceText.textContent = "This formula only uses columns from the current sheet.";
    referenceInstructions.appendChild(noReferenceText);
  }

  const instructionHeading = document.createElement("h3");
  instructionHeading.textContent = "How to use it";
  referenceInstructions.appendChild(instructionHeading);
  renderList(referenceInstructions, "setup-steps", instructions);
}

function renderFormulaBuilderOutput() {
  const formulaType = document.getElementById("formulaType").value;
  const config = formulaBuilderConfigs[formulaType];
  const generatedFormula = document.getElementById("generatedFormula");
  const copyFormulaButton = document.getElementById("copyFormulaButton");
  const copyFormulaStatus = document.getElementById("copyFormulaStatus");
  const values = getFormulaValues(config);
  const missingFields = getMissingFields(config, values);

  copyFormulaStatus.textContent = "";

  if (missingFields.length > 0) {
    const missingLabels = missingFields.map((field) => field.label).join(", ");
    generatedFormula.textContent = `Complete these fields to generate a formula: ${missingLabels}.`;
    copyFormulaButton.disabled = true;
    renderReferenceInstructions(config, values);
    return;
  }

  generatedFormula.textContent = config.buildFormula(values);
  copyFormulaButton.disabled = false;
  renderReferenceInstructions(config, values);
}

function renderFormulaFields() {
  const formulaType = document.getElementById("formulaType").value;
  const config = formulaBuilderConfigs[formulaType];
  const formulaInputFields = document.getElementById("formulaInputFields");

  formulaInputFields.innerHTML = "";

  config.fields.forEach((field) => {
    formulaInputFields.appendChild(createFormulaInput(field));
  });

  renderFormulaBuilderOutput();
}

function copyFormulaToClipboard() {
  const generatedFormula = document.getElementById("generatedFormula");
  const copyFormulaStatus = document.getElementById("copyFormulaStatus");
  const formulaText = generatedFormula.textContent;

  if (!formulaText) {
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(formulaText).then(() => {
      copyFormulaStatus.textContent = "Formula copied.";
    }).catch(() => {
      copyWithTemporaryTextArea(formulaText, copyFormulaStatus);
    });
    return;
  }

  copyWithTemporaryTextArea(formulaText, copyFormulaStatus);
}

function copyWithTemporaryTextArea(formulaText, copyFormulaStatus) {
  const temporaryTextArea = document.createElement("textarea");
  temporaryTextArea.value = formulaText;
  temporaryTextArea.style.left = "-9999px";
  temporaryTextArea.style.position = "fixed";
  document.body.appendChild(temporaryTextArea);
  temporaryTextArea.select();
  document.execCommand("copy");
  temporaryTextArea.remove();
  copyFormulaStatus.textContent = "Formula copied.";
}

document.getElementById("analyzeScheduleButton").addEventListener("click", analyzeSchedule);
document.getElementById("formulaBuilderForm").addEventListener("submit", (event) => {
  event.preventDefault();
});
document.getElementById("formulaType").addEventListener("change", renderFormulaFields);
document.getElementById("copyFormulaButton").addEventListener("click", copyFormulaToClipboard);

renderFormulaFields();
