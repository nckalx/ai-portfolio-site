// Classic-script module; no build step or browser APIs required.
(() => {
  const { sheetReference } = globalThis.SmartsheetFormulaBuilder.utils;
  const { maxLocationWordsToCheck } = globalThis.SmartsheetFormulaBuilder.configuration;

  const guidance = {
    appendFinishDateLabel: {
      getReferences() {
        return [];
      },
      getInstructions(values) {
        return [
          `Add this formula to the helper column where you want the combined text and date to appear.`,
          `Confirm the column names match ${values.milestoneLabelColumn} and ${values.finishDateColumn}.`,
          `Use a Text/Number column for the formula output.`
        ];
      }
    },
    scheduleMovedWorkdays: {
      getReferences() {
        return [];
      },
      getInstructions(values) {
        return [
          `Add this formula to a Text/Number column on the same sheet as the date columns.`,
          `Positive values mean ${values.updatedDateColumn} is later than ${values.originalDateColumn}.`,
          `Negative values mean the revised date moved earlier. This formula excludes Saturdays and Sundays and does not supply a holiday calendar.`
        ];
      }
    },
    twoCriteriaLookup: {
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
          `Keep the return and match ranges aligned so they describe the same source rows.`,
          `Paste the formula into the current sheet where the first matching source value should appear.`
        ];
      }
    },
    buildMilestoneId: {
      getSetupNotes() {
        return [
          "This formula only uses columns from the current sheet.",
          "The fixed output pattern is Prefix - Middle Final. A blank prefix cell returns blank."
        ];
      },
      getInstructions(values) {
        return [
          `Add this formula to a Text/Number helper column for the combined text.`,
          `Confirm ${values.milestoneNumberColumn}, ${values.locationColumn}, and ${values.taskNameColumn} match your sheet exactly.`,
          `Use the combined text in labels, reports, or matching workflows. This formula does not create or guarantee unique IDs.`
        ];
      }
    },
    shortenLocationName: {
      getSetupNotes() {
        return [
          `This formula returns the longest of the first ${maxLocationWordsToCheck} space-separated words. Later words are not evaluated.`,
          "When words tie for the longest length, the earliest matching word is returned. This is word extraction, not abbreviation."
        ];
      },
      getInstructions(values) {
        return [
          `Add this formula to a Text/Number helper column for the longest-word result.`,
          `Confirm ${values.locationNameColumn} contains the source text whose first ${maxLocationWordsToCheck} words should be inspected.`,
          `Use the extracted longest word only where the first-${maxLocationWordsToCheck}-words limit fits your text. Blank source text returns blank.`
        ];
      }
    },
    countCheckboxValues: {
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
          `Choose checked, unchecked, or both states to match what the checkbox represents in your sheet.`
        ];
      }
    },
    monthNameSortNumber: {
      getInstructions(values) {
        return [
          `Add this formula to a Text/Number helper column.`,
          `Confirm ${values.monthNameColumn} stores full English month names like January, February, or March.`,
          `Sort reports and dashboard source data by this helper column instead of the month name text.`
        ];
      }
    },
    statusIndicator: {
      getSetupNotes() {
        return [
          "This formula only uses columns from the current sheet.",
          "Completed status takes precedence and returns Green. Otherwise, a past finish date or a past start date with not-started status returns Red; all other cases return Yellow."
        ];
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
      getSetupNotes() {
        return [
          "This formula only uses columns from the current sheet.",
          "Enable wrap text in Smartsheet if you want the CHAR(10) line breaks to display cleanly.",
          "All five column names are required. Blank second or third assignee cells omit their lines; the output labels remain Task Lead:, Task Second:, and Task Third:."
        ];
      },
      getInstructions(values) {
        return [
          `Add this formula to a Text/Number helper column used by reports or dashboards.`,
          `Confirm ${values.reportTaskColumn}, ${values.reportLocationColumn}, and task assignment columns are available on the sheet.`,
          `Use this fixed task, location, and three-assignee template where its output labels fit your sheet.`
        ];
      }
    },
    spendDateAttribute: {
      getSetupNotes() {
        return [
          "This formula only uses columns from the current sheet.",
          "Only checked rows return a date attribute. The preferred date takes priority over the fallback date.",
          "Quarter output uses calendar quarters Q1-Q4, not a custom fiscal calendar."
        ];
      },
      getInstructions(values) {
        return [
          `Add this formula to a helper column for the selected date attribute.`,
          `Use ${values.spendingMilestoneColumn} to identify the rows to include.`,
          `Use ${values.spendFinishColumn} as the preferred date and ${values.spendStartColumn} when the preferred date is blank.`
        ];
      }
    },
    singleCriteriaLookup: {
      getReferences(values) {
        return [
          {
            name: values.singleLookupReturnReference,
            sheet: "Source lookup sheet",
            range: "Value column to return"
          },
          {
            name: values.singleLookupMatchReference,
            sheet: "Source lookup sheet",
            range: "Source ID or lookup key column"
          }
        ];
      },
      getSetupNotes() {
        return [
          "Create a cross-sheet reference for the value you want returned.",
          "Create a cross-sheet reference for the source column that contains the matching ID or key.",
          "The current sheet must have a lookup column containing the value to match."
        ];
      },
      getInstructions(values) {
        return [
          `Add this formula to the column where you want the returned value to appear.`,
          `Create ${sheetReference(values.singleLookupReturnReference)} and ${sheetReference(values.singleLookupMatchReference)} in Smartsheet.`,
          `Confirm ${values.singleLookupCurrentColumn} matches the values in ${sheetReference(values.singleLookupMatchReference)}.`
        ];
      }
    },
    joinMatchingValues: {
      getReferences(values) {
        return [
          {
            name: values.joinSourceValuesReference,
            sheet: "Source detail sheet",
            range: "Values to join"
          },
          {
            name: values.joinSourceMatchReference,
            sheet: "Source detail sheet",
            range: "Source match column"
          }
        ];
      },
      getSetupNotes() {
        return [
          "Create a cross-sheet reference for the values you want to return.",
          "Create a cross-sheet reference for the source match column.",
          "Enable wrap text in Smartsheet if using line break output."
        ];
      },
      getInstructions() {
        return [
          "Use this when one lookup value may have multiple matching records.",
          "Choose distinct values if you want repeated matches removed.",
          "Choose line breaks for report-friendly stacked labels."
        ];
      }
    },
    countRowsMultipleCriteria: {
      getReferences(values) {
        return [
          {
            name: values.countCriteriaReferenceOne,
            sheet: "Source data sheet",
            range: "First criteria column"
          },
          {
            name: values.countCriteriaReferenceTwo,
            sheet: "Source data sheet",
            range: "Second criteria column"
          }
        ];
      },
      getSetupNotes() {
        return [
          "Create one cross-sheet reference for each criteria column.",
          "Both criteria must match. Enter text values to match; the builder quotes them as text rather than accepting comparison expressions."
        ];
      },
      getInstructions() {
        return [
          "Add this formula to a summary or dashboard metric cell.",
          "Set each criteria reference to the source column you want to evaluate.",
          "Enter the criteria text to count."
        ];
      }
    },
    sumValuesMultipleCriteria: {
      getReferences(values) {
        return [
          {
            name: values.sumValueReference,
            sheet: "Source data sheet",
            range: "Numeric value column"
          },
          {
            name: values.sumCriteriaReferenceOne,
            sheet: "Source data sheet",
            range: "First criteria column"
          },
          {
            name: values.sumCriteriaReferenceTwo,
            sheet: "Source data sheet",
            range: "Second criteria column"
          }
        ];
      },
      getSetupNotes() {
        return [
          "The source value reference should point to a numeric column.",
          "Both criteria must match. Criteria values are quoted as text; comparison expressions are not a builder option."
        ];
      },
      getInstructions() {
        return [
          "Use this for budget, cost, hours, units, or quantity summaries.",
          "Add it to a dashboard, summary sheet, or helper column.",
          "Confirm the value column contains numbers."
        ];
      }
    },
    averageValuesMultipleCriteria: {
      getReferences(values) {
        return [
          {
            name: values.averageValueReference,
            sheet: "Source data sheet",
            range: "Numeric value column"
          },
          {
            name: values.averageCriteriaReferenceOne,
            sheet: "Source data sheet",
            range: "First criteria column"
          },
          {
            name: values.averageCriteriaReferenceTwo,
            sheet: "Source data sheet",
            range: "Second criteria column"
          }
        ];
      },
      getSetupNotes() {
        return [
          "The source value reference should point to a numeric column.",
          "Averages the values collected from rows where both criteria match. Criteria values are quoted as text; comparison expressions are not a builder option."
        ];
      },
      getInstructions() {
        return [
          "Use this for average duration, average score, average percent complete, or cycle-time analysis.",
          "Add it to a summary or dashboard sheet.",
          "Confirm the value column contains numbers."
        ];
      }
    },
    matchingDateExtremes: {
      getReferences(values) {
        return [
          {
            name: values.matchingDateReference,
            sheet: "Source date sheet",
            range: "Source date column"
          },
          {
            name: values.matchingDateMatchReference,
            sheet: "Source date sheet",
            range: "Source match column"
          }
        ];
      },
      getSetupNotes() {
        return [
          "Create a cross-sheet reference for the source date column.",
          "Create a cross-sheet reference for the source match column.",
          "The current sheet must have a lookup column."
        ];
      },
      getInstructions() {
        return [
          "Use latest date for last update, latest completion, latest submission, or most recent activity.",
          "Use earliest date for next due date, first start, or earliest milestone.",
          "Format the destination column as a Date column."
        ];
      }
    },
    uniqueCountCriteria: {
      getReferences(values) {
        return [
          {
            name: values.uniqueValueReference,
            sheet: "Source data sheet",
            range: "Unique value column"
          },
          {
            name: values.uniqueCriteriaReferenceOne,
            sheet: "Source data sheet",
            range: "First criteria column"
          },
          {
            name: values.uniqueCriteriaReferenceTwo,
            sheet: "Source data sheet",
            range: "Second criteria column"
          }
        ];
      },
      getSetupNotes() {
        return [
          "The unique value reference should point to the ID, name, owner, location, or other value to count once.",
          "Both criteria must match. Criteria values are quoted as text; comparison expressions are not a builder option."
        ];
      },
      getInstructions() {
        return [
          "Use this when a source sheet may contain repeated record IDs, owners, locations, or other values to count once.",
          "Add it to a dashboard or summary metric.",
          "Confirm the unique value reference contains consistent naming."
        ];
      }
    },
    parentChildRollup: {
      getSetupNotes() {
        return [
          "This formula is intended for hierarchy-enabled Smartsheet sheets with parent and child rows.",
          "Add the formula to parent rows or use a column formula if appropriate for the workflow."
        ];
      },
      getInstructions() {
        return [
          "Choose the column that contains the child values.",
          "Choose the rollup type.",
          "Place the formula on the parent row where the summary should appear."
        ];
      }
    },
    hierarchyLevelHelper: {
      getSetupNotes() {
        return [
          "This formula uses Smartsheet hierarchy functions.",
          "Top-level rows have no ancestors."
        ];
      },
      getInstructions() {
        return [
          "Add this to a helper column.",
          "Use it for reports, filters, conditional formatting, or separating phases from tasks.",
          "Choose whether top-level rows should return 0 or 1."
        ];
      }
    },
    showParentValue: {
      getSetupNotes() {
        return [
          "This works on indented child rows.",
          "Top-level rows without a parent return blank."
        ];
      },
      getInstructions() {
        return [
          "Add this to a helper column.",
          "Use it when reports include child rows but need parent context.",
          "Common uses include showing parent task, phase, location, project, or category."
        ];
      }
    },
    multiSelectHasCheck: {
      getSetupNotes() {
        return [
          "HAS is best for multi-select dropdown and multi-contact columns.",
          "The value must match one of the selectable values."
        ];
      },
      getInstructions() {
        return [
          "Use this to flag rows by owner, department, tag, phase, risk category, region, or workflow type.",
          "Choose checkbox output if the destination column is a checkbox column.",
          "Choose text output if the destination column is text/number."
        ];
      }
    },
    textBeforeAfterDelimiter: {
      getSetupNotes() {
        return [
          "This is useful for imported data, combined IDs, labels, codes, and report helper columns.",
          "If the delimiter is not found, the before-delimiter formula returns the full source text and the after-delimiter formula returns blank."
        ];
      },
      getInstructions() {
        return [
          "Enter the source text column.",
          "Enter the delimiter exactly as it appears in the text.",
          "Choose whether to return the text before or after that delimiter."
        ];
      }
    },
    readyToStartBasedOnPredecessors: {
      getSetupNotes() {
        return [
          "This formula assumes another column already provides the number of open predecessors.",
          "It does not calculate predecessor relationships. Complete status takes precedence; otherwise, zero open predecessors returns the ready value and any other count returns the blocked value."
        ];
      },
      getInstructions() {
        return [
          "Add or maintain an Open Predecessor Count column.",
          "Add this formula to a readiness/status helper column.",
          "Use the result in reports, dashboards, filters, or conditional formatting."
        ];
      }
    },
    rankedValue: {
      getReferences(values) {
        return [
          {
            name: values.rankedValueReference,
            sheet: "Source ranking sheet",
            range: "Numeric values to rank"
          }
        ];
      },
      getSetupNotes() {
        return [
          "Create a cross-sheet reference to the numeric values you want to rank.",
          "The source values should be numeric.",
          "Rank 1 means highest or lowest, depending on the selected ranking type."
        ];
      },
      getInstructions() {
        return [
          "Choose the source value reference.",
          "Enter the rank number.",
          "Choose whether to return the Nth highest or Nth lowest value."
        ];
      }
    }
  };

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

  function getGuidance(formulaType, values) {
    const config = guidance[formulaType];
    const references = config.getReferences ? config.getReferences(values) : [];
    return {
      references,
      setupNotes: getSetupNotes(config, values, references),
      instructions: config.getInstructions(values)
    };
  }

  globalThis.SmartsheetFormulaBuilder.guidance = { getGuidance };
})();
