// Classic-script module; no build step or browser APIs required.
(() => {
  const catalog = {
    "appendFinishDateLabel": {
      "id": "appendFinishDateLabel",
      "label": "Append Date to Text",
      "explanation": "Appends a date to text from the current row, separated by \" - \". When the date is blank, returns the original text.",
      "fields": [
        {
          "id": "milestoneLabelColumn",
          "label": "Text column",
          "defaultValue": "Item Name",
          "help": "The current-sheet column containing the text to keep before the date."
        },
        {
          "id": "finishDateColumn",
          "label": "Date column",
          "defaultValue": "Date",
          "help": "The current-sheet date column to append when it has a value."
        }
      ],
      "categoryId": "text-labels",
      "keywords": [
        "append",
        "date",
        "text",
        "concatenate"
      ]
    },
    "scheduleMovedWorkdays": {
      "id": "scheduleMovedWorkdays",
      "label": "Schedule Movement in Weekdays",
      "explanation": "Calculates signed weekday movement between an original date and a revised date. Positive values indicate a later date; negative values indicate an earlier date. Blank input dates return blank.",
      "fields": [
        {
          "id": "originalDateColumn",
          "label": "Original date column",
          "defaultValue": "Original Date",
          "help": "The original or baseline date on the current sheet."
        },
        {
          "id": "updatedDateColumn",
          "label": "Updated date column",
          "defaultValue": "New Date",
          "help": "The revised date on the current sheet."
        }
      ],
      "categoryId": "dates-status",
      "keywords": [
        "weekday variance",
        "schedule movement",
        "NETWORKDAYS"
      ]
    },
    "twoCriteriaLookup": {
      "id": "twoCriteriaLookup",
      "label": "Cross-Sheet Two-Criteria Lookup",
      "explanation": "Returns the first source value from another sheet where both source criteria match the current row. Returns blank if the lookup produces an error.",
      "fields": [
        {
          "id": "lookupCurrentCriteriaOneColumn",
          "label": "Current sheet criteria column 1",
          "defaultValue": "Record ID",
          "help": "The first value to match from the current row."
        },
        {
          "id": "lookupCurrentCriteriaTwoColumn",
          "label": "Current sheet criteria column 2",
          "defaultValue": "Category",
          "help": "The second value to match from the current row."
        },
        {
          "id": "lookupSourceSheetName",
          "label": "Source sheet name",
          "defaultValue": "Lookup Data",
          "help": "The Smartsheet sheet that contains the lookup data."
        },
        {
          "id": "lookupSourceReturnColumn",
          "label": "Source return column",
          "defaultValue": "Result",
          "help": "The source-sheet column that contains the value you want returned."
        },
        {
          "id": "lookupSourceCriteriaOneColumn",
          "label": "Source criteria column 1",
          "defaultValue": "Record ID",
          "help": "The source-sheet column that should match criteria column 1."
        },
        {
          "id": "lookupSourceCriteriaTwoColumn",
          "label": "Source criteria column 2",
          "defaultValue": "Category",
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
          "defaultValue": "Criteria 1 Range",
          "help": "The name to use for the first cross-sheet criteria range."
        },
        {
          "id": "lookupCriteriaTwoReference",
          "label": "Criteria 2 range reference name",
          "defaultValue": "Criteria 2 Range",
          "help": "The name to use for the second cross-sheet criteria range."
        }
      ],
      "categoryId": "lookups-matching",
      "keywords": [
        "lookup",
        "two criteria",
        "cross sheet",
        "COLLECT"
      ]
    },
    "checkboxMatch": {
      "id": "checkboxMatch",
      "label": "Checkbox Based on Cross-Sheet Match",
      "explanation": "Checks a box when the current row's configured value appears in a reference range from another sheet.",
      "fields": [
        {
          "id": "checkboxCurrentMatchColumn",
          "label": "Current sheet match column",
          "defaultValue": "Record ID",
          "help": "The value from the current row to search for in another sheet."
        },
        {
          "id": "checkboxSourceSheetName",
          "label": "Source sheet name",
          "defaultValue": "Lookup Data",
          "help": "The sheet containing the source values to match."
        },
        {
          "id": "checkboxSourceMatchColumn",
          "label": "Source match column",
          "defaultValue": "Related Record ID",
          "help": "The source-sheet column that should contain the current row value."
        },
        {
          "id": "checkboxMatchReference",
          "label": "Match range reference name",
          "defaultValue": "Source Match Range",
          "help": "The name to use for the cross-sheet match range."
        }
      ],
      "categoryId": "lookups-matching",
      "keywords": [
        "checkbox",
        "match",
        "cross sheet",
        "COUNTIF"
      ]
    },
    "rioIdLookup": {
      "id": "rioIdLookup",
      "label": "Cross-Sheet First-Match Lookup",
      "explanation": "Returns the first value from another sheet where the source match column equals the current row's lookup value. Returns blank if the lookup produces an error.",
      "fields": [
        {
          "id": "rioCurrentIdColumn",
          "label": "Current sheet lookup column",
          "defaultValue": "Record ID",
          "help": "The current-sheet column containing the lookup value to match."
        },
        {
          "id": "rioSourceSheetName",
          "label": "Source sheet name",
          "defaultValue": "Lookup Data",
          "help": "The sheet containing the return and match columns."
        },
        {
          "id": "rioSourceIdColumn",
          "label": "Source return column",
          "defaultValue": "Result",
          "help": "The source-sheet column containing the value to return."
        },
        {
          "id": "rioSourceMatchColumn",
          "label": "Source match column",
          "defaultValue": "Record ID",
          "help": "The source-sheet column to compare with the current row's lookup value."
        },
        {
          "id": "rioIdReference",
          "label": "Return range reference name",
          "defaultValue": "Source Return Range",
          "help": "The name to use for the cross-sheet return range."
        },
        {
          "id": "rioMatchReference",
          "label": "Match range reference name",
          "defaultValue": "Source Match Range",
          "help": "The name to use for the cross-sheet match range."
        }
      ],
      "categoryId": "lookups-matching",
      "keywords": [
        "lookup",
        "first match",
        "return value",
        "cross sheet",
        "COLLECT"
      ]
    },
    "buildMilestoneId": {
      "id": "buildMilestoneId",
      "label": "Combine Three Columns into Text",
      "explanation": "Combines three current-row columns in the fixed pattern \"Prefix - Middle Final\". Returns blank when the prefix is blank.",
      "fields": [
        {
          "id": "milestoneNumberColumn",
          "label": "Prefix column",
          "defaultValue": "Record ID",
          "help": "The first value in the combined text. If this cell is blank, the output is blank."
        },
        {
          "id": "locationColumn",
          "label": "Middle column",
          "defaultValue": "Group",
          "help": "The value placed after the prefix and \" - \" separator."
        },
        {
          "id": "taskNameColumn",
          "label": "Final column",
          "defaultValue": "Name",
          "help": "The value placed after the middle value and a single space."
        }
      ],
      "categoryId": "text-labels",
      "keywords": [
        "combine",
        "concatenate",
        "three columns",
        "text"
      ]
    },
    "shortenLocationName": {
      "id": "shortenLocationName",
      "label": "Extract Longest Word (First 6 Words)",
      "explanation": "Returns the longest word among the first six space-separated words in the source text. Ties favor the earliest matching word. Blank source text returns blank.",
      "fields": [
        {
          "id": "locationNameColumn",
          "label": "Source text column (first 6 words)",
          "defaultValue": "Text",
          "help": "The current-sheet text column to inspect. The formula returns the longest of its first six space-separated words, not an abbreviation."
        }
      ],
      "categoryId": "text-labels",
      "keywords": [
        "longest word",
        "first six words",
        "text extraction"
      ]
    },
    "countCheckboxValues": {
      "id": "countCheckboxValues",
      "label": "Count Checkbox Values",
      "explanation": "Counts checked, unchecked, or both checkbox states from another sheet.",
      "fields": [
        {
          "id": "checkboxCountReference",
          "label": "Cross-sheet checkbox reference name",
          "defaultValue": "Source Checkbox Range",
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
      ],
      "categoryId": "counts-calculations",
      "keywords": [
        "checkbox",
        "checked",
        "unchecked",
        "COUNTIF"
      ]
    },
    "monthNameSortNumber": {
      "id": "monthNameSortNumber",
      "label": "Convert Month Name to Number",
      "explanation": "Converts full English month names to numbers from 1 to 12 for calendar-order sorting. Blank or unrecognized names return blank.",
      "fields": [
        {
          "id": "monthNameColumn",
          "label": "Month name column",
          "defaultValue": "Month Name",
          "help": "The current-sheet column containing a full English month name, such as January or February."
        }
      ],
      "categoryId": "text-labels",
      "keywords": [
        "month name",
        "month number",
        "calendar order"
      ]
    },
    "statusIndicator": {
      "id": "statusIndicator",
      "label": "Schedule Health Indicator",
      "explanation": "Returns Green for completed tasks, Red for overdue tasks or tasks whose start date has passed while their status is not started, and Yellow otherwise. Uses the current row's start date, finish date, and status.",
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
      ],
      "categoryId": "dates-status",
      "keywords": [
        "schedule health",
        "overdue",
        "red yellow green",
        "status"
      ]
    },
    "multiLineReportLabel": {
      "id": "multiLineReportLabel",
      "label": "Multi-Line Task Assignment Label",
      "explanation": "Creates a fixed multi-line task assignment label containing a task, location, and up to three assignees. Output labels are \"Task Lead:\", \"Task Second:\", and \"Task Third:\"; the second and third assignee lines are omitted when their cells are blank.",
      "fields": [
        {
          "id": "reportTaskColumn",
          "label": "Task column",
          "defaultValue": "Task Name",
          "help": "The current-sheet column containing the task name."
        },
        {
          "id": "reportLocationColumn",
          "label": "Location column",
          "defaultValue": "Location",
          "help": "The current-sheet column that stores the location name."
        },
        {
          "id": "leadOwnerColumn",
          "label": "Primary assignee column",
          "defaultValue": "Task Lead",
          "help": "The column for the fixed \"Task Lead:\" output line."
        },
        {
          "id": "secondaryOwnerColumn",
          "label": "Second assignee column",
          "defaultValue": "Task Second",
          "help": "The column for the fixed \"Task Second:\" output line. The column name is required; a blank cell omits this line."
        },
        {
          "id": "tertiaryOwnerColumn",
          "label": "Third assignee column",
          "defaultValue": "Task Third",
          "help": "The column for the fixed \"Task Third:\" output line. The column name is required; a blank cell omits this line."
        }
      ],
      "categoryId": "text-labels",
      "keywords": [
        "task assignment",
        "assignees",
        "multiline text",
        "CHAR(10)"
      ]
    },
    "spendDateAttribute": {
      "id": "spendDateAttribute",
      "label": "Date Attribute for Checked Rows",
      "explanation": "For checked rows, returns the year, calendar quarter, or month number from the preferred date, using the fallback date when the preferred date is blank. Unchecked rows return blank.",
      "fields": [
        {
          "id": "spendingMilestoneColumn",
          "label": "Include row checkbox column",
          "defaultValue": "Include Row",
          "help": "The checkbox column identifying rows that should return a date attribute."
        },
        {
          "id": "spendStartColumn",
          "label": "Fallback date column",
          "defaultValue": "Fallback Date",
          "help": "The date to use when the preferred date cell is blank."
        },
        {
          "id": "spendFinishColumn",
          "label": "Preferred date column",
          "defaultValue": "Date",
          "help": "The date to use first when its cell has a value."
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
          "help": "Choose year, calendar quarter (Q1-Q4), or month number."
        }
      ],
      "categoryId": "dates-status",
      "keywords": [
        "checked rows",
        "date attribute",
        "year",
        "calendar quarter",
        "month",
        "fallback date"
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
      ],
      "categoryId": "lookups-matching",
      "keywords": [
        "lookup",
        "cross sheet",
        "INDEX",
        "MATCH"
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
      ],
      "categoryId": "lookups-matching",
      "keywords": [
        "join",
        "matching values",
        "distinct",
        "COLLECT",
        "line breaks"
      ]
    },
    "countRowsMultipleCriteria": {
      "id": "countRowsMultipleCriteria",
      "label": "Count Rows Matching Two Criteria",
      "explanation": "Counts rows from another sheet where both configured text criteria match.",
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
          "defaultValue": "Category A",
          "help": "The second exact text value to count."
        }
      ],
      "categoryId": "counts-calculations",
      "keywords": [
        "count",
        "two criteria",
        "COUNTIFS"
      ]
    },
    "sumValuesMultipleCriteria": {
      "id": "sumValuesMultipleCriteria",
      "label": "Sum Values Matching Two Criteria",
      "explanation": "Sums numeric values from another sheet where both configured text criteria match.",
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
          "defaultValue": "Category A",
          "help": "The second exact text value to match."
        }
      ],
      "categoryId": "counts-calculations",
      "keywords": [
        "sum",
        "two criteria",
        "SUMIFS"
      ]
    },
    "averageValuesMultipleCriteria": {
      "id": "averageValuesMultipleCriteria",
      "label": "Average Values Matching Two Criteria",
      "explanation": "Averages numeric values from another sheet where both configured text criteria match. Returns blank if the calculation produces an error.",
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
          "defaultValue": "Category A",
          "help": "The second exact text value to match."
        }
      ],
      "categoryId": "counts-calculations",
      "keywords": [
        "average",
        "two criteria",
        "AVG",
        "COLLECT"
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
      ],
      "categoryId": "dates-status",
      "keywords": [
        "latest date",
        "earliest date",
        "MIN",
        "MAX",
        "COLLECT"
      ]
    },
    "uniqueCountCriteria": {
      "id": "uniqueCountCriteria",
      "label": "Count Unique Values Matching Two Criteria",
      "explanation": "Counts distinct values from another sheet where both configured text criteria match, without double-counting repeated values.",
      "fields": [
        {
          "id": "uniqueValueReference",
          "label": "Source unique value reference",
          "defaultValue": "Source Record ID",
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
          "defaultValue": "Category A",
          "help": "The second exact text value to match."
        }
      ],
      "categoryId": "counts-calculations",
      "keywords": [
        "unique count",
        "distinct",
        "two criteria",
        "COLLECT"
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
      ],
      "categoryId": "row-hierarchy",
      "keywords": [
        "parent",
        "children",
        "rollup",
        "sum",
        "average"
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
      ],
      "categoryId": "row-hierarchy",
      "keywords": [
        "hierarchy",
        "indent level",
        "ancestors"
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
      ],
      "categoryId": "row-hierarchy",
      "keywords": [
        "parent",
        "row hierarchy",
        "inherit value"
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
      ],
      "categoryId": "lookups-matching",
      "keywords": [
        "multi select",
        "contains",
        "HAS",
        "tags",
        "contacts"
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
      ],
      "categoryId": "text-labels",
      "keywords": [
        "text extraction",
        "delimiter",
        "before",
        "after",
        "split"
      ]
    },
    "readyToStartBasedOnPredecessors": {
      "id": "readyToStartBasedOnPredecessors",
      "label": "Task Readiness from Open Predecessor Count",
      "explanation": "Returns a task's complete, ready, or blocked status using an existing open-predecessor count. This formula does not calculate predecessor relationships or the count itself.",
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
          "help": "The value to return when the task is not complete and the open predecessor count is not zero."
        },
        {
          "id": "readinessCompleteValue",
          "label": "Complete output value",
          "defaultValue": "Complete",
          "help": "The value to return when the status already shows complete."
        }
      ],
      "categoryId": "dates-status",
      "keywords": [
        "task readiness",
        "open predecessor count",
        "blocked",
        "ready"
      ]
    },
    "rankedValue": {
      "id": "rankedValue",
      "label": "Nth Highest or Lowest Value",
      "explanation": "Returns one Nth highest or Nth lowest numeric value from a source range, such as the second-highest amount or third-lowest duration. It does not return a list of the top N values.",
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
      "validationRule": "positiveWholeNumberRank",
      "categoryId": "counts-calculations",
      "keywords": [
        "nth highest",
        "nth lowest",
        "rank",
        "LARGE",
        "SMALL"
      ]
    }
  };

  const categories = [
    {
      "id": "text-labels",
      "label": "Text & labels"
    },
    {
      "id": "dates-status",
      "label": "Dates & status"
    },
    {
      "id": "lookups-matching",
      "label": "Lookups & matching"
    },
    {
      "id": "counts-calculations",
      "label": "Counts & calculations"
    },
    {
      "id": "row-hierarchy",
      "label": "Row hierarchy"
    }
  ];

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

  globalThis.SmartsheetFormulaBuilder = { catalog, categories, configuration };
})();
