// Classic-script module; no build step or browser APIs required.
(() => {
  const catalog = {
    "appendFinishDateLabel": {
      "id": "appendFinishDateLabel",
      "label": "Append Finish Date to Milestone Label",
      "explanation": "Creates a clean milestone label for project controls reports by keeping the milestone name as the base text and appending the row's Finish Date when that date is available.",
      "fields": [
        {
          "id": "milestoneLabelColumn",
          "label": "Milestone label column",
          "defaultValue": "Milestone Label",
          "help": "The current-sheet column that stores the readable milestone name."
        },
        {
          "id": "finishDateColumn",
          "label": "Finish date column",
          "defaultValue": "Finish Date",
          "help": "The current-sheet finish date column to append when it has a value."
        }
      ]
    },
    "scheduleMovedWorkdays": {
      "id": "scheduleMovedWorkdays",
      "label": "Schedule Moved in Workdays",
      "explanation": "Calculates how many weekdays a milestone moved between its original date and revised date, giving project controls teams a quick schedule variance value for reporting.",
      "fields": [
        {
          "id": "originalDateColumn",
          "label": "Original date column",
          "defaultValue": "Original Date",
          "help": "The baseline or previous milestone date on the current sheet."
        },
        {
          "id": "updatedDateColumn",
          "label": "Updated date column",
          "defaultValue": "New Date",
          "help": "The current or revised milestone date on the current sheet."
        }
      ]
    },
    "twoCriteriaLookup": {
      "id": "twoCriteriaLookup",
      "label": "Cross-Sheet Two-Criteria Lookup",
      "explanation": "Looks up a value from another Smartsheet sheet only when two current-row criteria match the source sheet, which is useful for pulling the correct forecast date, owner, status, or control value from a master project source.",
      "fields": [
        {
          "id": "lookupCurrentCriteriaOneColumn",
          "label": "Current sheet criteria column 1",
          "defaultValue": "Project ID",
          "help": "The first value to match from the current row."
        },
        {
          "id": "lookupCurrentCriteriaTwoColumn",
          "label": "Current sheet criteria column 2",
          "defaultValue": "Milestone",
          "help": "The second value to match from the current row."
        },
        {
          "id": "lookupSourceSheetName",
          "label": "Source sheet name",
          "defaultValue": "Master Schedule",
          "help": "The Smartsheet sheet that contains the lookup data."
        },
        {
          "id": "lookupSourceReturnColumn",
          "label": "Source return column",
          "defaultValue": "Forecast Date",
          "help": "The source-sheet column that contains the value you want returned."
        },
        {
          "id": "lookupSourceCriteriaOneColumn",
          "label": "Source criteria column 1",
          "defaultValue": "Project ID",
          "help": "The source-sheet column that should match criteria column 1."
        },
        {
          "id": "lookupSourceCriteriaTwoColumn",
          "label": "Source criteria column 2",
          "defaultValue": "Milestone",
          "help": "The source-sheet column that should match criteria column 2."
        },
        {
          "id": "lookupReturnReference",
          "label": "Return range reference name",
          "defaultValue": "Lookup Result Range",
          "help": "The name to use for the cross-sheet return range."
        },
        {
          "id": "lookupCriteriaOneReference",
          "label": "Criteria 1 range reference name",
          "defaultValue": "Lookup Project ID Range",
          "help": "The name to use for the first cross-sheet criteria range."
        },
        {
          "id": "lookupCriteriaTwoReference",
          "label": "Criteria 2 range reference name",
          "defaultValue": "Lookup Milestone Range",
          "help": "The name to use for the second cross-sheet criteria range."
        }
      ]
    },
    "checkboxMatch": {
      "id": "checkboxMatch",
      "label": "Checkbox Based on Cross-Sheet Match",
      "explanation": "Checks a box when the current row has a matching value in another sheet, helping teams flag milestones that are tied to an external log, action tracker, or control register.",
      "fields": [
        {
          "id": "checkboxCurrentMatchColumn",
          "label": "Current sheet match column",
          "defaultValue": "Milestone ID",
          "help": "The value from the current row to search for in another sheet."
        },
        {
          "id": "checkboxSourceSheetName",
          "label": "Source sheet name",
          "defaultValue": "RIO Log",
          "help": "The sheet that contains the matching IDs."
        },
        {
          "id": "checkboxSourceMatchColumn",
          "label": "Source match column",
          "defaultValue": "Related Milestone ID",
          "help": "The source-sheet column that should contain the current row value."
        },
        {
          "id": "checkboxMatchReference",
          "label": "Match range reference name",
          "defaultValue": "Source Match Range",
          "help": "The name to use for the cross-sheet match range."
        }
      ]
    },
    "rioIdLookup": {
      "id": "rioIdLookup",
      "label": "RIO ID Lookup",
      "explanation": "Finds the related Risk, Issue, or Opportunity ID from a RIO log by matching the current milestone ID, so project teams can connect schedule rows back to their active risk and issue records.",
      "fields": [
        {
          "id": "rioCurrentIdColumn",
          "label": "Current sheet milestone ID column",
          "defaultValue": "Milestone ID",
          "help": "The current row value used to find a related RIO item."
        },
        {
          "id": "rioSourceSheetName",
          "label": "RIO source sheet name",
          "defaultValue": "RIO Log",
          "help": "The Risk, Issue, and Opportunity log that stores RIO IDs."
        },
        {
          "id": "rioSourceIdColumn",
          "label": "Source RIO ID column",
          "defaultValue": "RIO ID",
          "help": "The source-sheet column that contains the RIO ID to return."
        },
        {
          "id": "rioSourceMatchColumn",
          "label": "Source match column",
          "defaultValue": "Related Milestone ID",
          "help": "The source-sheet column that links a RIO item to the current milestone."
        },
        {
          "id": "rioIdReference",
          "label": "RIO ID range reference name",
          "defaultValue": "RIO ID Range",
          "help": "The name to use for the cross-sheet RIO ID range."
        },
        {
          "id": "rioMatchReference",
          "label": "RIO match range reference name",
          "defaultValue": "RIO Match ID Range",
          "help": "The name to use for the cross-sheet match range."
        }
      ]
    },
    "buildMilestoneId": {
      "id": "buildMilestoneId",
      "label": "Build Milestone ID",
      "explanation": "Creates a standardized milestone ID for reports, dashboards, automation records, and cross-sheet matching by combining a milestone number, location, and task name.",
      "fields": [
        {
          "id": "milestoneNumberColumn",
          "label": "Milestone number column",
          "defaultValue": "Milestone Number",
          "help": "The current-sheet column that stores the milestone sequence or ID number."
        },
        {
          "id": "locationColumn",
          "label": "Location or short location column",
          "defaultValue": "Location",
          "help": "The current-sheet location column, or a helper column that already stores a shortened location label."
        },
        {
          "id": "taskNameColumn",
          "label": "Task name column",
          "defaultValue": "Task Name",
          "help": "The task or milestone name to append after the location."
        }
      ]
    },
    "shortenLocationName": {
      "id": "shortenLocationName",
      "label": "Shorten Location Name",
      "explanation": "Creates a short location label from a longer location name. It is useful for milestone IDs, dashboards, reports, and helper columns where shorter text is easier to read.",
      "fields": [
        {
          "id": "locationNameColumn",
          "label": "Location name column",
          "defaultValue": "Location",
          "help": "The current-sheet column that stores the full location name."
        }
      ]
    },
    "countCheckboxValues": {
      "id": "countCheckboxValues",
      "label": "Count Checkbox Values",
      "explanation": "Counts completed, incomplete, or total checkbox items from another sheet, which is useful for dashboards and summary sheets that track checklist progress.",
      "fields": [
        {
          "id": "checkboxCountReference",
          "label": "Cross-sheet checkbox reference name",
          "defaultValue": "Hold Kick-off",
          "help": "The named Smartsheet reference that points to the checkbox column you want to count."
        },
        {
          "id": "checkboxCountType",
          "label": "Count type",
          "type": "select",
          "defaultValue": "checkedOnly",
          "options": [
            {
              "value": "checkedOnly",
              "label": "Checked only"
            },
            {
              "value": "uncheckedOnly",
              "label": "Unchecked only"
            },
            {
              "value": "checkedAndUnchecked",
              "label": "Checked and unchecked"
            }
          ],
          "help": "Choose whether to count checked boxes, unchecked boxes, or both."
        }
      ]
    },
    "monthNameSortNumber": {
      "id": "monthNameSortNumber",
      "label": "Convert Month Name to Sort Number",
      "explanation": "Turns month names into sortable numbers so reports, filters, dashboards, and budget timing views display months in calendar order.",
      "fields": [
        {
          "id": "monthNameColumn",
          "label": "Month name column",
          "defaultValue": "First Month Budgeted",
          "help": "The current-sheet column that stores a month name such as January or February."
        }
      ]
    },
    "statusIndicator": {
      "id": "statusIndicator",
      "label": "Build Status Indicator",
      "explanation": "Creates a simple Red, Yellow, or Green schedule health indicator for reports and dashboards using start date, finish date, and status values.",
      "fields": [
        {
          "id": "statusStartColumn",
          "label": "Start date column",
          "defaultValue": "Updated Start",
          "help": "The current-sheet start date column used to flag work that should have started."
        },
        {
          "id": "statusFinishColumn",
          "label": "Finish date column",
          "defaultValue": "Updated Finish",
          "help": "The current-sheet finish date column used to flag overdue work."
        },
        {
          "id": "statusColumn",
          "label": "Status column",
          "defaultValue": "Status",
          "help": "The current-sheet column that stores the task status."
        },
        {
          "id": "notStartedValue",
          "label": "Not started value",
          "defaultValue": "Not Started",
          "help": "The status text that means work has not started."
        },
        {
          "id": "completeValue",
          "label": "Complete value",
          "defaultValue": "Complete",
          "help": "The status text that means the work is complete."
        }
      ]
    },
    "multiLineReportLabel": {
      "id": "multiLineReportLabel",
      "label": "Build Multi-Line Milestone Report Label",
      "explanation": "Creates a readable multi-line label from structured task, location, and assignment fields, especially for dashboards, exports, or reports where several fields need to appear together.",
      "fields": [
        {
          "id": "reportTaskColumn",
          "label": "Milestone or task column",
          "defaultValue": "Task Name",
          "help": "The current-sheet column that stores the milestone or task name."
        },
        {
          "id": "reportLocationColumn",
          "label": "Location column",
          "defaultValue": "Location",
          "help": "The current-sheet column that stores the location name."
        },
        {
          "id": "leadOwnerColumn",
          "label": "Task lead column",
          "defaultValue": "Task Lead",
          "help": "The current-sheet column that stores the primary task assignee."
        },
        {
          "id": "secondaryOwnerColumn",
          "label": "Task second column",
          "defaultValue": "Task Second",
          "help": "The current-sheet column that stores the secondary task assignee."
        },
        {
          "id": "tertiaryOwnerColumn",
          "label": "Task third column",
          "defaultValue": "Task Third",
          "help": "The current-sheet column that stores the third task assignee."
        }
      ]
    },
    "spendDateAttribute": {
      "id": "spendDateAttribute",
      "label": "Build Spend Date Attribute",
      "explanation": "Supports budget timing, capital planning, and reporting workflows by deriving year, quarter, or month attributes from spend milestone dates.",
      "fields": [
        {
          "id": "spendingMilestoneColumn",
          "label": "Spending milestone checkbox column",
          "defaultValue": "Spending Milestone",
          "help": "The checkbox column that identifies rows used for spend reporting."
        },
        {
          "id": "spendStartColumn",
          "label": "Start date column",
          "defaultValue": "Start",
          "help": "The start date to use when Finish is blank."
        },
        {
          "id": "spendFinishColumn",
          "label": "Finish date column",
          "defaultValue": "Finish",
          "help": "The finish date to use first when it is available."
        },
        {
          "id": "spendAttribute",
          "label": "Attribute to return",
          "type": "select",
          "defaultValue": "year",
          "options": [
            {
              "value": "year",
              "label": "Year"
            },
            {
              "value": "quarter",
              "label": "Quarter"
            },
            {
              "value": "monthNumber",
              "label": "Month Number"
            }
          ],
          "help": "Choose the spend date attribute needed for reporting."
        }
      ]
    },
    "singleCriteriaLookup": {
      "id": "singleCriteriaLookup",
      "label": "Single-Criteria Cross-Sheet Lookup",
      "explanation": "Looks up a value from another sheet when the current row has a matching ID, name, or other lookup key.",
      "fields": [
        {
          "id": "singleLookupReturnReference",
          "label": "Source return reference",
          "defaultValue": "Source Return Value",
          "help": "The cross-sheet reference that points to the source value you want returned."
        },
        {
          "id": "singleLookupMatchReference",
          "label": "Source match reference",
          "defaultValue": "Source Match ID",
          "help": "The cross-sheet reference that points to the source lookup key or ID column."
        },
        {
          "id": "singleLookupCurrentColumn",
          "label": "Current sheet lookup column",
          "defaultValue": "Lookup ID",
          "help": "The current-sheet column that contains the value to match."
        }
      ]
    },
    "joinMatchingValues": {
      "id": "joinMatchingValues",
      "label": "Join Matching Values",
      "explanation": "Collects multiple matching values from another sheet and displays them together in one cell.",
      "fields": [
        {
          "id": "joinSourceValuesReference",
          "label": "Source values reference",
          "defaultValue": "Source Values",
          "help": "The cross-sheet reference that points to the values you want to return."
        },
        {
          "id": "joinSourceMatchReference",
          "label": "Source match reference",
          "defaultValue": "Source Match ID",
          "help": "The cross-sheet reference that points to the source match column."
        },
        {
          "id": "joinCurrentLookupColumn",
          "label": "Current sheet lookup column",
          "defaultValue": "Lookup ID",
          "help": "The current-sheet column that contains the value to match."
        },
        {
          "id": "joinOutputType",
          "label": "Match output type",
          "type": "select",
          "defaultValue": "all",
          "options": [
            {
              "value": "all",
              "label": "All matching values"
            },
            {
              "value": "distinct",
              "label": "Distinct matching values only"
            }
          ],
          "help": "Choose whether repeated matching values should be kept or removed."
        },
        {
          "id": "joinSeparator",
          "label": "Separator",
          "type": "select",
          "defaultValue": "comma",
          "options": [
            {
              "value": "comma",
              "label": "Comma"
            },
            {
              "value": "lineBreak",
              "label": "Line break"
            }
          ],
          "help": "Choose how the matching values should be separated in the output cell."
        }
      ]
    },
    "countRowsMultipleCriteria": {
      "id": "countRowsMultipleCriteria",
      "label": "Count Rows with Multiple Criteria",
      "explanation": "Counts rows from another sheet where both conditions are true.",
      "fields": [
        {
          "id": "countCriteriaReferenceOne",
          "label": "Criteria range 1 reference",
          "defaultValue": "Source Status",
          "help": "The cross-sheet reference for the first criteria column."
        },
        {
          "id": "countCriteriaValueOne",
          "label": "Criteria 1 value",
          "defaultValue": "Complete",
          "help": "The first exact text value to count."
        },
        {
          "id": "countCriteriaReferenceTwo",
          "label": "Criteria range 2 reference",
          "defaultValue": "Source Category",
          "help": "The cross-sheet reference for the second criteria column."
        },
        {
          "id": "countCriteriaValueTwo",
          "label": "Criteria 2 value",
          "defaultValue": "Renovation",
          "help": "The second exact text value to count."
        }
      ]
    },
    "sumValuesMultipleCriteria": {
      "id": "sumValuesMultipleCriteria",
      "label": "Sum Values with Multiple Criteria",
      "explanation": "Adds numeric values from rows that match multiple conditions.",
      "fields": [
        {
          "id": "sumValueReference",
          "label": "Source value reference",
          "defaultValue": "Source Amount",
          "help": "The cross-sheet reference that points to the numeric values to sum."
        },
        {
          "id": "sumCriteriaReferenceOne",
          "label": "Criteria range 1 reference",
          "defaultValue": "Source Status",
          "help": "The cross-sheet reference for the first criteria column."
        },
        {
          "id": "sumCriteriaValueOne",
          "label": "Criteria 1 value",
          "defaultValue": "Approved",
          "help": "The first exact text value to match."
        },
        {
          "id": "sumCriteriaReferenceTwo",
          "label": "Criteria range 2 reference",
          "defaultValue": "Source Category",
          "help": "The cross-sheet reference for the second criteria column."
        },
        {
          "id": "sumCriteriaValueTwo",
          "label": "Criteria 2 value",
          "defaultValue": "Renovation",
          "help": "The second exact text value to match."
        }
      ]
    },
    "averageValuesMultipleCriteria": {
      "id": "averageValuesMultipleCriteria",
      "label": "Average Values with Multiple Criteria",
      "explanation": "Calculates the average of values that match multiple conditions.",
      "fields": [
        {
          "id": "averageValueReference",
          "label": "Source value reference",
          "defaultValue": "Source Duration",
          "help": "The cross-sheet reference that points to the numeric values to average."
        },
        {
          "id": "averageCriteriaReferenceOne",
          "label": "Criteria range 1 reference",
          "defaultValue": "Source Status",
          "help": "The cross-sheet reference for the first criteria column."
        },
        {
          "id": "averageCriteriaValueOne",
          "label": "Criteria 1 value",
          "defaultValue": "Complete",
          "help": "The first exact text value to match."
        },
        {
          "id": "averageCriteriaReferenceTwo",
          "label": "Criteria range 2 reference",
          "defaultValue": "Source Category",
          "help": "The cross-sheet reference for the second criteria column."
        },
        {
          "id": "averageCriteriaValueTwo",
          "label": "Criteria 2 value",
          "defaultValue": "Renovation",
          "help": "The second exact text value to match."
        }
      ]
    },
    "matchingDateExtremes": {
      "id": "matchingDateExtremes",
      "label": "Latest or Earliest Matching Date",
      "explanation": "Finds the latest or earliest date related to the current row's lookup value.",
      "fields": [
        {
          "id": "matchingDateReference",
          "label": "Source date reference",
          "defaultValue": "Source Date",
          "help": "The cross-sheet reference that points to the source date column."
        },
        {
          "id": "matchingDateMatchReference",
          "label": "Source match reference",
          "defaultValue": "Source Match ID",
          "help": "The cross-sheet reference that points to the source match column."
        },
        {
          "id": "matchingDateLookupColumn",
          "label": "Current sheet lookup column",
          "defaultValue": "Lookup ID",
          "help": "The current-sheet column that contains the value to match."
        },
        {
          "id": "matchingDateResultType",
          "label": "Date result type",
          "type": "select",
          "defaultValue": "latest",
          "options": [
            {
              "value": "latest",
              "label": "Latest date"
            },
            {
              "value": "earliest",
              "label": "Earliest date"
            }
          ],
          "help": "Choose whether to return the newest or oldest matching date."
        }
      ]
    },
    "uniqueCountCriteria": {
      "id": "uniqueCountCriteria",
      "label": "Unique Count with Criteria",
      "explanation": "Counts unique matching values without double-counting repeated records.",
      "fields": [
        {
          "id": "uniqueValueReference",
          "label": "Source unique value reference",
          "defaultValue": "Source Project ID",
          "help": "The cross-sheet reference that points to the value to count once."
        },
        {
          "id": "uniqueCriteriaReferenceOne",
          "label": "Criteria range 1 reference",
          "defaultValue": "Source Status",
          "help": "The cross-sheet reference for the first criteria column."
        },
        {
          "id": "uniqueCriteriaValueOne",
          "label": "Criteria 1 value",
          "defaultValue": "Complete",
          "help": "The first exact text value to match."
        },
        {
          "id": "uniqueCriteriaReferenceTwo",
          "label": "Criteria range 2 reference",
          "defaultValue": "Source Category",
          "help": "The cross-sheet reference for the second criteria column."
        },
        {
          "id": "uniqueCriteriaValueTwo",
          "label": "Criteria 2 value",
          "defaultValue": "Renovation",
          "help": "The second exact text value to match."
        }
      ]
    },
    "parentChildRollup": {
      "id": "parentChildRollup",
      "label": "Parent/Child Rollup Summary",
      "explanation": "Rolls up child-row values into a parent row.",
      "fields": [
        {
          "id": "childValueColumn",
          "label": "Child value column",
          "defaultValue": "Amount",
          "help": "The current-sheet column that contains the child values to summarize."
        },
        {
          "id": "childRollupType",
          "label": "Rollup type",
          "type": "select",
          "defaultValue": "sum",
          "options": [
            {
              "value": "sum",
              "label": "Sum child values"
            },
            {
              "value": "count",
              "label": "Count child values"
            },
            {
              "value": "average",
              "label": "Average child values"
            },
            {
              "value": "maximum",
              "label": "Maximum child value"
            },
            {
              "value": "minimum",
              "label": "Minimum child value"
            },
            {
              "value": "checked",
              "label": "Count checked child boxes"
            }
          ],
          "help": "Choose how the child values should roll up to the parent row."
        }
      ]
    },
    "hierarchyLevelHelper": {
      "id": "hierarchyLevelHelper",
      "label": "Hierarchy Level Helper",
      "explanation": "Identifies how deeply a row is indented in the sheet hierarchy.",
      "fields": [
        {
          "id": "hierarchyLevelStart",
          "label": "Level numbering type",
          "type": "select",
          "defaultValue": "zero",
          "options": [
            {
              "value": "zero",
              "label": "Top level starts at 0"
            },
            {
              "value": "one",
              "label": "Top level starts at 1"
            }
          ],
          "help": "Choose whether top-level rows should return 0 or 1."
        }
      ]
    },
    "showParentValue": {
      "id": "showParentValue",
      "label": "Show Parent Value",
      "explanation": "Pulls the parent row's value into the current row.",
      "fields": [
        {
          "id": "parentValueColumn",
          "label": "Parent value column",
          "defaultValue": "Task Name",
          "help": "The current-sheet column whose parent value should appear on child rows."
        }
      ]
    },
    "multiSelectHasCheck": {
      "id": "multiSelectHasCheck",
      "label": "Multi-Select Contains / HAS Check",
      "explanation": "Checks whether a selected value exists in a multi-select dropdown or multi-contact cell.",
      "fields": [
        {
          "id": "multiSelectColumn",
          "label": "Multi-select column",
          "defaultValue": "Tags",
          "help": "The multi-select dropdown or multi-contact column to check."
        },
        {
          "id": "multiSelectValue",
          "label": "Value to check for",
          "defaultValue": "Risk",
          "help": "The selectable value that should be found in the cell."
        },
        {
          "id": "multiSelectOutputType",
          "label": "Output type",
          "type": "select",
          "defaultValue": "checkbox",
          "options": [
            {
              "value": "checkbox",
              "label": "Checkbox"
            },
            {
              "value": "yesNo",
              "label": "Yes/No text"
            },
            {
              "value": "foundBlank",
              "label": "Found/Blank text"
            }
          ],
          "help": "Choose the type of result the formula should return."
        }
      ]
    },
    "textBeforeAfterDelimiter": {
      "id": "textBeforeAfterDelimiter",
      "label": "Text Before / After Delimiter",
      "explanation": "Splits combined text into the portion before or after a selected delimiter.",
      "fields": [
        {
          "id": "delimiterSourceColumn",
          "label": "Source text column",
          "defaultValue": "Combined Text",
          "help": "The current-sheet text column that contains the combined value."
        },
        {
          "id": "delimiterText",
          "label": "Delimiter",
          "defaultValue": "-",
          "help": "The delimiter exactly as it appears in the source text."
        },
        {
          "id": "delimiterExtractType",
          "label": "Extract type",
          "type": "select",
          "defaultValue": "before",
          "options": [
            {
              "value": "before",
              "label": "Text before delimiter"
            },
            {
              "value": "after",
              "label": "Text after delimiter"
            }
          ],
          "help": "Choose which side of the delimiter should be returned."
        }
      ]
    },
    "readyToStartBasedOnPredecessors": {
      "id": "readyToStartBasedOnPredecessors",
      "label": "Ready to Start Based on Predecessors",
      "explanation": "Returns whether a task is complete, ready to start, or blocked by unfinished predecessor work.",
      "fields": [
        {
          "id": "openPredecessorCountColumn",
          "label": "Open predecessor count column",
          "defaultValue": "Open Predecessor Count",
          "help": "The current-sheet column that stores the number of unfinished predecessor tasks."
        },
        {
          "id": "readinessStatusColumn",
          "label": "Status column",
          "defaultValue": "Status",
          "help": "The current-sheet status column."
        },
        {
          "id": "readinessCompleteStatus",
          "label": "Complete status value",
          "defaultValue": "Complete",
          "help": "The status value that means the task is complete."
        },
        {
          "id": "readinessReadyValue",
          "label": "Ready output value",
          "defaultValue": "Ready",
          "help": "The value to return when open predecessor count is zero."
        },
        {
          "id": "readinessBlockedValue",
          "label": "Blocked output value",
          "defaultValue": "Blocked",
          "help": "The value to return when open predecessor count is greater than zero."
        },
        {
          "id": "readinessCompleteValue",
          "label": "Complete output value",
          "defaultValue": "Complete",
          "help": "The value to return when the status already shows complete."
        }
      ]
    },
    "rankedValue": {
      "id": "rankedValue",
      "label": "Top N / Nth Highest or Lowest Value",
      "explanation": "Returns a ranked value from a set of numbers, such as the highest priority score, second-highest cost, lowest variance, or third-lowest duration.",
      "fields": [
        {
          "id": "rankedValueReference",
          "label": "Source value reference",
          "defaultValue": "Source Score",
          "help": "The cross-sheet reference that points to the numeric values to rank."
        },
        {
          "id": "rankNumber",
          "label": "Rank number",
          "defaultValue": "1",
          "help": "The rank to return. Use 1 for the highest or lowest value."
        },
        {
          "id": "rankingType",
          "label": "Ranking type",
          "type": "select",
          "defaultValue": "highest",
          "options": [
            {
              "value": "highest",
              "label": "Nth highest"
            },
            {
              "value": "lowest",
              "label": "Nth lowest"
            }
          ],
          "help": "Choose whether to rank from the top or bottom of the source values."
        }
      ],
      "validationRule": "positiveWholeNumberRank"
    }
  };

  const configuration = {
    "maxLocationWordsToCheck": 6,
    "monthNameSortValues": [
      {
        "name": "January",
        "value": 1
      },
      {
        "name": "February",
        "value": 2
      },
      {
        "name": "March",
        "value": 3
      },
      {
        "name": "April",
        "value": 4
      },
      {
        "name": "May",
        "value": 5
      },
      {
        "name": "June",
        "value": 6
      },
      {
        "name": "July",
        "value": 7
      },
      {
        "name": "August",
        "value": 8
      },
      {
        "name": "September",
        "value": 9
      },
      {
        "name": "October",
        "value": 10
      },
      {
        "name": "November",
        "value": 11
      },
      {
        "name": "December",
        "value": 12
      }
    ]
  };

  globalThis.SmartsheetFormulaBuilder = { catalog, configuration };
})();
