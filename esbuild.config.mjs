import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, relative } from "node:path";

import { build } from "esbuild";
import { minify } from "html-minifier-terser";
import { transform } from "lightningcss";

const appDir = "app";
const distDir = "dist";
const distAppDir = join(distDir, "app");
const distServerDir = join(distDir, "server");
const packageVersion = JSON.parse(readFileSync("./package.json", "utf8")).version;
const htmlFiles = readdirSync(appDir).filter((file) => file.endsWith(".html"));
const cssFiles = readdirSync(appDir).filter((file) => file.endsWith(".css"));
const skippedStaticAssetExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);
const skippedMetadataFiles = new Set([".DS_Store", "Thumbs.db"]);

function readCliTarget() {
  const targetIndex = process.argv.indexOf("--target");
  if (targetIndex >= 0 && process.argv[targetIndex + 1]) {
    return process.argv[targetIndex + 1];
  }

  return "all";
}

async function buildApp() {
  console.log("Building app bundle...");

  await build({
    entryPoints: [{ in: "./app/app.js", out: "app" }],
    outdir: distAppDir,
    bundle: true,
    format: "esm",
    minify: true,
    platform: "browser",
    sourcemap: false,
    target: ["chrome109", "safari16", "edge109", "firefox109"],
    treeShaking: true,
    banner: {
      js: `/* MikroLens v${packageVersion} | ${new Date().toISOString()} */`,
    },
  });
}

function buildCss() {
  console.log("Optimizing CSS...");

  for (const file of cssFiles) {
    const cssInput = readFileSync(join(appDir, file));
    const { code } = transform({
      filename: file,
      code: cssInput,
      minify: true,
      sourceMap: false,
    });

    writeFileSync(join(distAppDir, file), code);
  }
}

async function buildHtml() {
  console.log("Optimizing HTML...");

  for (const file of htmlFiles) {
    const html = readFileSync(join(appDir, file), "utf8");
    const optimizedHtml = await minify(html, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: false,
      minifyJS: false,
      removeRedundantAttributes: true,
      removeOptionalTags: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      useShortDoctype: true,
    });

    writeFileSync(join(distAppDir, file), optimizedHtml);
  }
}

function copyStaticAssets(sourceDir, targetDir) {
  let copiedAny = false;

  for (const entry of readdirSync(sourceDir)) {
    if (shouldSkipStaticAsset(entry)) {
      continue;
    }

    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);
    const stats = statSync(sourcePath);

    if (stats.isDirectory()) {
      copiedAny = copyStaticAssets(sourcePath, targetPath) || copiedAny;
      continue;
    }

    if ([".css", ".html", ".js"].includes(extname(entry))) {
      continue;
    }

    mkdirSync(targetDir, { recursive: true });
    cpSync(sourcePath, targetPath);
    copiedAny = true;
  }

  return copiedAny;
}

function shouldSkipStaticAsset(entry) {
  if (skippedMetadataFiles.has(entry)) {
    return true;
  }

  if (entry.startsWith(".")) {
    return true;
  }

  if (entry.endsWith(".d.ts")) {
    return true;
  }

  return skippedStaticAssetExtensions.has(extname(entry));
}

function pruneBuildMetadata(targetDir) {
  for (const entry of readdirSync(targetDir)) {
    const entryPath = join(targetDir, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      pruneBuildMetadata(entryPath);
      continue;
    }

    if (skippedMetadataFiles.has(entry)) {
      rmSync(entryPath, { force: true });
    }
  }
}

async function buildServer() {
  console.log("Building server bundle...");

  await build({
    entryPoints: ["./api/src/server.ts"],
    outfile: join(distServerDir, "server.mjs"),
    bundle: true,
    format: "esm",
    minify: true,
    platform: "node",
    sourcemap: false,
    target: "node24",
    treeShaking: true,
    banner: {
      js: `/* MikroLens Server v${packageVersion} | ${new Date().toISOString()} */`,
    },
  });
}

async function buildWebhookWorker() {
  console.log("Building webhook worker bundle...");

  await build({
    entryPoints: ["./api/src/webhooks/worker.ts"],
    outfile: join(distServerDir, "webhook-worker.mjs"),
    bundle: true,
    format: "esm",
    minify: true,
    platform: "node",
    sourcemap: false,
    target: "node24",
    treeShaking: true,
    banner: {
      js: `/* MikroLens Server v${packageVersion} | ${new Date().toISOString()} */`,
    },
  });
}

function ensureDir(targetDir) {
  mkdirSync(targetDir, { recursive: true });
}

function ensureCleanDir(targetDir) {
  rmSync(targetDir, { force: true, recursive: true });
  mkdirSync(targetDir, { recursive: true });
}

async function buildWebTarget({ clean = true } = {}) {
  if (clean) {
    ensureCleanDir(distAppDir);
  } else {
    ensureDir(distAppDir);
  }

  await buildApp();
  buildCss();
  await buildHtml();
  copyStaticAssets(appDir, distAppDir);
  pruneBuildMetadata(distAppDir);
}

async function buildApiTarget({ clean = false } = {}) {
  if (clean) {
    ensureCleanDir(distServerDir);
  } else {
    ensureDir(distServerDir);
    rmSync(join(distServerDir, "server.mjs"), { force: true });
  }

  await buildServer();
}

async function buildWorkersTarget({ clean = false } = {}) {
  if (clean) {
    ensureCleanDir(distServerDir);
  } else {
    ensureDir(distServerDir);
    rmSync(join(distServerDir, "webhook-worker.mjs"), { force: true });
  }

  await buildWebhookWorker();
}

function printOutput(target) {
  console.log("Output:");

  if (target === "all" || target === "web") {
    console.log(`  ${relative(process.cwd(), distAppDir)}`);
  }

  if (target === "all" || target === "api") {
    console.log(`  ${relative(process.cwd(), join(distServerDir, "server.mjs"))}`);
  }

  if (target === "all" || target === "workers") {
    console.log(`  ${relative(process.cwd(), join(distServerDir, "webhook-worker.mjs"))}`);
  }
}

async function main() {
  const startTime = Date.now();
  const target = readCliTarget();

  if (target === "all") {
    ensureCleanDir(distDir);
    ensureDir(distAppDir);
    ensureDir(distServerDir);

    await buildWebTarget({ clean: false });
    await buildApiTarget({ clean: false });
    await buildWorkersTarget({ clean: false });
    pruneBuildMetadata(distDir);
  } else if (target === "web") {
    await buildWebTarget();
  } else if (target === "api") {
    await buildApiTarget();
  } else if (target === "workers") {
    await buildWorkersTarget();
  } else {
    throw new Error(`Unknown build target '${target}'`);
  }

  const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`Build completed in ${durationSeconds}s`);
  printOutput(target);
}

main().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
