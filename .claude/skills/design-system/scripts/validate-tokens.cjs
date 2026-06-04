#!/usr/bin/env node
/**
 * Check source files for hardcoded color values that should use tokens.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
]);
const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "build"]);

function parseArgs(argv) {
  const args = { dir: "src", json: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === "--dir" || arg === "-d") && argv[i + 1]) {
      args.dir = argv[i + 1];
      i += 1;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
}

function usage() {
  console.log("Usage: node scripts/validate-tokens.cjs --dir src/ [--json]");
}

function collectFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) collectFiles(fullPath, files);
    } else if (DEFAULT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function validateFile(filepath) {
  const content = fs.readFileSync(filepath, "utf-8");
  const issues = [];
  const matches = content.matchAll(/#[0-9A-Fa-f]{3,8}\b/g);

  for (const match of matches) {
    issues.push({
      file: filepath,
      index: match.index,
      value: match[0],
      message: "Use a design token instead of a hardcoded color",
    });
  }

  return issues;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const root = path.resolve(process.cwd(), args.dir);
  const issues = collectFiles(root).flatMap(validateFile);

  if (args.json) {
    console.log(
      JSON.stringify({ valid: issues.length === 0, issues }, null, 2)
    );
  } else if (issues.length === 0) {
    console.log("Token validation passed.");
  } else {
    console.error(
      `Token validation found ${issues.length} hardcoded color(s):`
    );
    for (const issue of issues) {
      console.error(
        `  ${path.relative(process.cwd(), issue.file)}: ${issue.value}`
      );
    }
  }

  process.exit(issues.length === 0 ? 0 : 1);
}

main();
