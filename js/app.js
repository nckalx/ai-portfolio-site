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

const maxLocationWordsToCheck = 6;

const monthNameSortValues = [
  { name: "January", value: 1 },
  { name: "February", value: 2 },
  { name: "March", value: 3 },
  { name: "April", value: 4 },
  { name: "May", value: 5 },
  { name: "June", value: 6 },
  { name: "July", value: 7 },
  { name: "August", value: 8 },
  { name: "September", value: 9 },
  { name: "October", value: 10 },
  { name: "November", value: 11 },
  { name: "December", value: 12 }
];

const formulaBuilderConfigs = {
  appendFinishDateLabel: {
    explanation:
      "Creates a clean milestone label for project controls reports by keeping the milestone name as the base text and appending the row's Finish Date when that date is available.",
    fields: [
      {
        id: "milestoneLabelColumn",
        label: "Milestone label column",
        defaultValue: "Milestone Label",
        help: "The current-sheet column that stores the readable milestone name."
      },
      {
        id: "finishDateColumn",
        label: "Finish date column",
        defaultValue: "Finish Date",
        help: "The current-sheet finish date column to append when it has a value."
      }
    ],
    buildFormula(values) {
      return (
        `=IF(ISBLANK(${rowColumn(values.finishDateColumn)}), ` +
        `${rowColumn(values.milestoneLabelColumn)}, ` +
        `${rowColumn(values.milestoneLabelColumn)} + " - " + ${rowColumn(values.finishDateColumn)})`
      );
    },
    getReferences() {
      return [];
    },
    getInstructions(values) {
      return [
        `Add this formula to the helper column where you want the combined label to appear.`,
        `Confirm the column names match ${values.milestoneLabelColumn} and ${values.finishDateColumn}.`,
        `Use a Text/Number column for the formula output.`
      ];
    }
  },
  scheduleMovedWorkdays: {
    explanation:
      "Calculates how many weekdays a milestone moved between its original date and revised date, giving project controls teams a quick schedule variance value for reporting.",
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
    explanation:
      "Looks up a value from another Smartsheet sheet only when two current-row criteria match the source sheet, which is useful for pulling the correct forecast date, owner, status, or control value from a master project source.",
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
    explanation:
      "Checks a box when the current row has a matching value in another sheet, helping teams flag milestones that are tied to an external log, action tracker, or control register.",
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
    explanation:
      "Finds the related Risk, Issue, or Opportunity ID from a RIO log by matching the current milestone ID, so project teams can connect schedule rows back to their active risk and issue records.",
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
  },
  buildMilestoneId: {
    explanation:
      "Creates a standardized milestone ID for reports, dashboards, automation records, and cross-sheet matching by combining a milestone number, location, and task name.",
    fields: [
      {
        id: "milestoneNumberColumn",
        label: "Milestone number column",
        defaultValue: "Milestone Number",
        help: "The current-sheet column that stores the milestone sequence or ID number."
      },
      {
        id: "locationColumn",
        label: "Location or short location column",
        defaultValue: "Location",
        help: "The current-sheet location column, or a helper column that already stores a shortened location label."
      },
      {
        id: "taskNameColumn",
        label: "Task name column",
        defaultValue: "Task Name",
        help: "The task or milestone name to append after the location."
      }
    ],
    buildFormula(values) {
      const milestoneNumber = rowColumn(values.milestoneNumberColumn);

      return (
        `=IF(ISBLANK(${milestoneNumber}), "", ` +
        `${milestoneNumber} + " - " + ${rowColumn(values.locationColumn)} + " " + ${rowColumn(values.taskNameColumn)})`
      );
    },
    getSetupNotes() {
      return [
        "This formula only uses columns from the current sheet.",
        "If you want a shortened location name, create a helper column with the Shorten Location Name formula first, then point this formula's Location field to that helper column."
      ];
    },
    getInstructions(values) {
      return [
        `Add this formula to the helper column that stores your report-ready milestone ID.`,
        `Confirm ${values.milestoneNumberColumn}, ${values.locationColumn}, and ${values.taskNameColumn} match your sheet exactly.`,
        `Use the generated ID in reports, dashboards, automations, or cross-sheet matching workflows.`
      ];
    }
  },
  shortenLocationName: {
    explanation:
      "Creates a short location label from a longer location name. It is useful for milestone IDs, dashboards, reports, and helper columns where shorter text is easier to read.",
    fields: [
      {
        id: "locationNameColumn",
        label: "Location name column",
        defaultValue: "Location",
        help: "The current-sheet column that stores the full location name."
      }
    ],
    buildFormula(values) {
      return `=IF(ISBLANK(${rowColumn(values.locationNameColumn)}), "", ${longestLocationWordFormula(values.locationNameColumn)})`;
    },
    getSetupNotes() {
      return [
        `This formula is intended for common location names and evaluates the first ${maxLocationWordsToCheck} words in the location name.`,
        "For very long names, simplify the source text or customize the formula to evaluate more words."
      ];
    },
    getInstructions(values) {
      return [
        `Add this formula to a helper column that stores the shortened location name.`,
        `Confirm ${values.locationNameColumn} contains the full location name for each row.`,
        `Use the shortened result in milestone IDs, report grouping, dashboard labels, or other helper formulas.`
      ];
    }
  },
  countCheckboxValues: {
    explanation:
      "Counts completed, incomplete, or total checkbox items from another sheet, which is useful for dashboards and summary sheets that track checklist progress.",
    fields: [
      {
        id: "checkboxCountReference",
        label: "Cross-sheet checkbox reference name",
        defaultValue: "Hold Kick-off",
        help: "The named Smartsheet reference that points to the checkbox column you want to count."
      },
      {
        id: "checkboxCountType",
        label: "Count type",
        type: "select",
        defaultValue: "checkedOnly",
        options: [
          { value: "checkedOnly", label: "Checked only" },
          { value: "uncheckedOnly", label: "Unchecked only" },
          { value: "checkedAndUnchecked", label: "Checked and unchecked" }
        ],
        help: "Choose whether to count checked boxes, unchecked boxes, or both."
      }
    ],
    buildFormula(values) {
      const checkboxReference = sheetReference(values.checkboxCountReference);

      if (values.checkboxCountType === "uncheckedOnly") {
        return `=COUNTIF(${checkboxReference}, 0)`;
      }

      if (values.checkboxCountType === "checkedAndUnchecked") {
        return `=COUNTIF(${checkboxReference}, 1) + COUNTIF(${checkboxReference}, 0)`;
      }

      return `=COUNTIF(${checkboxReference}, 1)`;
    },
    getReferences(values) {
      return [
        {
          name: values.checkboxCountReference,
          sheet: "Source checklist or tracking sheet",
          range: "Checkbox column to count"
        }
      ];
    },
    getInstructions(values) {
      return [
        `Create ${sheetReference(values.checkboxCountReference)} as a cross-sheet reference to the checkbox column you want to summarize.`,
        `Place the formula in a summary sheet, dashboard source sheet, or sheet summary field.`,
        `Use the selected count type to track completed, incomplete, or total checklist items.`
      ];
    }
  },
  monthNameSortNumber: {
    explanation:
      "Turns month names into sortable numbers so reports, filters, dashboards, and budget timing views display months in calendar order.",
    fields: [
      {
        id: "monthNameColumn",
        label: "Month name column",
        defaultValue: "First Month Budgeted",
        help: "The current-sheet column that stores a month name such as January or February."
      }
    ],
    buildFormula(values) {
      const monthColumn = rowColumn(values.monthNameColumn);
      const monthSortFormula = nestedEqualsFormula(
        monthColumn,
        monthNameSortValues.map((month) => {
          return { match: month.name, result: String(month.value) };
        }),
        `""`
      );

      return `=IF(ISBLANK(${monthColumn}), "", ${monthSortFormula})`;
    },
    getInstructions(values) {
      return [
        `Add this formula to a Text/Number helper column.`,
        `Confirm ${values.monthNameColumn} stores full month names like January, February, or March.`,
        `Sort reports and dashboard source data by this helper column instead of the month name text.`
      ];
    }
  },
  statusIndicator: {
    explanation:
      "Creates a simple Red, Yellow, or Green schedule health indicator for reports and dashboards using start date, finish date, and status values.",
    fields: [
      {
        id: "statusStartColumn",
        label: "Start date column",
        defaultValue: "Updated Start",
        help: "The current-sheet start date column used to flag work that should have started."
      },
      {
        id: "statusFinishColumn",
        label: "Finish date column",
        defaultValue: "Updated Finish",
        help: "The current-sheet finish date column used to flag overdue work."
      },
      {
        id: "statusColumn",
        label: "Status column",
        defaultValue: "Status",
        help: "The current-sheet column that stores the task status."
      },
      {
        id: "notStartedValue",
        label: "Not started value",
        defaultValue: "Not Started",
        help: "The status text that means work has not started."
      },
      {
        id: "completeValue",
        label: "Complete value",
        defaultValue: "Complete",
        help: "The status text that means the work is complete."
      }
    ],
    buildFormula(values) {
      const startColumn = rowColumn(values.statusStartColumn);
      const finishColumn = rowColumn(values.statusFinishColumn);
      const statusColumn = rowColumn(values.statusColumn);
      const completeValue = smartsheetText(values.completeValue);
      const notStartedValue = smartsheetText(values.notStartedValue);

      return (
        `=IF(${statusColumn} = ${completeValue}, "Green", ` +
        `IF(OR(AND(NOT(ISBLANK(${startColumn})), ${startColumn} < TODAY(), ${statusColumn} = ${notStartedValue}), ` +
        `AND(NOT(ISBLANK(${finishColumn})), ${finishColumn} < TODAY())), "Red", "Yellow"))`
      );
    },
    getInstructions(values) {
      return [
        `Add this formula to a Symbol or Text/Number column used for schedule health reporting.`,
        `Confirm ${values.statusColumn} uses ${values.notStartedValue} and ${values.completeValue} consistently.`,
        `Use the result to highlight overdue work, not-started work, and completed items in reports or dashboards.`
      ];
    }
  },
  multiLineReportLabel: {
    explanation:
      "Creates a readable multi-line label from structured task, location, and assignment fields, especially for dashboards, exports, or reports where several fields need to appear together.",
    fields: [
      {
        id: "reportTaskColumn",
        label: "Milestone or task column",
        defaultValue: "Task Name",
        help: "The current-sheet column that stores the milestone or task name."
      },
      {
        id: "reportLocationColumn",
        label: "Location column",
        defaultValue: "Location",
        help: "The current-sheet column that stores the location name."
      },
      {
        id: "leadOwnerColumn",
        label: "Task lead column",
        defaultValue: "Task Lead",
        help: "The current-sheet column that stores the primary task assignee."
      },
      {
        id: "secondaryOwnerColumn",
        label: "Task second column",
        defaultValue: "Task Second",
        help: "The current-sheet column that stores the secondary task assignee."
      },
      {
        id: "tertiaryOwnerColumn",
        label: "Task third column",
        defaultValue: "Task Third",
        help: "The current-sheet column that stores the third task assignee."
      }
    ],
    buildFormula(values) {
      const secondaryOwner = rowColumn(values.secondaryOwnerColumn);
      const tertiaryOwner = rowColumn(values.tertiaryOwnerColumn);

      return (
        `=${rowColumn(values.reportTaskColumn)} + CHAR(10) + ${rowColumn(values.reportLocationColumn)} + ` +
        `CHAR(10) + "Task Lead: " + ${rowColumn(values.leadOwnerColumn)} + ` +
        `IF(ISBLANK(${secondaryOwner}), "", CHAR(10) + "Task Second: " + ${secondaryOwner}) + ` +
        `IF(ISBLANK(${tertiaryOwner}), "", CHAR(10) + "Task Third: " + ${tertiaryOwner})`
      );
    },
    getSetupNotes() {
      return [
        "This formula only uses columns from the current sheet.",
        "Enable wrap text in Smartsheet if you want the CHAR(10) line breaks to display cleanly."
      ];
    },
    getInstructions(values) {
      return [
        `Add this formula to a Text/Number helper column used by reports or dashboards.`,
        `Confirm ${values.reportTaskColumn}, ${values.reportLocationColumn}, and task assignment columns are available on the sheet.`,
        `Use the result anywhere a compact task, location, and assignment summary is useful.`
      ];
    }
  },
  spendDateAttribute: {
    explanation:
      "Supports budget timing, capital planning, and reporting workflows by deriving year, quarter, or month attributes from spend milestone dates.",
    fields: [
      {
        id: "spendingMilestoneColumn",
        label: "Spending milestone checkbox column",
        defaultValue: "Spending Milestone",
        help: "The checkbox column that identifies rows used for spend reporting."
      },
      {
        id: "spendStartColumn",
        label: "Start date column",
        defaultValue: "Start",
        help: "The start date to use when Finish is blank."
      },
      {
        id: "spendFinishColumn",
        label: "Finish date column",
        defaultValue: "Finish",
        help: "The finish date to use first when it is available."
      },
      {
        id: "spendAttribute",
        label: "Attribute to return",
        type: "select",
        defaultValue: "year",
        options: [
          { value: "year", label: "Year" },
          { value: "quarter", label: "Quarter" },
          { value: "monthNumber", label: "Month Number" }
        ],
        help: "Choose the spend date attribute needed for reporting."
      }
    ],
    buildFormula(values) {
      const spendingMilestone = rowColumn(values.spendingMilestoneColumn);
      const spendDate = `IF(ISBLANK(${rowColumn(values.spendFinishColumn)}), ${rowColumn(values.spendStartColumn)}, ${rowColumn(values.spendFinishColumn)})`;

      if (values.spendAttribute === "quarter") {
        return `=IF(${spendingMilestone} <> 1, "", "Q" + ROUNDUP(MONTH(${spendDate}) / 3, 0))`;
      }

      if (values.spendAttribute === "monthNumber") {
        return `=IF(${spendingMilestone} <> 1, "", MONTH(${spendDate}))`;
      }

      return `=IF(${spendingMilestone} <> 1, "", YEAR(${spendDate}))`;
    },
    getInstructions(values) {
      return [
        `Add this formula to a helper column for spend reporting attributes.`,
        `Confirm ${values.spendingMilestoneColumn} is checked only for rows that should feed spend timing reports.`,
        `Use the selected attribute for budget timing analysis, grouping, filtering, or dashboard rollups.`
      ];
    }
  }
};

function rowColumn(columnName) {
  return `[${columnName.trim()}]@row`;
}

function sheetReference(referenceName) {
  const cleanedName = referenceName.trim().replace(/^\{+/, "").replace(/\}+$/, "").trim();
  return `{${cleanedName}}`;
}

function smartsheetText(text) {
  return `"${text.replace(/"/g, '""')}"`;
}

function locationWordFormula(trimmedLocation, wordNumber) {
  const locationLength = `LEN(${trimmedLocation})`;
  const startPosition = wordNumber === 1 ? "1" : `${wordNumber - 1} * ${locationLength} + 1`;

  return `TRIM(MID(SUBSTITUTE(${trimmedLocation}, " ", REPT(" ", ${locationLength})), ${startPosition}, ${locationLength}))`;
}

function longestLocationWordFormula(locationColumnName) {
  const trimmedLocation = `TRIM(${rowColumn(locationColumnName)})`;
  const words = [];

  for (let wordNumber = 1; wordNumber <= maxLocationWordsToCheck; wordNumber += 1) {
    words.push(locationWordFormula(trimmedLocation, wordNumber));
  }

  const maxWordLength = `MAX(${words.map((word) => `LEN(${word})`).join(", ")})`;

  return words.reduceRight((formula, word) => {
    return `IF(LEN(${word}) = ${maxWordLength}, ${word}, ${formula})`;
  });
}

function nestedEqualsFormula(targetFormula, options, fallbackFormula) {
  return options.reduceRight((formula, option) => {
    return `IF(${targetFormula} = ${smartsheetText(option.match)}, ${option.result}, ${formula})`;
  }, fallbackFormula);
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

  const input = document.createElement(field.type === "select" ? "select" : "input");
  input.id = field.id;

  if (field.type === "select") {
    field.options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      input.appendChild(optionElement);
    });

    input.value = field.defaultValue;
    input.addEventListener("change", renderFormulaBuilderOutput);
  } else {
    input.type = "text";
    input.value = field.defaultValue;
    input.addEventListener("input", renderFormulaBuilderOutput);
  }

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

function getSetupNotes(config, values, references) {
  if (config.getSetupNotes) {
    return config.getSetupNotes(values);
  }

  if (references.length > 0) {
    return [
      "Create the named cross-sheet references in Smartsheet before using this formula.",
      "Keep the referenced source ranges aligned so Smartsheet can compare rows correctly."
    ];
  }

  return ["This formula only uses columns from the current sheet."];
}

function renderReferenceInstructions(config, values) {
  const referenceInstructions = document.getElementById("referenceInstructions");
  const references = config.getReferences ? config.getReferences(values) : [];
  const setupNotes = getSetupNotes(config, values, references);
  const instructions = config.getInstructions(values);

  referenceInstructions.innerHTML = "";

  const setupHeading = document.createElement("h3");
  setupHeading.textContent = "Setup notes";
  referenceInstructions.appendChild(setupHeading);
  renderList(referenceInstructions, "setup-notes", setupNotes);

  if (references.length > 0) {
    const referenceHeading = document.createElement("h3");
    referenceHeading.textContent = "Cross-sheet references";
    referenceInstructions.appendChild(referenceHeading);

    const referenceIntro = document.createElement("p");
    referenceIntro.textContent = "Create these named reference placeholders in Smartsheet before using the formula.";
    referenceInstructions.appendChild(referenceIntro);

    const referenceItems = references.map((reference) => {
      return `${sheetReference(reference.name)}: in "${reference.sheet}", select the "${reference.range}" column.`;
    });

    renderList(referenceInstructions, "reference-list", referenceItems);
  }

  const instructionHeading = document.createElement("h3");
  instructionHeading.textContent = "How to use it";
  referenceInstructions.appendChild(instructionHeading);
  renderList(referenceInstructions, "setup-steps", instructions);
}

function renderFormulaBuilderOutput() {
  const formulaType = document.getElementById("formulaType").value;
  const config = formulaBuilderConfigs[formulaType];
  const formulaExplanation = document.getElementById("formulaExplanation");
  const generatedFormula = document.getElementById("generatedFormula");
  const copyFormulaButton = document.getElementById("copyFormulaButton");
  const copyFormulaStatus = document.getElementById("copyFormulaStatus");
  const values = getFormulaValues(config);
  const missingFields = getMissingFields(config, values);

  formulaExplanation.textContent = config.explanation;
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
