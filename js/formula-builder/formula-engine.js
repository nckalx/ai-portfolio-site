// Classic-script module; no build step or browser APIs required.
(() => {
  const { catalog, configuration, utils, validation, guidance } = globalThis.SmartsheetFormulaBuilder;
  const { maxLocationWordsToCheck, monthNameSortValues } = configuration;
  const { rowColumn, sheetReference, smartsheetText, longestLocationWordFormula, nestedEqualsFormula } = utils;

  const builders = {
    appendFinishDateLabel(values) {
      return (
        `=IF(ISBLANK(${rowColumn(values.finishDateColumn)}), ` +
        `${rowColumn(values.milestoneLabelColumn)}, ` +
        `${rowColumn(values.milestoneLabelColumn)} + " - " + ${rowColumn(values.finishDateColumn)})`
      );
    },
    scheduleMovedWorkdays(values) {
      return (
        `=IF(OR(ISBLANK(${rowColumn(values.originalDateColumn)}), ` +
        `ISBLANK(${rowColumn(values.updatedDateColumn)})), "", ` +
        `IF(${rowColumn(values.updatedDateColumn)} >= ${rowColumn(values.originalDateColumn)}, ` +
        `NETWORKDAYS(${rowColumn(values.originalDateColumn)}, ${rowColumn(values.updatedDateColumn)}) - 1, ` +
        `-(NETWORKDAYS(${rowColumn(values.updatedDateColumn)}, ${rowColumn(values.originalDateColumn)}) - 1)))`
      );
    },
    twoCriteriaLookup(values) {
      return (
        `=IFERROR(INDEX(COLLECT(${sheetReference(values.lookupReturnReference)}, ` +
        `${sheetReference(values.lookupCriteriaOneReference)}, ${rowColumn(values.lookupCurrentCriteriaOneColumn)}, ` +
        `${sheetReference(values.lookupCriteriaTwoReference)}, ${rowColumn(values.lookupCurrentCriteriaTwoColumn)}), 1), "")`
      );
    },
    checkboxMatch(values) {
      return `=IF(COUNTIF(${sheetReference(values.checkboxMatchReference)}, ${rowColumn(values.checkboxCurrentMatchColumn)}) > 0, 1, 0)`;
    },
    rioIdLookup(values) {
      return (
        `=IFERROR(INDEX(COLLECT(${sheetReference(values.rioIdReference)}, ` +
        `${sheetReference(values.rioMatchReference)}, ${rowColumn(values.rioCurrentIdColumn)}), 1), "")`
      );
    },
    buildMilestoneId(values) {
      const milestoneNumber = rowColumn(values.milestoneNumberColumn);

      return (
        `=IF(ISBLANK(${milestoneNumber}), "", ` +
        `${milestoneNumber} + " - " + ${rowColumn(values.locationColumn)} + " " + ${rowColumn(values.taskNameColumn)})`
      );
    },
    shortenLocationName(values) {
      return `=IF(ISBLANK(${rowColumn(values.locationNameColumn)}), "", ${longestLocationWordFormula(values.locationNameColumn, maxLocationWordsToCheck)})`;
    },
    countCheckboxValues(values) {
      const checkboxReference = sheetReference(values.checkboxCountReference);

      if (values.checkboxCountType === "uncheckedOnly") {
        return `=COUNTIF(${checkboxReference}, 0)`;
      }

      if (values.checkboxCountType === "checkedAndUnchecked") {
        return `=COUNTIF(${checkboxReference}, 1) + COUNTIF(${checkboxReference}, 0)`;
      }

      return `=COUNTIF(${checkboxReference}, 1)`;
    },
    monthNameSortNumber(values) {
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
    statusIndicator(values) {
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
    multiLineReportLabel(values) {
      const secondaryOwner = rowColumn(values.secondaryOwnerColumn);
      const tertiaryOwner = rowColumn(values.tertiaryOwnerColumn);

      return (
        `=${rowColumn(values.reportTaskColumn)} + CHAR(10) + ${rowColumn(values.reportLocationColumn)} + ` +
        `CHAR(10) + "Task Lead: " + ${rowColumn(values.leadOwnerColumn)} + ` +
        `IF(ISBLANK(${secondaryOwner}), "", CHAR(10) + "Task Second: " + ${secondaryOwner}) + ` +
        `IF(ISBLANK(${tertiaryOwner}), "", CHAR(10) + "Task Third: " + ${tertiaryOwner})`
      );
    },
    spendDateAttribute(values) {
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
    singleCriteriaLookup(values) {
      return (
        `=IFERROR(INDEX(${sheetReference(values.singleLookupReturnReference)}, ` +
        `MATCH(${rowColumn(values.singleLookupCurrentColumn)}, ${sheetReference(values.singleLookupMatchReference)}, 0)), "")`
      );
    },
    joinMatchingValues(values) {
      const collectedValues =
        `COLLECT(${sheetReference(values.joinSourceValuesReference)}, ` +
        `${sheetReference(values.joinSourceMatchReference)}, ${rowColumn(values.joinCurrentLookupColumn)})`;
      const valuesToJoin = values.joinOutputType === "distinct" ? `DISTINCT(${collectedValues})` : collectedValues;
      const separator = values.joinSeparator === "lineBreak" ? "CHAR(10)" : `", "`;

      return `=IFERROR(JOIN(${valuesToJoin}, ${separator}), "")`;
    },
    countRowsMultipleCriteria(values) {
      return (
        `=COUNTIFS(${sheetReference(values.countCriteriaReferenceOne)}, ${smartsheetText(values.countCriteriaValueOne)}, ` +
        `${sheetReference(values.countCriteriaReferenceTwo)}, ${smartsheetText(values.countCriteriaValueTwo)})`
      );
    },
    sumValuesMultipleCriteria(values) {
      return (
        `=SUMIFS(${sheetReference(values.sumValueReference)}, ` +
        `${sheetReference(values.sumCriteriaReferenceOne)}, ${smartsheetText(values.sumCriteriaValueOne)}, ` +
        `${sheetReference(values.sumCriteriaReferenceTwo)}, ${smartsheetText(values.sumCriteriaValueTwo)})`
      );
    },
    averageValuesMultipleCriteria(values) {
      return (
        `=IFERROR(AVG(COLLECT(${sheetReference(values.averageValueReference)}, ` +
        `${sheetReference(values.averageCriteriaReferenceOne)}, ${smartsheetText(values.averageCriteriaValueOne)}, ` +
        `${sheetReference(values.averageCriteriaReferenceTwo)}, ${smartsheetText(values.averageCriteriaValueTwo)})), "")`
      );
    },
    matchingDateExtremes(values) {
      const dateFunction = values.matchingDateResultType === "earliest" ? "MIN" : "MAX";

      return (
        `=IFERROR(${dateFunction}(COLLECT(${sheetReference(values.matchingDateReference)}, ` +
        `${sheetReference(values.matchingDateMatchReference)}, ${rowColumn(values.matchingDateLookupColumn)})), "")`
      );
    },
    uniqueCountCriteria(values) {
      return (
        `=IFERROR(COUNT(DISTINCT(COLLECT(${sheetReference(values.uniqueValueReference)}, ` +
        `${sheetReference(values.uniqueCriteriaReferenceOne)}, ${smartsheetText(values.uniqueCriteriaValueOne)}, ` +
        `${sheetReference(values.uniqueCriteriaReferenceTwo)}, ${smartsheetText(values.uniqueCriteriaValueTwo)}))), 0)`
      );
    },
    parentChildRollup(values) {
      const childValues = `CHILDREN(${rowColumn(values.childValueColumn)})`;

      if (values.childRollupType === "count") {
        return `=COUNT(${childValues})`;
      }

      if (values.childRollupType === "average") {
        return `=IFERROR(AVG(${childValues}), "")`;
      }

      if (values.childRollupType === "maximum") {
        return `=IFERROR(MAX(${childValues}), "")`;
      }

      if (values.childRollupType === "minimum") {
        return `=IFERROR(MIN(${childValues}), "")`;
      }

      if (values.childRollupType === "checked") {
        return `=COUNTIF(${childValues}, 1)`;
      }

      return `=SUM(${childValues})`;
    },
    hierarchyLevelHelper(values) {
      return values.hierarchyLevelStart === "one" ? "=COUNT(ANCESTORS()) + 1" : "=COUNT(ANCESTORS())";
    },
    showParentValue(values) {
      return `=IFERROR(PARENT(${rowColumn(values.parentValueColumn)}), "")`;
    },
    multiSelectHasCheck(values) {
      const hasCheck = `HAS(${rowColumn(values.multiSelectColumn)}, ${smartsheetText(values.multiSelectValue)})`;

      if (values.multiSelectOutputType === "yesNo") {
        return `=IF(${hasCheck}, "Yes", "No")`;
      }

      if (values.multiSelectOutputType === "foundBlank") {
        return `=IF(${hasCheck}, "Found", "")`;
      }

      return `=IF(${hasCheck}, 1, 0)`;
    },
    textBeforeAfterDelimiter(values) {
      const sourceColumn = rowColumn(values.delimiterSourceColumn);
      const delimiter = smartsheetText(values.delimiterText);

      if (values.delimiterExtractType === "after") {
        return `=IFERROR(RIGHT(${sourceColumn}, LEN(${sourceColumn}) - FIND(${delimiter}, ${sourceColumn}) - LEN(${delimiter}) + 1), "")`;
      }

      return `=IFERROR(LEFT(${sourceColumn}, FIND(${delimiter}, ${sourceColumn}) - 1), ${sourceColumn})`;
    },
    readyToStartBasedOnPredecessors(values) {
      return (
        `=IF(${rowColumn(values.readinessStatusColumn)} = ${smartsheetText(values.readinessCompleteStatus)}, ` +
        `${smartsheetText(values.readinessCompleteValue)}, ` +
        `IF(${rowColumn(values.openPredecessorCountColumn)} = 0, ${smartsheetText(values.readinessReadyValue)}, ` +
        `${smartsheetText(values.readinessBlockedValue)}))`
      );
    },
    rankedValue(values) {
      const rankFunction = values.rankingType === "lowest" ? "SMALL" : "LARGE";
      return `=IFERROR(${rankFunction}(${sheetReference(values.rankedValueReference)}, ${values.rankNumber}), "")`;
    }
  };

  // Synchronous generation returns data only. It does not evaluate Smartsheet expressions.
  function generateFormula(formulaType, rawValues) {
    const config = catalog[formulaType];
    const values = validation.normalizeValues(config, rawValues);
    const missingFields = validation.getMissingFields(config, values);
    const validationErrors = validation.getValidationErrors(config, values);
    return {
      formulaType,
      values,
      explanation: config.explanation,
      formula: missingFields.length || validationErrors.length ? null : builders[formulaType](values),
      missingFields,
      validationErrors,
      ...guidance.getGuidance(formulaType, values)
    };
  }

  globalThis.SmartsheetFormulaBuilder.generateFormula = generateFormula;
})();
