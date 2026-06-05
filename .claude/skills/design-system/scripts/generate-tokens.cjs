#!/usr/bin/env node
/**
 * Generate CSS custom properties from a design tokens JSON file.
 *
 * Usage:
 *   node generate-tokens.cjs --config assets/design-tokens.json -o assets/design-tokens.css
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = { config: null, output: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config") {
      args.config = argv[i + 1];
      i += 1;
    } else if (arg === "-o" || arg === "--output") {
      args.output = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function tokenPathToCssName(parts) {
  const normalized =
    parts[0] === "primitive" ||
    parts[0] === "semantic" ||
    parts[0] === "component"
      ? parts.slice(1)
      : parts;

  return `--${normalized
    .join("-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .toLowerCase()}`;
}

function resolveTokenValue(value) {
  if (typeof value !== "string") return value;

  return value.replace(/\{([^}]+)\}/g, (_, refPath) => {
    return `var(${tokenPathToCssName(refPath.split("."))})`;
  });
}

function collectTokens(node, currentPath = [], output = []) {
  if (!node || typeof node !== "object") return output;

  if (Object.prototype.hasOwnProperty.call(node, "$value")) {
    output.push({
      name: tokenPathToCssName(currentPath),
      value: resolveTokenValue(node.$value),
    });
    return output;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$") || key === "brand") continue;
    collectTokens(value, [...currentPath, key], output);
  }

  return output;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.config || !args.output) {
    console.error(
      "Usage: node generate-tokens.cjs --config <tokens.json> -o <tokens.css>"
    );
    process.exit(1);
  }

  const configPath = path.resolve(process.cwd(), args.config);
  const outputPath = path.resolve(process.cwd(), args.output);

  if (!fs.existsSync(configPath)) {
    console.error(`Token config not found: ${configPath}`);
    process.exit(1);
  }

  const tokens = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const declarations = collectTokens(tokens);
  const css = [
    "/* Generated from design tokens. Do not edit manually. */",
    ":root {",
    ...declarations.map(({ name, value }) => `  ${name}: ${value};`),
    "}",
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, css);
}

main();
