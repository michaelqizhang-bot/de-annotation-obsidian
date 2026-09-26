var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => DeAnnotationPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_child_process = require("child_process");
var path = __toESM(require("path"));
var BACKEND_URL = "http://localhost:5000";
var ANNOTATION_VIEW_TYPE = "de-annotation-view";
var CATEGORIES = [
  { code: "verb", label: "\u52A8\u8BCD", bg: "#4169E1", fg: "#fff" },
  { code: "aux", label: "\u52A9\u52A8\u8BCD", bg: "#87CEEB", fg: "#000" },
  { code: "conj", label: "\u8FDE\u8BCD", bg: "#B8860B", fg: "#fff" },
  { code: "adp", label: "\u4ECB\u8BCD", bg: "#9370DB", fg: "#fff" },
  { code: "det", label: "\u51A0\u8BCD", bg: "#A0A0A0", fg: "#000" },
  { code: "adj", label: "\u5F62\u5BB9/\u526F", bg: "#FFF3A0", fg: "#000" },
  { code: "noun", label: "\u540D\u8BCD", bg: "#90EE90", fg: "#000" },
  { code: "pron", label: "\u4EE3\u8BCD", bg: "#3CB371", fg: "#fff" },
  { code: "rel", label: "\u5173/\u8FDE\u4EE3", bg: "#8B4513", fg: "#fff" }
];
var DeAnnotationPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", {});
    __publicField(this, "backendAvailable", false);
    __publicField(this, "backendProcess", null);
    __publicField(this, "startedByUs", false);
  }
  async onload() {
    console.log("\u{1F680} \u5FB7\u8BED\u8BCD\u7C7B\u6807\u6CE8\u63D2\u4EF6\u52A0\u8F7D\u4E2D...");
    await this.loadSettings();
    await this.ensureBackendRunning();
    this.registerView(ANNOTATION_VIEW_TYPE, (leaf) => new AnnotationPanelView(leaf, this));
    this.addRibbonIcon("pencil", "\u5FB7\u8BED\u6807\u6CE8", async () => {
      await this.activateAnnotationPanel();
    });
    this.addCommand({
      id: "analyze-text",
      name: "\u5206\u6790\u9009\u4E2D\u6587\u672C",
      editorCallback: async (editor, view) => {
        await this.analyzeSelectedText(editor);
      }
    });
    this.addCommand({
      id: "annotate-noun",
      name: "\u6807\u6CE8\u4E3A\u540D\u8BCD",
      editorCallback: async (editor, view) => {
        await this.annotateSelection(editor, "noun");
      }
    });
    this.addCommand({
      id: "annotate-verb",
      name: "\u6807\u6CE8\u4E3A\u52A8\u8BCD",
      editorCallback: async (editor, view) => {
        await this.annotateSelection(editor, "verb");
      }
    });
    this.addCommand({
      id: "restart-backend",
      name: "\u91CD\u542F\u540E\u7AEF\u670D\u52A1",
      callback: async () => {
        await this.ensureBackendRunning(true);
      }
    });
    this.addSettingTab(new DeAnnotationSettingTab(this.app, this));
    console.log("\u2705 \u63D2\u4EF6\u52A0\u8F7D\u5B8C\u6210");
  }
  onunload() {
    console.log("\u{1F6D1} \u63D2\u4EF6\u5378\u8F7D");
    this.stopBackend();
  }
  async loadSettings() {
    this.settings = Object.assign({}, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  /** 获取插件所在目录的绝对路径（仅桌面版可用） */
  getPluginDir() {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof import_obsidian.FileSystemAdapter) {
      const basePath = adapter.getBasePath();
      return path.join(basePath, this.app.vault.configDir, "plugins", this.manifest.id);
    }
    return null;
  }
  /** 探测后端是否已在运行 */
  async isBackendUp() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const response = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      return response.ok;
    } catch (e) {
      return false;
    }
  }
  /** 确保后端在运行：先探测，不在运行则自动启动 python backend_app.py */
  async ensureBackendRunning(forceRestart = false) {
    if (forceRestart) {
      this.stopBackend();
    }
    if (!forceRestart && await this.isBackendUp()) {
      this.backendAvailable = true;
      console.log("\u2705 \u540E\u7AEF\u670D\u52A1\u5DF2\u5728\u8FD0\u884C");
      return;
    }
    const pluginDir = this.getPluginDir();
    if (!pluginDir) {
      new import_obsidian.Notice("\u26A0\uFE0F \u540E\u7AEF\u670D\u52A1\u4E0D\u53EF\u7528\uFF08\u8BF7\u786E\u4FDD\u5728\u672C\u5730\u8FD0\u884C backend_app.py\uFF09");
      this.backendAvailable = false;
      return;
    }
    const scriptPath = path.join(pluginDir, "backend_app.py");
    try {
      new import_obsidian.Notice("\u{1F680} \u6B63\u5728\u81EA\u52A8\u542F\u52A8\u540E\u7AEF\u670D\u52A1...");
      this.backendProcess = (0, import_child_process.spawn)("python", [scriptPath], {
        cwd: pluginDir,
        windowsHide: true,
        stdio: "ignore"
      });
      this.startedByUs = true;
      this.backendProcess.on("error", (err) => {
        console.error("\u274C \u542F\u52A8\u540E\u7AEF\u5931\u8D25\uFF1A", err);
        new import_obsidian.Notice(`\u274C \u65E0\u6CD5\u542F\u52A8\u540E\u7AEF\u670D\u52A1\uFF1A${err.message}`);
      });
      this.backendProcess.on("exit", (code) => {
        console.log(`\u540E\u7AEF\u8FDB\u7A0B\u9000\u51FA\uFF0C\u9000\u51FA\u7801\uFF1A${code}`);
        this.backendAvailable = false;
      });
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1e3));
        if (await this.isBackendUp()) {
          this.backendAvailable = true;
          new import_obsidian.Notice("\u2705 \u540E\u7AEF\u670D\u52A1\u542F\u52A8\u6210\u529F");
          return;
        }
      }
      this.backendAvailable = false;
      new import_obsidian.Notice("\u26A0\uFE0F \u540E\u7AEF\u670D\u52A1\u542F\u52A8\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5 Python \u73AF\u5883\u6216\u624B\u52A8\u8FD0\u884C backend_app.py");
    } catch (e) {
      console.error("\u542F\u52A8\u540E\u7AEF\u5F02\u5E38\uFF1A", e);
      new import_obsidian.Notice(`\u274C \u542F\u52A8\u540E\u7AEF\u670D\u52A1\u5931\u8D25\uFF1A${e}`);
      this.backendAvailable = false;
    }
  }
  /** 停止我们自己启动的后端进程（插件卸载/重启时清理） */
  stopBackend() {
    if (this.backendProcess && this.startedByUs) {
      try {
        this.backendProcess.kill();
      } catch (e) {
        console.error("\u505C\u6B62\u540E\u7AEF\u8FDB\u7A0B\u5931\u8D25\uFF1A", e);
      }
      this.backendProcess = null;
      this.startedByUs = false;
    }
  }
  async checkBackendConnection() {
    const up = await this.isBackendUp();
    this.backendAvailable = up;
    if (up) {
      new import_obsidian.Notice("\u2705 \u540E\u7AEF\u670D\u52A1\u8FDE\u63A5\u6210\u529F");
    } else {
      new import_obsidian.Notice("\u26A0\uFE0F \u540E\u7AEF\u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u5C1D\u8BD5\u81EA\u52A8\u542F\u52A8...");
      await this.ensureBackendRunning();
    }
  }
  async activateAnnotationPanel() {
    const { workspace } = this.app;
    let leaf = null;
    const leaves = workspace.getLeavesOfType(ANNOTATION_VIEW_TYPE);
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await (leaf == null ? void 0 : leaf.setViewState({ type: ANNOTATION_VIEW_TYPE }));
    }
    workspace.revealLeaf(leaf);
  }
  async analyzeSelectedText(editor) {
    var _a;
    if (!this.backendAvailable) {
      new import_obsidian.Notice("\u274C \u540E\u7AEF\u670D\u52A1\u4E0D\u53EF\u7528");
      return;
    }
    const selection = editor.getSelection();
    if (!selection) {
      new import_obsidian.Notice("\u8BF7\u5148\u9009\u4E2D\u6587\u672C");
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selection })
      });
      if (!response.ok) {
        new import_obsidian.Notice("\u5206\u6790\u5931\u8D25");
        return;
      }
      const result = await response.json();
      console.log("\u5206\u6790\u7ED3\u679C\uFF1A", result);
      new import_obsidian.Notice(`\u2705 \u5206\u6790\u5B8C\u6210\uFF1A${((_a = result.tokens) == null ? void 0 : _a.length) || 0} \u4E2A token`);
    } catch (e) {
      new import_obsidian.Notice(`\u274C \u5206\u6790\u5931\u8D25\uFF1A${e}`);
      console.error(e);
    }
  }
  async annotateSelection(editor, posType) {
    if (!this.backendAvailable) {
      new import_obsidian.Notice("\u274C \u540E\u7AEF\u670D\u52A1\u4E0D\u53EF\u7528");
      return;
    }
    const selection = editor.getSelection();
    if (!selection) {
      new import_obsidian.Notice("\u8BF7\u5148\u9009\u4E2D\u6587\u672C");
      return;
    }
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    const startPos = editor.posToOffset(editor.getCursor("from"));
    const endPos = editor.posToOffset(editor.getCursor("to"));
    const categoryInfo = CATEGORIES.find((c) => c.code === posType);
    if (!categoryInfo) {
      new import_obsidian.Notice("\u672A\u77E5\u7684\u8BCD\u7C7B");
      return;
    }
    const htmlSpan = `<span class="de-${posType}" style="background-color:${categoryInfo.bg}; color:${categoryInfo.fg};">${selection}</span>`;
    editor.replaceSelection(htmlSpan);
    new import_obsidian.Notice(`\u2705 \u6807\u6CE8\u4E3A${categoryInfo.label}`);
  }
};
var AnnotationPanelView = class extends import_obsidian.View {
  constructor(leaf, plugin) {
    super(leaf);
    __publicField(this, "plugin");
    this.plugin = plugin;
  }
  getViewType() {
    return ANNOTATION_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u5FB7\u8BED\u8BCD\u7C7B\u6807\u6CE8";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl("div", { cls: "annotation-panel" });
    const buttonsDiv = container.createEl("div", { cls: "category-buttons" });
    buttonsDiv.style.display = "grid";
    buttonsDiv.style.gridTemplateColumns = "repeat(3, 1fr)";
    buttonsDiv.style.gap = "8px";
    buttonsDiv.style.padding = "10px";
    for (const category of CATEGORIES) {
      const btn = buttonsDiv.createEl("button", {
        text: category.label,
        cls: `category-btn`
      });
      btn.style.backgroundColor = category.bg;
      btn.style.color = category.fg;
      btn.style.border = "none";
      btn.style.padding = "8px";
      btn.style.borderRadius = "4px";
      btn.style.cursor = "pointer";
      btn.style.fontSize = "12px";
      btn.style.fontWeight = "bold";
      btn.addEventListener("click", async () => {
        var _a;
        const editor = (_a = this.app.workspace.activeEditor) == null ? void 0 : _a.editor;
        if (editor) {
          await this.plugin.annotateSelection(editor, category.code);
        }
      });
    }
    const analyzeDiv = container.createEl("div", { cls: "control-buttons" });
    analyzeDiv.style.padding = "10px";
    const analyzeBtn = analyzeDiv.createEl("button", {
      text: "\u5206\u6790\u9009\u4E2D\u6587\u672C"
    });
    analyzeBtn.style.width = "100%";
    analyzeBtn.style.padding = "8px";
    analyzeBtn.style.cursor = "pointer";
    analyzeBtn.addEventListener("click", async () => {
      var _a;
      const editor = (_a = this.app.workspace.activeEditor) == null ? void 0 : _a.editor;
      if (editor) {
        await this.plugin.analyzeSelectedText(editor);
      }
    });
    const resultDiv = container.createEl("div", { cls: "analysis-result" });
    resultDiv.style.marginTop = "10px";
    resultDiv.style.padding = "10px";
    resultDiv.style.borderTop = "1px solid #ccc";
    resultDiv.style.maxHeight = "200px";
    resultDiv.style.overflowY = "auto";
    resultDiv.createEl("p", { text: "\u5206\u6790\u7ED3\u679C\u5C06\u663E\u793A\u5728\u8FD9\u91CC..." });
  }
  async onClose() {
  }
};
var DeAnnotationSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin");
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("\u540E\u7AEF\u670D\u52A1\u5730\u5740").setDesc("Python \u540E\u7AEF\u670D\u52A1\u7684 URL").addText(
      (text) => text.setPlaceholder("http://localhost:5000").setValue(this.plugin.settings.backendUrl || "http://localhost:5000").onChange(async (value) => {
        this.plugin.settings.backendUrl = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u68C0\u67E5\u8FDE\u63A5").setDesc("\u70B9\u51FB\u68C0\u67E5\u540E\u7AEF\u670D\u52A1\u662F\u5426\u53EF\u7528\uFF08\u5982\u672A\u8FD0\u884C\u4F1A\u81EA\u52A8\u5C1D\u8BD5\u542F\u52A8\uFF09").addButton((button) => {
      button.setButtonText("\u68C0\u67E5").onClick(async () => {
        await this.plugin.checkBackendConnection();
      });
    });
    new import_obsidian.Setting(containerEl).setName("\u91CD\u542F\u540E\u7AEF\u670D\u52A1").setDesc("\u5F3A\u5236\u91CD\u542F Python \u540E\u7AEF\u8FDB\u7A0B").addButton((button) => {
      button.setButtonText("\u91CD\u542F").onClick(async () => {
        await this.plugin.ensureBackendRunning(true);
      });
    });
    new import_obsidian.Setting(containerEl).setName("\u542F\u7528\u5B89\u5353\u67E5\u770B\u6A21\u5F0F").setDesc("\u5982\u542F\u7528\uFF0C\u6807\u6CE8\u5C06\u4EE5 Markdown \u683C\u5F0F\u5B58\u50A8\uFF0C\u4FBF\u4E8E\u5728\u5B89\u5353\u8BBE\u5907\u4E0A\u67E5\u770B").addToggle(
      (toggle) => {
        var _a;
        return toggle.setValue((_a = this.plugin.settings.androidViewMode) != null ? _a : true).onChange(async (value) => {
          this.plugin.settings.androidViewMode = value;
          await this.plugin.saveSettings();
        });
      }
    );
  }
};
