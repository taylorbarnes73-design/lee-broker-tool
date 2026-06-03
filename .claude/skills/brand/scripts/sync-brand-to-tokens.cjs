#!/usr/bin/env node
/**
 * sync-brand-to-tokens.cjs
 *
 * Syncs brand-guidelines.md colors → design-tokens.json → design-tokens.css
 *
 * Usage:
 *   node sync-brand-to-tokens.cjs
 *   node sync-brand-to-tokens.cjs --dry-run
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Paths
const BRAND_GUIDELINES = "docs/brand-guidelines.md";
const DESIGN_TOKENS_JSON = "assets/design-tokens.json";
const DESIGN_TOKENS_CSS = "assets/design-tokens.css";
const GENERATE_TOKENS_SCRIPT =
  ".claude/skills/design-system/scripts/generate-tokens.cjs";
const HEX_COLOR_PATTERN = /^#[A-Fa-f0-9]{6}$/;
const DEFAULT_SEMANTIC_COLORS = {
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
};

function normalizeTokenName(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidHexColor(value) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value);
}

function extractBrandNameFromMarkdown(content) {
  const brandLineMatch = content.match(
    /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?Brand(?:\s+Name)?(?:\*\*)?\s*[:|]\s*([^|\n]+)/i
  );
  if (brandLineMatch) {
    return brandLineMatch[1].trim().replace(/\*\*/g, "");
  }

  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (!headingMatch) return null;

  const headingBrand = headingMatch[1]
    .replace(/\bBrand Guidelines\b/i, "")
    .replace(/\s+\(?v?\d+(?:\.\d+)*\)?\s*$/i, "")
    .trim();

  return headingBrand || null;
}

function parseColorRows(section, onColor) {
  const rows = section.matchAll(
    /\|\s*(?:\*\*)?([^|*]+?)(?:\*\*)?\s*\|\s*(#[A-Fa-f0-9]{6})\b/g
  );
  for (const match of rows) {
    const name = match[1].trim();
    if (!name || /^(name|state)$/i.test(name) || /^-+$/.test(name)) continue;
    onColor(name, match[2].toUpperCase());
  }
}

/**
 * Extract color info from brand guidelines markdown
 */
function extractColorsFromMarkdown(content) {
  const colors = {
    brandName: extractBrandNameFromMarkdown(content),
    primary: { name: "primary", shades: {} },
    secondary: { name: "secondary", shades: {} },
    accent: { name: "accent", shades: {} },
    semantic: {},
  };

  // Extract primary color name and hex from Quick Reference table
  const quickRefMatch = content.match(
    /Primary Color\s*\|\s*(#[A-Fa-f0-9]{6})(?:\s*\(([^)]+)\))?/i
  );
  if (quickRefMatch) {
    if (quickRefMatch[2])
      colors.primary.name = normalizeTokenName(quickRefMatch[2]);
    colors.primary.base = quickRefMatch[1].toUpperCase();
  }

  const secondaryMatch = content.match(
    /Secondary Color\s*\|\s*(#[A-Fa-f0-9]{6})(?:\s*\(([^)]+)\))?/i
  );
  if (secondaryMatch) {
    if (secondaryMatch[2])
      colors.secondary.name = normalizeTokenName(secondaryMatch[2]);
    colors.secondary.base = secondaryMatch[1].toUpperCase();
  }

  const accentMatch = content.match(
    /Accent Color\s*\|\s*(#[A-Fa-f0-9]{6})(?:\s*\(([^)]+)\))?/i
  );
  if (accentMatch) {
    if (accentMatch[2]) colors.accent.name = normalizeTokenName(accentMatch[2]);
    colors.accent.base = accentMatch[1].toUpperCase();
  }

  // Extract all shades from Primary Colors table
  const primarySection = content.match(
    /### Primary Colors[\s\S]*?\|[\s\S]*?(?=###|$)/i
  );
  if (primarySection) {
    parseColorRows(primarySection[0], (name, hex) => {
      const normalizedName = name.toLowerCase();
      if (
        colors.primary.name === "primary" &&
        normalizedName.includes("primary")
      ) {
        colors.primary.name = normalizeTokenName(name);
      }
      if (normalizedName.includes("dark")) colors.primary.dark = hex;
      else if (normalizedName.includes("light")) colors.primary.light = hex;
      else colors.primary.base = hex;
    });
  }

  // Extract secondary shades
  const secondarySection = content.match(
    /### Secondary Colors[\s\S]*?\|[\s\S]*?(?=###|$)/i
  );
  if (secondarySection) {
    parseColorRows(secondarySection[0], (name, hex) => {
      const normalizedName = name.toLowerCase();
      const target = normalizedName.includes("accent")
        ? colors.accent
        : colors.secondary;
      if (
        (target.name === "secondary" || target.name === "accent") &&
        normalizedName.includes(target.name)
      ) {
        target.name = normalizeTokenName(name);
      }
      if (normalizedName.includes("dark")) target.dark = hex;
      else if (normalizedName.includes("light")) target.light = hex;
      else target.base = hex;
    });
  }

  // Extract accent shades
  const accentSection = content.match(
    /### Accent Colors[\s\S]*?\|[\s\S]*?(?=###|$)/i
  );
  if (accentSection) {
    parseColorRows(accentSection[0], (name, hex) => {
      const normalizedName = name.toLowerCase();
      if (
        colors.accent.name === "accent" &&
        normalizedName.includes("accent")
      ) {
        colors.accent.name = normalizeTokenName(name);
      }
      if (normalizedName.includes("dark")) colors.accent.dark = hex;
      else if (normalizedName.includes("light")) colors.accent.light = hex;
      else colors.accent.base = hex;
    });
  }

  // Extract semantic status colors
  const semanticSection = content.match(
    /### Semantic Colors[\s\S]*?\|[\s\S]*?(?=###|$)/i
  );
  if (semanticSection) {
    parseColorRows(semanticSection[0], (name, hex) => {
      const normalizedName = name.toLowerCase();
      if (normalizedName.includes("success")) colors.semantic.success = hex;
      else if (normalizedName.includes("warning"))
        colors.semantic.warning = hex;
      else if (normalizedName.includes("error")) colors.semantic.error = hex;
      else if (normalizedName.includes("info")) colors.semantic.info = hex;
    });
  }

  return colors;
}

/**
 * Generate color scale from base color (simple approach)
 */
function generateColorScale(baseHex, darkHex, lightHex, label = "color") {
  if (!isValidHexColor(baseHex)) {
    throw new Error(`Missing valid base hex color for ${label}`);
  }

  const validDarkHex = isValidHexColor(darkHex) ? darkHex : null;
  const validLightHex = isValidHexColor(lightHex) ? lightHex : null;

  // Use provided shades or generate approximations
  const lightestHex = validLightHex
    ? adjustBrightness(validLightHex, 0.1)
    : adjustBrightness(baseHex, 0.9);
  return {
    50: {
      $value: lightestHex,
      $type: "color",
    },
    100: {
      $value: validLightHex || adjustBrightness(baseHex, 0.8),
      $type: "color",
    },
    200: { $value: adjustBrightness(baseHex, 0.6), $type: "color" },
    300: { $value: adjustBrightness(baseHex, 0.4), $type: "color" },
    400: { $value: adjustBrightness(baseHex, 0.2), $type: "color" },
    500: { $value: baseHex, $type: "color" },
    600: {
      $value: validDarkHex || adjustBrightness(baseHex, -0.15),
      $type: "color",
    },
    700: { $value: adjustBrightness(baseHex, -0.3), $type: "color" },
    800: { $value: adjustBrightness(baseHex, -0.45), $type: "color" },
    900: { $value: adjustBrightness(baseHex, -0.6), $type: "color" },
  };
}

/**
 * Adjust hex color brightness
 */
function adjustBrightness(hex, percent) {
  if (!isValidHexColor(hex)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(255 * percent)));
  const g = Math.min(
    255,
    Math.max(0, ((num >> 8) & 0x00ff) + Math.round(255 * percent))
  );
  const b = Math.min(
    255,
    Math.max(0, (num & 0x0000ff) + Math.round(255 * percent))
  );
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0").toUpperCase()}`;
}

function getPrimitiveColorNameFromReference(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^\{primitive\.color\.([a-z0-9-]+)\.\d+\}$/i);
  return match ? match[1] : null;
}

function getSyncedPrimitiveColorNames(tokens) {
  const semanticColors = tokens.semantic?.color || {};
  const syncedSemanticKeys = [
    "primary",
    "primary-hover",
    "primary-active",
    "primary-light",
    "primary-lighter",
    "primary-dark",
    "secondary",
    "secondary-hover",
    "secondary-light",
    "secondary-dark",
    "accent",
    "accent-hover",
    "accent-light",
  ];
  const names = new Set();

  for (const key of syncedSemanticKeys) {
    const name = getPrimitiveColorNameFromReference(
      semanticColors[key]?.$value
    );
    if (name) names.add(name);
  }

  return names;
}

/**
 * Update design tokens JSON
 */
function updateDesignTokens(tokens, colors) {
  if (colors.brandName) {
    tokens.brand = colors.brandName;
  }

  // Update primitive colors with new names
  tokens.primitive = tokens.primitive || {};
  const primitiveColors = tokens.primitive?.color || {};

  // Remove previously synced brand palette keys, then add the current palette.
  for (const name of getSyncedPrimitiveColorNames(tokens)) {
    delete primitiveColors[name];
  }

  // Add new named colors
  primitiveColors[colors.primary.name] = generateColorScale(
    colors.primary.base,
    colors.primary.dark,
    colors.primary.light,
    "primary"
  );
  primitiveColors[colors.secondary.name] = generateColorScale(
    colors.secondary.base,
    colors.secondary.dark,
    colors.secondary.light,
    "secondary"
  );
  primitiveColors[colors.accent.name] = generateColorScale(
    colors.accent.base,
    colors.accent.dark,
    colors.accent.light,
    "accent"
  );

  tokens.primitive.color = primitiveColors;

  // Update ALL semantic color references
  tokens.semantic = tokens.semantic || {};
  const sem = tokens.semantic.color || {};
  const p = colors.primary.name;
  const s = colors.secondary.name;
  const a = colors.accent.name;

  // Primary variants
  sem.primary = { $value: `{primitive.color.${p}.500}`, $type: "color" };
  sem["primary-hover"] = {
    $value: `{primitive.color.${p}.600}`,
    $type: "color",
  };
  sem["primary-active"] = {
    $value: `{primitive.color.${p}.700}`,
    $type: "color",
  };
  sem["primary-light"] = {
    $value: `{primitive.color.${p}.400}`,
    $type: "color",
  };
  sem["primary-lighter"] = {
    $value: `{primitive.color.${p}.100}`,
    $type: "color",
  };
  sem["primary-dark"] = {
    $value: `{primitive.color.${p}.600}`,
    $type: "color",
  };

  // Secondary variants
  sem.secondary = { $value: `{primitive.color.${s}.500}`, $type: "color" };
  sem["secondary-hover"] = {
    $value: `{primitive.color.${s}.600}`,
    $type: "color",
  };
  sem["secondary-light"] = {
    $value: `{primitive.color.${s}.300}`,
    $type: "color",
  };
  sem["secondary-dark"] = {
    $value: `{primitive.color.${s}.600}`,
    $type: "color",
  };

  // Accent variants
  sem.accent = { $value: `{primitive.color.${a}.500}`, $type: "color" };
  sem["accent-hover"] = {
    $value: `{primitive.color.${a}.600}`,
    $type: "color",
  };
  sem["accent-light"] = {
    $value: `{primitive.color.${a}.300}`,
    $type: "color",
  };

  // Status colors come from the Semantic Colors section, not the brand palette.
  const statusColors = { ...DEFAULT_SEMANTIC_COLORS, ...colors.semantic };
  sem.success = { $value: statusColors.success, $type: "color" };
  sem["success-light"] = {
    $value: adjustBrightness(statusColors.success, 0.35),
    $type: "color",
  };
  sem.warning = { $value: statusColors.warning, $type: "color" };
  sem["warning-light"] = {
    $value: adjustBrightness(statusColors.warning, 0.35),
    $type: "color",
  };
  sem.error = { $value: statusColors.error, $type: "color" };
  sem["error-light"] = {
    $value: adjustBrightness(statusColors.error, 0.35),
    $type: "color",
  };
  sem.info = { $value: statusColors.info, $type: "color" };
  sem["info-light"] = {
    $value: adjustBrightness(statusColors.info, 0.35),
    $type: "color",
  };
  tokens.semantic.color = sem;

  // Update component references (button uses primary color with opacity)
  tokens.component = tokens.component || {};
  tokens.component.button = tokens.component.button || {};
  tokens.component.button.primary = tokens.component.button.primary || {
    bg: { $value: "{semantic.color.primary}", $type: "color" },
    "bg-hover": { $value: "{semantic.color.primary-hover}", $type: "color" },
    "bg-active": { $value: "{semantic.color.primary-active}", $type: "color" },
  };
  tokens.component.button.secondary = tokens.component.button.secondary || {
    bg: { $value: "{semantic.color.secondary}", $type: "color" },
  };

  const primaryBase = colors.primary.base;
  if (!isValidHexColor(primaryBase)) {
    throw new Error("Missing valid base hex color for primary");
  }
  tokens.component.button.secondary["bg-hover"] = {
    $value: `${primaryBase}1A`,
    $type: "color",
  };

  return tokens;
}

/**
 * Main
 */
function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("🔄 Syncing brand guidelines → design tokens\n");

  // Read brand guidelines
  const guidelinesPath = path.resolve(process.cwd(), BRAND_GUIDELINES);
  if (!fs.existsSync(guidelinesPath)) {
    console.error(`❌ Brand guidelines not found: ${guidelinesPath}`);
    process.exit(1);
  }
  const guidelinesContent = fs.readFileSync(guidelinesPath, "utf-8");

  // Extract colors
  const colors = extractColorsFromMarkdown(guidelinesContent);
  const missing = ["primary", "secondary", "accent"].filter(
    k => !isValidHexColor(colors[k].base)
  );
  if (missing.length > 0) {
    console.error(`❌ Could not extract base hex for: ${missing.join(", ")}`);
    console.error(
      "   Ensure Quick Reference or color palette tables include #RRGGBB values for each color."
    );
    process.exit(1);
  }

  console.log("📊 Extracted colors:");
  console.log(`   Primary: ${colors.primary.name} (${colors.primary.base})`);
  console.log(
    `   Secondary: ${colors.secondary.name} (${colors.secondary.base})`
  );
  console.log(`   Accent: ${colors.accent.name} (${colors.accent.base})\n`);

  // Read existing tokens
  const tokensPath = path.resolve(process.cwd(), DESIGN_TOKENS_JSON);
  let tokens = {};
  if (fs.existsSync(tokensPath)) {
    tokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8"));
  }

  // Update tokens
  tokens = updateDesignTokens(tokens, colors);

  if (dryRun) {
    console.log("📋 Would update design-tokens.json:");
    console.log(
      JSON.stringify(tokens.primitive.color, null, 2).slice(0, 500) + "..."
    );
    console.log("\n⏭️  Dry run - no files changed");
    return;
  }

  // Write updated tokens
  fs.mkdirSync(path.dirname(tokensPath), { recursive: true });
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
  console.log(`✅ Updated: ${DESIGN_TOKENS_JSON}`);

  // Regenerate CSS
  const generateScript = path.resolve(process.cwd(), GENERATE_TOKENS_SCRIPT);
  if (fs.existsSync(generateScript)) {
    try {
      execSync(
        `node ${generateScript} --config ${DESIGN_TOKENS_JSON} -o ${DESIGN_TOKENS_CSS}`,
        {
          cwd: process.cwd(),
          stdio: "inherit",
        }
      );
      console.log(`✅ Regenerated: ${DESIGN_TOKENS_CSS}`);
    } catch (e) {
      console.error("⚠️  Failed to regenerate CSS:", e.message);
      process.exit(1);
    }
  } else {
    console.error(`❌ Token generator not found: ${generateScript}`);
    process.exit(1);
  }

  console.log("\n✨ Brand sync complete!");
}

main();
