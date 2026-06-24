const assert = require("node:assert/strict");
const test = require("node:test");

const { loadBrowserScript } = require("./helpers/load-browser-script");

const ScheduleDateUtils = loadBrowserScript("js/schedule-date-utils.js", "ScheduleDateUtils");

function assertLocalDate(date, year, month, day) {
  assert.ok(date instanceof Date);
  assert.equal(date.getFullYear(), year);
  assert.equal(date.getMonth(), month - 1);
  assert.equal(date.getDate(), day);
}

test("loads the ScheduleDateUtils browser namespace", () => {
  assert.ok(ScheduleDateUtils);

  [
    "parseDateString",
    "parseMappedScheduleDate",
    "parseHolidayDateText",
    "isWorkingDay",
    "calculateWorkdaysMoved",
    "getCommonUsHolidayEntriesForYear"
  ].forEach((functionName) => {
    assert.equal(typeof ScheduleDateUtils[functionName], "function");
  });
});

test("parses normal MM/DD/YYYY dates and returns null for invalid date text", () => {
  const parsedDate = ScheduleDateUtils.parseDateString("02/16/2026");

  assertLocalDate(parsedDate, 2026, 2, 16);
  assert.equal(ScheduleDateUtils.parseDateString("not a date"), null);
});

test("reports invalid mapped schedule dates without throwing", () => {
  const parsedDate = ScheduleDateUtils.parseMappedScheduleDate("not a date");

  assert.equal(parsedDate.date, null);
  assert.equal(parsedDate.displayValue, "not a date");
  assert.equal(parsedDate.isMissing, false);
  assert.equal(parsedDate.isValid, false);
});

test("parses labeled and repeated holiday dates into a deduplicated set", () => {
  const parsedHolidays = ScheduleDateUtils.parseHolidayDateText(`
    02/16/2026 - Presidents' Day
    05/25/2026 - Memorial Day

    02/16/2026 - Duplicate entry
  `);

  assert.equal(parsedHolidays.dateSet.size, 2);
  assert.equal(parsedHolidays.dateSet.has("2026-02-16"), true);
  assert.equal(parsedHolidays.dateSet.has("2026-05-25"), true);
  assert.deepEqual(parsedHolidays.invalidEntries, []);
});

test("tracks invalid holiday entries that contain numbers but no parseable date", () => {
  const parsedHolidays = ScheduleDateUtils.parseHolidayDateText("Office closure TBD 123");

  assert.equal(parsedHolidays.dateSet.size, 0);
  assert.deepEqual(parsedHolidays.invalidEntries, ["Office closure TBD 123"]);
});

test("treats weekends as non-working days and weekdays as working days", () => {
  const emptyHolidaySet = new Set();

  assert.equal(ScheduleDateUtils.isWorkingDay(new Date(2026, 1, 14), emptyHolidaySet), false);
  assert.equal(ScheduleDateUtils.isWorkingDay(new Date(2026, 1, 15), emptyHolidaySet), false);
  assert.equal(ScheduleDateUtils.isWorkingDay(new Date(2026, 1, 16), emptyHolidaySet), true);
});

test("excludes weekday holidays from working days when a holiday set is provided", () => {
  const presidentsDay = new Date(2026, 1, 16);

  assert.equal(ScheduleDateUtils.isWorkingDay(presidentsDay, new Set(["2026-02-16"])), false);
  assert.equal(ScheduleDateUtils.isWorkingDay(presidentsDay, new Set()), true);
});

test("calculates workday movement across weekends and optional holidays", () => {
  const fridayBeforePresidentsDay = new Date(2026, 1, 13);
  const presidentsDayMonday = new Date(2026, 1, 16);

  assert.equal(ScheduleDateUtils.calculateWorkdaysMoved(fridayBeforePresidentsDay, presidentsDayMonday, new Set()), 1);
  assert.equal(
    ScheduleDateUtils.calculateWorkdaysMoved(
      fridayBeforePresidentsDay,
      presidentsDayMonday,
      new Set(["2026-02-16"])
    ),
    0
  );
});

test("generates deterministic common US holiday dates for an explicit year", () => {
  const holidays = ScheduleDateUtils.getCommonUsHolidayEntriesForYear(2026);
  const holidayDateByLabel = new Map(
    holidays.map((holiday) => {
      return [holiday.label, ScheduleDateUtils.getDateKey(holiday.date)];
    })
  );

  assert.equal(holidayDateByLabel.get("MLK Day"), "2026-01-19");
  assert.equal(holidayDateByLabel.get("Presidents' Day"), "2026-02-16");
  assert.equal(holidayDateByLabel.get("Memorial Day"), "2026-05-25");
  assert.equal(holidayDateByLabel.get("Thanksgiving"), "2026-11-26");
  assert.equal(holidayDateByLabel.get("Day after Thanksgiving"), "2026-11-27");
});
