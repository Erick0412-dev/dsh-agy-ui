import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      index: "./src/index.ts"
    },
    format: ["esm"],
    dts: true,
    clean: true,
    platform: "node",
    deps: {
      neverBundle: [
        "@deepseek-ai/cordis",
        "@deepseek-ai/dsh-llm"
      ]
    },
    outExtensions: () => ({ js: ".js" })
  },
  {
    entry: {
      client: "./src/client/index.ts"
    },
    format: ["cjs"],
    dts: false,
    clean: false,
    platform: "browser",
    deps: {
      neverBundle: [
        "react",
        "react-dom",
        "scheduler"
      ]
    },
    banner: 'window.__ModuleLoader__.load({\n\tid: "dsh-agy-ui",\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;\n\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });\n',
    footer: '\n\t\treturn module.exports;\n\t}\n});\n',
    outExtensions: () => ({ js: ".js" })
  }
]);
