// Copies reviewed local files only. No bundling, dependencies, downloads, or source rewriting.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const outputDirectory = path.join(root, "dist/formula-builder");
const extensionFiles = [
  "manifest.json", "service-worker.js", "sidepanel.html", "sidepanel.css",
  "sidepanel.js", "formula-discovery.js", "theme.js",
  "icons/icon-16.png", "icons/icon-24.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-128.png"
];
const coreFiles = [
  "formula-catalog.js", "formula-utils.js", "formula-validation.js",
  "formula-guidance.js", "formula-engine.js"
];
const packageFiles = Object.freeze([
  ...extensionFiles.map(file => Object.freeze({ source: `extensions/formula-builder/${file}`, target: file })),
  ...coreFiles.map(file => Object.freeze({ source: `js/formula-builder/${file}`, target: `core/${file}` }))
]);

function assertNoLinks(directory) {
  for (let current = path.resolve(directory); ; current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Refusing linked package path: ${current}`);
    }
    if (current === path.dirname(current)) break;
  }
}

function packageExtension(destination = outputDirectory) {
  destination = path.resolve(destination);
  assertNoLinks(destination);
  const targets = new Set(packageFiles.map(file => file.target));
  // Refuse unexpected files instead of deleting a directory that might contain user work.
  function inspect(directory, prefix = "") {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isDirectory() && ["core", "icons"].includes(relative)) {
        inspect(path.join(directory, entry.name), `${relative}/`);
      } else if (!entry.isFile() || !targets.has(relative)) {
        throw new Error(`Unexpected package entry: ${relative}. Use an empty output directory.`);
      }
    }
  }
  inspect(destination);
  const contents = packageFiles.map(file => {
    const source = path.join(root, file.source);
    assertNoLinks(source);
    return { ...file, bytes: fs.readFileSync(source) };
  });
  for (const file of contents) {
    const target = path.join(destination, file.target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.bytes);
  }
  return destination;
}

if (require.main === module) {
  console.log(`Packaged ${packageFiles.length} files: ${packageExtension()}`);
}

module.exports = { packageExtension, packageFiles, outputDirectory };
