// Pure date, holiday, and workday helpers for the Smartsheet schedule analyzer.
// Exposed as a classic-script namespace so the static site does not need ES
// modules, a bundler, or a build step.

(() => {
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

  function getHolidayDateSet(analyzerOptions) {
    return analyzerOptions && analyzerOptions.holidayDateSet instanceof Set
      ? analyzerOptions.holidayDateSet
      : new Set();
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

  window.ScheduleDateUtils = {
    formatDateValue,
    normalizeCellValue,
    getDateOnly,
    getDateKey,
    isValidDateObject,
    createDateFromParts,
    normalizeTwoDigitYear,
    parseExcelSerialDate,
    parseDateString,
    parseMappedScheduleDate,
    addDays,
    getNthWeekdayOfMonth,
    getLastWeekdayOfMonth,
    getObservedFixedHoliday,
    addHolidayToMap,
    getCommonUsHolidayEntriesForYear,
    getDefaultHolidayText,
    getHolidayDateCandidates,
    parseHolidayDateText,
    getHolidayDateSet,
    calculateCalendarDaysBetween,
    isWeekday,
    isHoliday,
    isWorkingDay,
    countWeekdaysInclusive,
    calculateWorkdaysMoved
  };
})();
