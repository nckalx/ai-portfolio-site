// Minimal test double for the adapter's DOM operations, not a browser emulator.
// Refuse HTML insertion so text-rendering regressions fail visibly.
function createFormulaDocument() {
  const copied = [];
  let selected = null;
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.listeners = {};
      this.style = {};
      this.attributes = {};
      this.disabled = false;
      this._text = "";
      this._value = undefined;
    }
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
      return child;
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    dispatch(name, event = {}) { (this.listeners[name] || []).forEach(callback => callback(event)); }
    get value() { return this._value ?? (this.tagName === "select" ? this.children[0]?.value : "") ?? ""; }
    set value(value) { this._value = value; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
    set textContent(value) { this._text = value; this.children = []; }
    set innerHTML(value) {
      if (value !== "") throw new Error("Unexpected HTML insertion");
      this.children = [];
      this._text = "";
    }
    select() { selected = this; }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  const document = {
    body: new Element("body"),
    createElement: tag => new Element(tag),
    getElementById(id) {
      function find(node) {
        if (node.id === id) return node;
        for (const child of node.children) {
          const result = find(child);
          if (result) return result;
        }
        return null;
      }
      return find(this.body);
    },
    execCommand(command) {
      if (command !== "copy") throw new Error("Unexpected command");
      copied.push(selected.value);
      return true;
    }
  };
  for (const [id, tag] of Object.entries({
    formulaType: "select", formulaBuilderForm: "form", formulaInputFields: "div",
    formulaExplanation: "p", generatedFormula: "pre", copyFormulaButton: "button",
    copyFormulaStatus: "p", referenceInstructions: "div"
  })) {
    const element = document.createElement(tag);
    element.id = id;
    document.body.appendChild(element);
  }
  return { document, copied };
}

module.exports = { createFormulaDocument };
