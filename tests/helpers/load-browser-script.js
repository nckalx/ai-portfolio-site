const path = require("node:path");

function loadBrowserScript(relativeScriptPath, namespaceName) {
  const scriptPath = path.resolve(__dirname, "..", "..", relativeScriptPath);
  const resolvedScriptPath = require.resolve(scriptPath);

  global.window = global;

  if (namespaceName) {
    delete global[namespaceName];
  }

  delete require.cache[resolvedScriptPath];
  require(resolvedScriptPath);

  return namespaceName ? global[namespaceName] : global;
}

module.exports = {
  loadBrowserScript
};
