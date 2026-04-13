import * as esbuild from "esbuild";
import * as path from "path";
import * as fs from "fs";

const isWatch = process.argv.includes("--watch");

// Plugin to resolve @/ path aliases to src/webview/
const aliasPlugin: esbuild.Plugin = {
  name: "alias-plugin",
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const relativePath = args.path.replace(/^@\//, "");
      const basePath = path.resolve(__dirname, "src/webview", relativePath);

      // Check if it's a directory first (look for index file)
      if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
        for (const ext of [".tsx", ".ts", ".js", ".jsx"]) {
          const indexPath = path.join(basePath, "index" + ext);
          if (fs.existsSync(indexPath)) {
            return { path: indexPath };
          }
        }
      }

      // Try different extensions for file
      const extensions = [".tsx", ".ts", ".js", ".jsx"];
      for (const ext of extensions) {
        const fullPath = basePath + ext;
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          return { path: fullPath };
        }
      }

      // Check if it already exists as a file
      if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
        return { path: basePath };
      }

      return { path: basePath };
    });
  },
};

// Plugin to ignore CSS imports (they're handled by tailwindcss CLI)
const ignoreCssPlugin: esbuild.Plugin = {
  name: "ignore-css",
  setup(build) {
    build.onResolve({ filter: /\.css$/ }, () => {
      return { path: "empty", namespace: "empty-css" };
    });
    build.onLoad({ filter: /.*/, namespace: "empty-css" }, () => {
      return { contents: "", loader: "js" };
    });
  },
};

const buildOptions: esbuild.BuildOptions = {
  absWorkingDir: __dirname,
  entryPoints: [path.resolve(__dirname, "src/webview/main.tsx")],
  bundle: true,
  outfile: path.resolve(__dirname, "dist/webview.js"),
  format: "iife",
  platform: "browser",
  target: "es2020",
  sourcemap: true,
  minify: !isWatch,
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
  },
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": isWatch ? '"development"' : '"production"',
  },
  plugins: [aliasPlugin, ignoreCssPlugin],
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
  } else {
    await esbuild.build(buildOptions);
  }
}

build().catch(() => {
  process.exit(1);
});
