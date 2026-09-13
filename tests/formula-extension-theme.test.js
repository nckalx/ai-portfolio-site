const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { setupExtension } = require("./helpers/formula-extension-dom");
const { discoveryFixture } = require("./helpers/formula-discovery-fixtures");
const tick = () => new Promise(resolve => setImmediate(resolve));
const resolved = panel => panel.document.documentElement.getAttribute("data-theme");
function toggle(panel) { panel.get("theme-toggle").focus(); panel.get("theme-toggle").dispatch("click"); }

test("library selector retains native radio styles, semantics, and visible focus", () => {
  const base = path.resolve(__dirname, "../extensions/formula-builder");
  const html = fs.readFileSync(path.join(base, "sidepanel.html"), "utf8");
  const css = fs.readFileSync(path.join(base, "sidepanel.css"), "utf8");
  assert.match(html, /<fieldset id="library-selector"[^>]*hidden>[\s\S]*?<legend>Library<\/legend>/);
  for (const id of ["common", "advanced"]) {
    assert.match(html, new RegExp(`<label for="library-${id}"><input id="library-${id}" type="radio" name="library" value="${id}"`));
  }
  const rule = css.match(/\.library-selector input\[type="radio"\]\s*\{([^}]+)\}/)[1];
  for (const declaration of [/appearance:\s*auto;/, /width:\s*auto;/, /min-height:\s*0;/, /padding:\s*0;/, /accent-color:\s*var\(--accent\);/]) {
    assert.match(rule, declaration);
  }
  assert.ok(css.indexOf(rule) > css.indexOf("input, select { min-height:"));
  assert.match(css, /\.library-options\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /:focus-visible\s*\{[^}]*outline: 3px solid var\(--focus\)/);
  assert.doesNotMatch(rule, /outline:\s*(?:none|0)|forced-color-adjust:\s*none|appearance:\s*none/);
  assert.doesNotMatch(html, /role="(?:radio|radiogroup|tab|tablist)"/);
});

test("mixed Common discovery state survives both theme changes with only theme persistence", async () => {
  const panel = setupExtension({}, {}, core => { Object.assign(core, discoveryFixture()); });
  await tick();
  const { get } = panel;
  get("library-common").checked = true;
  get("library-common").dispatch("change");
  get("category").value = "text-labels";
  get("category").dispatch("change");
  get("search").value = "  SHARED  caption \t";
  get("search").dispatch("input");
  get("results-scroll").scrollTop = 42;
  const choices = panel.choices();
  const options = get("category").children.slice();
  for (const expected of ["dark", "light"]) {
    toggle(panel); await tick();
    assert.equal(resolved(panel), expected);
    assert.equal(get("library-selector").hidden, false);
    assert.equal(get("library-common").checked, true);
    assert.equal(get("library-advanced").checked, false);
    assert.equal(get("search").value, "  SHARED  caption \t");
    assert.equal(get("category").value, "text-labels");
    assert.deepEqual(get("category").children, options);
    assert.deepEqual(panel.choices(), choices);
    assert.equal(get("result-count").textContent, "1 formula");
    assert.equal(get("results-scroll").scrollTop, 42);
    assert.equal(panel.document.activeElement, get("theme-toggle"));
    assert.equal(panel.generationCount(), 0);
  }
  assert.deepEqual(panel.storageWrites, [{ theme: "dark" }, { theme: "light" }]);
});

for (const saved of ["light", "dark"]) {
  test(`saved ${saved} overrides system and is reflected in the accessible toggle`, async () => {
    const panel = setupExtension({}, { saved, systemDark: saved !== "dark" });
    await tick();
    assert.equal(resolved(panel), saved);
    assert.equal(panel.get("theme-toggle").getAttribute("aria-label"), "Dark mode");
    assert.equal(panel.get("theme-toggle").getAttribute("aria-pressed"), String(saved === "dark"));
    assert.equal(panel.get("theme-icon").getAttribute("aria-hidden"), "true");
    panel.changeSystem(saved !== "dark");
    assert.equal(resolved(panel), saved);
    assert.deepEqual(panel.storageWrites, []);
  });
}

for (const saved of [undefined, "invalid", null, 1]) {
  test(`missing/invalid preference (${saved}) follows system until an explicit choice`, async () => {
    const panel = setupExtension({}, { saved, systemDark: true });
    assert.equal(resolved(panel), "dark");
    await tick();
    panel.changeSystem(false);
    assert.equal(resolved(panel), "light");
    toggle(panel);
    assert.equal(resolved(panel), "dark");
    panel.changeSystem(false);
    assert.equal(resolved(panel), "dark");
    await tick();
    assert.deepEqual(panel.storageWrites, [{ theme: "dark" }]);
  });
}

test("read failure preserves system fallback and permits later explicit persistence", async () => {
  const panel = setupExtension({}, { systemDark: true, get: async () => { throw Error("unavailable"); } });
  await tick();
  assert.equal(resolved(panel), "dark");
  assert.match(panel.get("theme-status").textContent, /Could not load/);
  panel.changeSystem(false);
  assert.equal(resolved(panel), "light");
  toggle(panel); await tick();
  assert.equal(panel.get("theme-status").textContent, "");
  assert.deepEqual(panel.storageWrites, [{ theme: "dark" }]);
});

test("write failure keeps the current session theme and a later write can recover", async () => {
  let fail = true;
  const saved = [];
  const panel = setupExtension({}, { set: async value => {
    if (fail) throw Error("unavailable");
    saved.push(value.theme);
  } });
  await tick(); toggle(panel); await tick();
  assert.equal(resolved(panel), "dark");
  assert.match(panel.get("theme-status").textContent, /could not be saved/);
  assert.match(panel.get("theme-toggle").title, /could not be saved/);
  assert.equal(panel.document.activeElement, panel.get("theme-toggle"));
  panel.changeSystem(false);
  assert.equal(resolved(panel), "dark");
  fail = false; toggle(panel); await tick();
  assert.deepEqual(saved, ["light"]);
  assert.equal(panel.get("theme-status").textContent, "");
});

for (const reject of [false, true]) {
  test(`delayed initial read cannot override a newer selection (reject=${reject})`, async () => {
    let finish;
    const panel = setupExtension({}, { get: () => new Promise((resolve, fail) => {
      finish = () => reject ? fail(Error("late failure")) : resolve({ theme: "light" });
    }) });
    toggle(panel); await tick();
    finish(); await tick();
    assert.equal(resolved(panel), "dark");
    assert.equal(panel.get("theme-status").textContent, "");
    assert.deepEqual(panel.storageWrites, [{ theme: "dark" }]);
  });
}

test("delayed read applies saved theme when no explicit selection has intervened", async () => {
  let finish;
  const panel = setupExtension({}, { get: () => new Promise(resolve => { finish = resolve; }) });
  panel.changeSystem(true);
  finish({ theme: "light" }); await tick();
  assert.equal(resolved(panel), "light");
});

for (const rejectOlder of [false, true]) {
  test(`rapid toggles serialize persistence and ignore older feedback (reject=${rejectOlder})`, async () => {
    const pending = [], calls = [];
    let persisted;
    const panel = setupExtension({}, { set: value => new Promise((resolve, reject) => {
      calls.push(value.theme);
      pending.push({ succeed() { persisted = value.theme; resolve(); }, reject });
    }) });
    await tick();
    toggle(panel); await tick(); // Dark write is in flight.
    toggle(panel); toggle(panel); toggle(panel); // Latest choice is light.
    assert.equal(resolved(panel), "light");
    assert.deepEqual(calls, ["dark"]);
    const older = pending.shift();
    if (rejectOlder) older.reject(Error("late failure")); else older.succeed();
    await tick();
    assert.deepEqual(calls, ["dark", "light"]);
    assert.equal(panel.get("theme-status").textContent, "");
    pending.shift().succeed(); await tick();
    assert.equal(persisted, "light");
    assert.equal(resolved(panel), "light");
  });
}

test("theme switching leaves formula state, drafts, feedback, disclosures, scroll, and focus intact", async () => {
  const panel = setupExtension();
  await tick();
  panel.choose("appendFinishDateLabel");
  const input = panel.get("field-milestoneLabelColumn");
  input.value = "  Custom Name  "; input.dispatch("input");
  panel.get("copy-status").textContent = "Formula copied.";
  for (const id of ["setup-details", "explanation-details", "instructions-details"]) panel.get(id).open = true;
  const fieldHelp = input.parent.children.find(node => node.tagName === "details");
  fieldHelp.open = true;
  panel.get("builder-scroll").scrollTop = 123;
  panel.get("results-scroll").scrollTop = 45;
  const formula = panel.get("formula-output").value;
  const generations = panel.generationCount();
  toggle(panel); await tick();
  assert.equal(panel.generationCount(), generations);
  assert.equal(panel.get("formula-output").value, formula);
  assert.equal(panel.get("field-milestoneLabelColumn"), input);
  assert.equal(input.value, "  Custom Name  ");
  assert.equal(panel.get("copy-status").textContent, "Formula copied.");
  for (const id of ["setup-details", "explanation-details", "instructions-details"]) assert.equal(panel.get(id).open, true);
  assert.equal(fieldHelp.open, true);
  assert.equal(panel.get("builder-scroll").scrollTop, 123);
  assert.equal(panel.get("results-scroll").scrollTop, 45);
  assert.equal(panel.document.activeElement, panel.get("theme-toggle"));
  panel.get("back").dispatch("click");
  panel.choose("appendFinishDateLabel");
  assert.equal(panel.get("field-milestoneLabelColumn").value, "  Custom Name  ");
  assert.deepEqual(panel.storageWrites, [{ theme: "dark" }]);
});

test("shell and styles retain narrow-panel native controls without duplicate branding", () => {
  const base = path.resolve(__dirname, "../extensions/formula-builder");
  const html = fs.readFileSync(path.join(base, "sidepanel.html"), "utf8");
  const css = fs.readFileSync(path.join(base, "sidepanel.css"), "utf8");
  assert.doesNotMatch(html, /app-header|app-name|app-context|Make it yours/);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /<button id="theme-toggle"[^>]*type="button"/);
  assert.match(css, /\.choice-title\s*\{[^}]*font-size: 15px/);
  assert.doesNotMatch(css.match(/\.choice-title\s*\{[^}]*\}/)[0], /nowrap|line-clamp|overflow:\s*hidden/);
  assert.match(css, /\.choice-content\s*\{[^}]*min-width: 0/);
  assert.match(css, /:focus-visible\s*\{[^}]*var\(--focus\)/);
  assert.match(css, /:root\s*\{[^}]*\bcolor-scheme:\s*light\s*;/);
  assert.match(css, /:root\[data-theme="dark"\]\s*\{[^}]*\bcolor-scheme:\s*dark\s*;/);
  assert.doesNotMatch(css, /transition:|animation:/);
});

test("semantic light/dark palettes meet text and focus contrast thresholds", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../extensions/formula-builder/sidepanel.css"), "utf8");
  function luminance(hex) {
    const channels = hex.match(/[a-f\d]{2}/gi).map(channel => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  }
  for (const selector of [/:root\s*\{([^}]+)\}/, /:root\[data-theme="dark"\]\s*\{([^}]+)\}/]) {
    const palette = Object.fromEntries([...css.match(selector)[1].matchAll(/--([\w-]+):\s*(#[a-f\d]{6})/gi)].map(match => [match[1], match[2]]));
    function check(foreground, background, minimum) {
      assert.ok(palette[foreground] && palette[background]);
      const values = [luminance(palette[foreground]), luminance(palette[background])].sort((a, b) => b - a);
      const ratio = (values[0] + .05) / (values[1] + .05);
      assert.ok(ratio >= minimum, `${foreground}/${background}: ${ratio.toFixed(2)} < ${minimum}`);
    }
    for (const surface of ["surface", "surface-secondary", "control", "hover", "pressed", "output-bg"]) {
      for (const foreground of ["text", "muted", "accent", "error"]) check(foreground, surface, 4.5);
      check("focus", surface, 3);
    }
    for (const action of ["action-bg", "action-hover", "action-pressed"]) check("action-text", action, 4.5);
    check("disabled-text", "disabled-bg", 4.5);
    check("border", "control", 3);
  }
});
