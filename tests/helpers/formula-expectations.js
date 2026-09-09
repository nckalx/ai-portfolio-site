const legacyFixtures = require("../fixtures/formula-builder-cases.json");
const generalizedFixtures = require("../fixtures/formula-generalized-cases.json");

// Compose reviewed content expectations from static fixtures only. Legacy inputs,
// formulas, normalized values, reference objects, and validation errors stay fixed.
const currentLegacyFixtures = {
  catalog: generalizedFixtures.catalog,
  cases: legacyFixtures.cases.map(entry => {
    const config = generalizedFixtures.catalog.find(config => config.id === entry.formulaType);
    const guidance = generalizedFixtures.legacyGuidance[entry.name] || {};
    return {
      ...entry,
      expected: {
        ...entry.expected,
        explanation: config.explanation,
        missingFields: entry.expected.missingFields.map(field => config.fields.find(current => current.id === field.id)),
        setupNotes: guidance.setupNotes || entry.expected.setupNotes,
        instructions: guidance.instructions || entry.expected.instructions
      }
    };
  })
};

module.exports = { legacyFixtures, generalizedFixtures, currentLegacyFixtures };
