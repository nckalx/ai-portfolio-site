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

const formulaExamples = [
  {
    name: "RIO Checkbox Logic",
    type: "Cross-Sheet Formula",
    description: "Checks a row when the milestone ID appears in a separate Risk, Issue, and Opportunity log."
  },
  {
    name: "Schedule Moved in Workdays",
    type: "Date Formula",
    description: "Calculates how many workdays a milestone moved between the original and updated schedule dates."
  },
  {
    name: "Kickoff Complete Count",
    type: "Summary Formula",
    description: "Counts completed kickoff items from a referenced Smartsheet range."
  },
  {
    name: "Property Name Shortener",
    type: "Text Formula",
    description: "Creates cleaner abbreviated property names for reporting and milestone IDs."
  },
  {
    name: "Month Sort Helper",
    type: "Text/Number Formula",
    description: "Creates a sortable month number so grouped reports display months in the correct order."
  }
];

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

function renderFormulaExamples(filterValue = "All") {
  const formulaList = document.getElementById("formulaList");

  const filteredExamples = formulaExamples.filter((example) => {
    return filterValue === "All" || example.type === filterValue;
  });

  formulaList.innerHTML = "";

  filteredExamples.forEach((example) => {
    const formulaItem = document.createElement("article");
    formulaItem.className = "formula-item";

    formulaItem.innerHTML = `
      <p class="formula-type">${example.type}</p>
      <h3>${example.name}</h3>
      <p>${example.description}</p>
    `;

    formulaList.appendChild(formulaItem);
  });
}

document.getElementById("analyzeScheduleButton").addEventListener("click", analyzeSchedule);

document.getElementById("formulaFilter").addEventListener("change", (event) => {
  renderFormulaExamples(event.target.value);
});

renderFormulaExamples();
