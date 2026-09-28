// Classic-script module; no build step or browser APIs required.
(() => {
  const catalog = {
    "appendFinishDateLabel": {
      "id": "appendFinishDateLabel",
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": false,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": false,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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
      "libraryId": "advanced",
      "availability": {
        "extension": true,
        "portfolio": true
      },
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

  // Phase 5 Batch 1: extension-first Common formulas, after the unchanged Advanced entries.
  Object.assign(catalog, {
    roundValue: {
      id: "roundValue", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "ROUND", explanation: "Round a number to a chosen number of decimal places.",
      inputContract: "structured-v1", builderKey: "decimalRounding", builderOptions: { functionName: "ROUND" },
      guidance: {
        "setupNotes": [
          "No special setup is required. Enter the number directly or choose a current-row cell containing it."
        ],
        "instructions": [
          "Enter a number or choose a current-row cell containing it.",
          "Include Decimal places to specify an integer precision, or leave it excluded to omit that argument.",
          "Copy the formula to the cell where you want the rounded value."
        ]
      },
      fields: [
        { id: "value", label: "Number", type: "numericOperand", required: true, help: "Enter a number or choose a current-row column containing a number." },
        { id: "decimalPlaces", label: "Decimal places", type: "integer", required: false, help: "Include to specify an integer number of decimal places, including zero or a negative integer. Leave excluded to omit this argument." }
      ],
      categoryId: "counts-calculations", keywords: ["round", "rounding", "decimal places", "round a number", "round to whole number"]
    },
    absoluteValue: {
      id: "absoluteValue", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "ABS", explanation: "Return the absolute value of a number.",
      inputContract: "structured-v1", builderKey: "unaryNumeric", builderOptions: { functionName: "ABS" },
      guidance: {
        "setupNotes": [
          "No special setup is required. Enter a number directly or choose a current-row cell."
        ],
        "instructions": [
          "Enter the number or choose its current-row cell.",
          "Copy the formula to the cell where you want the absolute value."
        ]
      },
      fields: [
        { id: "value", label: "Number", type: "numericOperand", required: true, help: "Enter a number or choose a current-row column containing a number." }
      ],
      categoryId: "counts-calculations", keywords: ["abs", "absolute value", "remove negative sign", "number magnitude"]
    },
    textToNumber: {
      id: "textToNumber", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "VALUE", explanation: "Convert text representing a number into a numeric value.",
      inputContract: "structured-v1", builderKey: "unaryNumeric", builderOptions: { functionName: "VALUE" },
      guidance: {
        "setupNotes": [
          "No special setup is required. The source should contain text that Smartsheet can convert to a number."
        ],
        "instructions": [
          "Choose Specific text string and enter the numeric text, or choose a current-row cell containing it.",
          "Entered text must contain more than spaces.",
          "Copy the formula to the cell where you want the numeric value."
        ]
      },
      fields: [
        { id: "value", label: "Text", type: "textOperand", required: true, help: "Enter nonempty text representing a number, or choose a current-row column. Smartsheet performs the conversion." }
      ],
      categoryId: "counts-calculations", keywords: ["value", "text to number", "convert text to number", "numeric text", "number stored as text"]
    },
    ceilingValue: {
      id: "ceilingValue", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "CEILING", explanation: "Round a number using a specified multiple.",
      inputContract: "structured-v1", builderKey: "multipleRounding", builderOptions: { functionName: "CEILING" },
      guidance: {
        "setupNotes": [
          "No special setup is required. The value and rounding multiple can be entered directly or selected from current-row cells."
        ],
        "instructions": [
          "Choose the number to round.",
          "Enter the multiple or select the cell containing it.",
          "Copy the formula to the cell where you want the CEILING result."
        ]
      },
      fields: [
        { id: "value", label: "Number", type: "numericOperand", required: true, help: "Enter a number or choose a current-row column containing a number." },
        { id: "multiple", label: "Multiple", type: "numericOperand", required: true, help: "Enter the multiple or choose a current-row column containing it. Smartsheet evaluates the argument combination." }
      ],
      categoryId: "counts-calculations", keywords: ["ceiling", "round up to a multiple", "round to increment", "significance"]
    },
    floorValue: {
      id: "floorValue", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "FLOOR", explanation: "Round a number to a specified multiple using FLOOR.",
      inputContract: "structured-v1", builderKey: "multipleRounding", builderOptions: { functionName: "FLOOR" },
      guidance: {
        "setupNotes": [
          "No special setup is required. The value and rounding multiple can be entered directly or selected from current-row cells."
        ],
        "instructions": [
          "Choose the number to round.",
          "Enter the multiple or select the cell containing it.",
          "Copy the formula to the cell where you want the FLOOR result."
        ]
      },
      fields: [
        { id: "value", label: "Number", type: "numericOperand", required: true, help: "Enter a number or choose a current-row column containing a number." },
        { id: "multiple", label: "Multiple", type: "numericOperand", required: true, help: "Enter the multiple or choose a current-row column containing it. Smartsheet evaluates the argument combination." }
      ],
      categoryId: "counts-calculations", keywords: ["floor", "round down to a multiple", "round to increment", "multiple", "significance"]
    },
    roundUpValue: {
      id: "roundUpValue", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "ROUNDUP", explanation: "Round a number up to a chosen number of decimal places.",
      inputContract: "structured-v1", builderKey: "decimalRounding", builderOptions: { functionName: "ROUNDUP" },
      guidance: {
        "setupNotes": [
          "No special setup is required. Enter the number directly or choose a current-row cell containing it."
        ],
        "instructions": [
          "Enter a number or choose a current-row cell containing it.",
          "Include Decimal places to specify an integer precision, or leave it excluded to omit that argument.",
          "Copy the formula to the cell where you want the ROUNDUP result."
        ]
      },
      fields: [
        { id: "value", label: "Number", type: "numericOperand", required: true, help: "Enter a number or choose a current-row column containing a number." },
        { id: "decimalPlaces", label: "Decimal places", type: "integer", required: false, help: "Include to specify an integer number of decimal places, including zero or a negative integer. Leave excluded to omit this argument." }
      ],
      categoryId: "counts-calculations", keywords: ["roundup", "round up", "round upward", "decimal places"]
    },
    roundDownValue: {
      id: "roundDownValue", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "ROUNDDOWN", explanation: "Round a number down to a chosen number of decimal places.",
      inputContract: "structured-v1", builderKey: "decimalRounding", builderOptions: { functionName: "ROUNDDOWN" },
      guidance: {
        "setupNotes": [
          "No special setup is required. Enter the number directly or choose a current-row cell containing it."
        ],
        "instructions": [
          "Enter a number or choose a current-row cell containing it.",
          "Include Decimal places to specify an integer precision, or leave it excluded to omit that argument.",
          "Copy the formula to the cell where you want the ROUNDDOWN result."
        ]
      },
      fields: [
        { id: "value", label: "Number", type: "numericOperand", required: true, help: "Enter a number or choose a current-row column containing a number." },
        { id: "decimalPlaces", label: "Decimal places", type: "integer", required: false, help: "Include to specify an integer number of decimal places, including zero or a negative integer. Leave excluded to omit this argument." }
      ],
      categoryId: "counts-calculations", keywords: ["rounddown", "round down", "round downward", "decimal places"]
    },
    integerPortion: {
      id: "integerPortion", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "INT", explanation: "Return the integer portion of a number.",
      inputContract: "structured-v1", builderKey: "unaryNumeric", builderOptions: { functionName: "INT" },
      guidance: {
        "setupNotes": [
          "No special setup is required. Enter the number directly or choose a current-row cell."
        ],
        "instructions": [
          "Enter the number or choose its current-row cell.",
          "Copy the formula to the cell where you want the integer result."
        ]
      },
      fields: [
        { id: "value", label: "Number", type: "numericOperand", required: true, help: "Enter a number or choose a current-row column containing a number." }
      ],
      categoryId: "counts-calculations", keywords: ["int", "integer portion", "whole number portion", "integer part"]
    }
  });

  // Phase 5 Batch 2: text formulas use existing structured operands and controls.
  Object.assign(catalog, {
    leftText: {
      id: "leftText", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "LEFT", explanation: "Extract characters from the beginning of text.",
      inputContract: "structured-v1", builderKey: "textSlice", builderOptions: { functionName: "LEFT" },
      guidance: {
        "setupNotes": [
          "No special setup is required. The source can be entered text or a current-row cell."
        ],
        "instructions": [
          "Choose Specific text string or a current-row cell for the source.",
          "Include Number of characters to specify a whole-number count of zero or more, or leave it excluded to omit that argument.",
          "Copy the formula to the cell where you want the extracted text."
        ]
      },
      fields: [
        { id: "text", label: "Text", type: "textOperand", required: true, help: "Enter text, including empty text or spaces, or choose a current-row column." },
        { id: "numChars", label: "Number of characters", type: "integer", required: false, min: "0", help: "Include a whole-number character count of zero or more. Leave excluded to omit this argument." }
      ],
      categoryId: "text-labels", keywords: ["left", "first characters", "beginning of text", "extract text prefix"]
    },
    rightText: {
      id: "rightText", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "RIGHT", explanation: "Extract characters from the end of text.",
      inputContract: "structured-v1", builderKey: "textSlice", builderOptions: { functionName: "RIGHT" },
      guidance: {
        "setupNotes": [
          "No special setup is required. The source can be entered text or a current-row cell."
        ],
        "instructions": [
          "Choose Specific text string or a current-row cell for the source.",
          "Include Number of characters to specify a whole-number count of zero or more, or leave it excluded to omit that argument.",
          "Copy the formula to the cell where you want the extracted text."
        ]
      },
      fields: [
        { id: "text", label: "Text", type: "textOperand", required: true, help: "Enter text, including empty text or spaces, or choose a current-row column." },
        { id: "numChars", label: "Number of characters", type: "integer", required: false, min: "0", help: "Include a whole-number character count of zero or more. Leave excluded to omit this argument." }
      ],
      categoryId: "text-labels", keywords: ["right", "last characters", "end of text", "extract text suffix"]
    },
    midText: {
      id: "midText", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "MID", explanation: "Extract a section of text using a starting position and character count.",
      inputContract: "structured-v1", builderKey: "textSlice", builderOptions: { functionName: "MID" },
      guidance: {
        "setupNotes": [
          "No special setup is required. The source can be entered text or a current-row cell."
        ],
        "instructions": [
          "Choose Specific text string or a current-row cell for the source.",
          "Enter a Start position of at least 1 and a Number of characters of zero or more.",
          "Copy the formula to the cell where you want the extracted section."
        ]
      },
      fields: [
        { id: "text", label: "Text", type: "textOperand", required: true, help: "Enter text, including empty text or spaces, or choose a current-row column." },
        { id: "startPosition", label: "Start position", type: "integer", required: true, min: "1", help: "Enter a whole-number starting position of one or more." },
        { id: "numChars", label: "Number of characters", type: "integer", required: true, min: "0", help: "Enter a whole-number character count of zero or more. Smartsheet evaluates the requested text section." }
      ],
      categoryId: "text-labels", keywords: ["mid", "middle of text", "extract substring", "text starting position"]
    },
    textLength: {
      id: "textLength", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "LEN", explanation: "Count characters in text, including spaces.",
      inputContract: "structured-v1", builderKey: "textUnary", builderOptions: { functionName: "LEN" },
      guidance: {
        "setupNotes": [
          "No special setup is required. The source can be entered text or a current-row cell."
        ],
        "instructions": [
          "Choose Specific text string or a current-row cell containing the text to measure.",
          "Copy the formula to the cell where you want the character count."
        ]
      },
      fields: [
        { id: "text", label: "Text", type: "textOperand", required: true, help: "Enter text, including empty text or spaces, or choose a current-row column." }
      ],
      categoryId: "text-labels", keywords: ["len", "text length", "count characters", "number of characters"]
    },
    findTextPosition: {
      id: "findTextPosition", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "FIND", explanation: "Find the starting position of text within another text value.",
      inputContract: "structured-v1", builderKey: "textSearch", builderOptions: { functionName: "FIND" },
      guidance: {
        "setupNotes": [
          "No special setup is required. Both the search text and the text being searched can be entered directly or selected from current-row cells."
        ],
        "instructions": [
          "Set Text to find and Text to search using entered text or current-row cells.",
          "Include Start position to specify where the search begins, or leave it excluded to omit that argument.",
          "Copy the formula to the cell where you want the position result."
        ]
      },
      fields: [
        { id: "searchFor", label: "Text to find", type: "textOperand", required: true, help: "Enter search text, including empty text or spaces, or choose a current-row column." },
        { id: "textToSearch", label: "Text to search", type: "textOperand", required: true, help: "Enter the text to search or choose a current-row column. Empty text and spaces are allowed." },
        { id: "startPosition", label: "Start position", type: "integer", required: false, min: "1", help: "Include a whole-number starting position of one or more. Leave excluded to omit this argument." }
      ],
      categoryId: "text-labels", keywords: ["find", "find text position", "locate substring", "search within text"]
    },
    containsText: {
      id: "containsText", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "CONTAINS", explanation: "Check whether text occurs in a cell or range and return True or False.",
      inputContract: "structured-v1", builderKey: "textSearch", builderOptions: { functionName: "CONTAINS" },
      guidance: {
        "setupNotes": [
          "No special setup is required for current-row cells, whole columns, or current-sheet ranges. For a cross-sheet target, create the named reference in Smartsheet before using the formula."
        ],
        "instructions": [
          "Enter the Text to find or choose a current-row cell containing it.",
          "Choose the Cell or range to search and complete its column or reference fields.",
          "Copy the formula to the cell where you want the True or False result."
        ]
      },
      fields: [
        { id: "searchFor", label: "Text to find", type: "textOperand", required: true, help: "Enter search text, including empty text or spaces, or choose a current-row column." },
        { id: "range", label: "Cell or range to search", type: "valueOrRange", required: true, allowedTypes: ["cellRef", "columnRef", "rangeRef"], help: "Choose a current-row cell, whole column, current-sheet column span, or cross-sheet named reference. Create named references in Smartsheet before using the formula." }
      ],
      categoryId: "text-labels", keywords: ["contains", "contains text", "search text in cells", "text in a range"]
    },
    lowerText: {
      id: "lowerText", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "LOWER", explanation: "Convert text to lowercase.",
      inputContract: "structured-v1", builderKey: "textUnary", builderOptions: { functionName: "LOWER" },
      guidance: {
        "setupNotes": [
          "No special setup is required. The source can be entered text or a current-row cell."
        ],
        "instructions": [
          "Choose Specific text string or a current-row cell containing the source.",
          "Copy the formula to the cell where you want the lowercase text."
        ]
      },
      fields: [
        { id: "text", label: "Text", type: "textOperand", required: true, help: "Enter text, including empty text or spaces, or choose a current-row column. Smartsheet performs the case conversion." }
      ],
      categoryId: "text-labels", keywords: ["lower", "lowercase", "convert to lowercase", "small letters"]
    },
    upperText: {
      id: "upperText", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "UPPER", explanation: "Convert text to uppercase.",
      inputContract: "structured-v1", builderKey: "textUnary", builderOptions: { functionName: "UPPER" },
      guidance: {
        "setupNotes": [
          "No special setup is required. The source can be entered text or a current-row cell."
        ],
        "instructions": [
          "Choose Specific text string or a current-row cell containing the source.",
          "Copy the formula to the cell where you want the uppercase text."
        ]
      },
      fields: [
        { id: "text", label: "Text", type: "textOperand", required: true, help: "Enter text, including empty text or spaces, or choose a current-row column. Smartsheet performs the case conversion." }
      ],
      categoryId: "text-labels", keywords: ["upper", "uppercase", "convert to uppercase", "capital letters"]
    },
    substituteText: {
      id: "substituteText", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "SUBSTITUTE", explanation: "Replace matching text within a text value.",
      inputContract: "structured-v1", builderKey: "textReplace", builderOptions: { functionName: "SUBSTITUTE" },
      guidance: {
        "setupNotes": [
          "No special setup is required. Source text, text to replace, and replacement text can each use entered text or a current-row cell."
        ],
        "instructions": [
          "Set Source text, Text to replace, and Replacement text. Replacement text may be empty.",
          "Include Occurrence number to specify an occurrence of 1 or more, or leave it excluded to omit that argument.",
          "Copy the formula to the cell where you want the substituted text."
        ]
      },
      fields: [
        { id: "text", label: "Source text", type: "textOperand", required: true, help: "Enter source text, including empty text or spaces, or choose a current-row column." },
        { id: "oldText", label: "Text to replace", type: "textOperand", required: true, help: "Enter the text to replace or choose a current-row column. Empty text and spaces are allowed." },
        { id: "newText", label: "Replacement text", type: "textOperand", required: true, help: "Enter replacement text or choose a current-row column. Empty replacement text can remove matching text." },
        { id: "instanceNumber", label: "Occurrence number", type: "integer", required: false, min: "1", help: "Include a whole-number occurrence of one or more. Leave excluded to omit this argument. Smartsheet performs the replacement." }
      ],
      categoryId: "text-labels", keywords: ["substitute", "replace matching text", "replace text occurrence", "find and replace text"]
    },
    replaceTextByPosition: {
      id: "replaceTextByPosition", libraryId: "common", availability: { extension: true, portfolio: false },
      label: "REPLACE", explanation: "Replace text using a starting position and character count.",
      inputContract: "structured-v1", builderKey: "textReplace", builderOptions: { functionName: "REPLACE" },
      guidance: {
        "setupNotes": [
          "No special setup is required. Source text and replacement text can be entered directly or selected from current-row cells."
        ],
        "instructions": [
          "Set Source text and Replacement text using entered text or current-row cells. Replacement text may be empty.",
          "Enter a Start position of at least 1 and a Number of characters of zero or more.",
          "Copy the formula to the cell where you want the replaced text."
        ]
      },
      fields: [
        { id: "text", label: "Source text", type: "textOperand", required: true, help: "Enter source text, including empty text or spaces, or choose a current-row column." },
        { id: "startPosition", label: "Start position", type: "integer", required: true, min: "1", help: "Enter a whole-number starting position of one or more." },
        { id: "numChars", label: "Number of characters", type: "integer", required: true, min: "0", help: "Enter a whole-number character count of zero or more. Smartsheet evaluates the requested replacement." },
        { id: "newText", label: "Replacement text", type: "textOperand", required: true, help: "Enter replacement text or choose a current-row column. Empty replacement text can remove characters." }
      ],
      categoryId: "text-labels", keywords: ["replace", "replace by position", "replace characters", "positional text replacement"]
    }
  });

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
