const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadFormulaCore } = require("./load-formula-core");

// Small DOM contract double, not a layout/accessibility emulator. Build the tree
// from the real shell so renamed/missing elements and hidden views are tested.
function setupExtension(navigator = {}) {
  let document;
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.attributes = {};
      this.listeners = {};
      this.hidden = false;
      this.disabled = false;
      this.open = false;
      this.scrollTop = 0;
      this._value = undefined;
      this._text = "";
    }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    dispatch(name, event = {}) {
      if (name === "click" && this.disabled) return;
      for (const callback of this.listeners[name] || []) callback(event);
    }
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
    get value() { return this._value ?? (this.tagName === "select" ? this.children[0]?.value : "") ?? ""; }
    set value(value) { this._value = value; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
    set textContent(value) { this._text = value; this.children = []; }
    set innerHTML(_) { throw new Error("HTML insertion is not permitted"); }
  }
  const root = new Element("root");
  document = {
    activeElement: null,
    createElement: tag => new Element(tag),
    getElementById(id) {
      function find(node) {
        if (node.id === id) return node;
        for (const child of node.children) { const match = find(child); if (match) return match; }
        return null;
      }
      return find(root);
    }
  };
  const directory = path.resolve(__dirname, "../../extensions/formula-builder");
  const html = fs.readFileSync(path.join(directory, "sidepanel.html"), "utf8");
  const stack = [root];
  for (const token of html.match(/<[^>]+>|[^<]+/g)) {
    if (token.startsWith("<!")) continue;
    if (token.startsWith("</")) { stack.pop(); continue; }
    if (!token.startsWith("<")) { stack.at(-1).appendChild(Object.assign(new Element("text"), { _text: token })); continue; }
    const tag = token.match(/^<([\w-]+)/)[1];
    const node = new Element(tag);
    for (const match of token.matchAll(/([\w-]+)="([^"]*)"/g)) {
      node.setAttribute(match[1], match[2]);
      if (["id", "value", "type"].includes(match[1])) node[match[1]] = match[2];
    }
    for (const name of ["hidden", "disabled", "readonly"]) if (new RegExp(`\\s${name}(?:\\s|>)`).test(token)) node[name] = true;
    stack.at(-1).appendChild(node);
    if (!["meta", "link", "input"].includes(tag)) stack.push(node);
  }
  const context = vm.createContext({ document, navigator });
  const core = loadFormulaCore(context);
  for (const file of ["formula-discovery.js", "sidepanel.js"]) {
    vm.runInContext(fs.readFileSync(path.join(directory, file), "utf8"), context, { filename: file });
  }
  const get = id => document.getElementById(id);
  const choices = () => get("results").children.map(item => item.children[0]);
  const choose = id => {
    const button = choices().find(button => button.children[0].textContent === core.catalog[id].label);
    if (!button) throw new Error(`Formula not discoverable: ${id}`);
    button.dispatch("click");
    return button;
  };
  return { document, core, get, choose, choices };
}

module.exports = { setupExtension };
