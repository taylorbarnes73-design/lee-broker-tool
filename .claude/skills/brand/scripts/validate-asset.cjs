#!/usr/bin/env node
/**
 * validate-asset.cjs
 *
 * Validates marketing assets against brand guidelines.
 * Checks: file naming, dimensions, file size, metadata.
 *
 * Usage:
 *   node validate-asset.cjs <asset-path>
 *   node validate-asset.cjs <asset-path> --json
 *   node validate-asset.cjs <asset-path> --fix
 *
 * For color validation of images, use with extract-colors.cjs
 */

const fs = require("fs");
const path = require("path");

// Validation rules
const RULES = {
  naming: {
    pattern: /^[a-z]+_[a-z0-9-]+_[a-z0-9-]+_\d{8}(_[a-z0-9-]+)?\.[a-zA-Z]+$/,
    description: "{type}_{campaign}_{description}_{timestamp}_{variant}.{ext}",
    examples: [
      "banner_claude-launch_hero-image_20251209.png",
      "logo_brand-refresh_horizontal_20251209_dark.svg",
    ],
  },
  dimensions: {
    banner: { minWidth: 600, minHeight: 300 },
    logo: { minWidth: 100, minHeight: 100 },
    design: { minWidth: 800, minHeight: 600 },
    video: { minWidth: 640, minHeight: 480 },
    default: { minWidth: 100, minHeight: 100 },
  },
  fileSize: {
    image: { max: 5 * 1024 * 1024, recommended: 1 * 1024 * 1024 },
    video: { max: 100 * 1024 * 1024, recommended: 50 * 1024 * 1024 },
    svg: { max: 500 * 1024, recommended: 100 * 1024 },
  },
  formats: {
    image: ["png", "jpg", "jpeg", "webp", "gif"],
    vector: ["svg"],
    video: ["mp4", "mov", "webm"],
    document: ["pdf", "psd", "ai", "fig"],
  },
};

/**
 * Parse asset filename
 */
function parseFilename(filename) {
  const parts = filename.replace(/\.[^.]+$/, "").split("_");

  if (parts.length < 4) {
    return null;
  }

  return {
    type: parts[0],
    campaign: parts[1],
    description: parts[2],
    timestamp: parts[3],
    variant: parts.length > 4 ? parts[4] : null,
    extension: path.extname(filename).slice(1).toLowerCase(),
  };
}

/**
 * Validate filename convention
 */
function validateFilename(filename) {
  const issues = [];
  const suggestions = [];

  // Check pattern match
  if (!RULES.naming.pattern.test(filename)) {
    issues.push("Filename does not match naming convention");
    suggestions.push(`Expected format: ${RULES.naming.description}`);
    suggestions.push(`Examples: ${RULES.naming.examples.join(", ")}`);
  }

  // Parse and check components
  const parsed = parseFilename(filename);
  if (parsed) {
    // Check timestamp format
    if (!/^\d{8}$/.test(parsed.timestamp)) {
      issues.push("Timestamp should be YYYYMMDD format");
    }

    // Check kebab-case for campaign and description
    if (parsed.campaign && !/^[a-z0-9-]+$/.test(parsed.campaign)) {
      issues.push("Campaign name should be kebab-case");
    }

    if (parsed.description && !/^[a-z0-9-]+$/.test(parsed.description)) {
      issues.push("Description should be kebab-case");
    }

    // Check valid type
    const validTypes = [
      "banner",
      "logo",
      "design",
      "video",
      "infographic",
      "icon",
      "photo",
    ];
    if (!validTypes.includes(parsed.type)) {
      suggestions.push(`Consider using type: ${validTypes.join(", ")}`);
    }
  }

  return { valid: issues.length === 0, issues, suggestions, parsed };
}

/**
 * Validate file size
 */
function validateFileSize(filepath, extension) {
  const issues = [];
  const warnings = [];

  const stats = fs.statSync(filepath);
  const size = stats.size;

  let limits;
  if (RULES.formats.video.includes(extension)) {
    limits = RULES.fileSize.video;
  } else if (extension === "svg") {
    limits = RULES.fileSize.svg;
  } else {
    limits = RULES.fileSize.image;
  }

  if (size > limits.max) {
    issues.push(
      `File size (${formatBytes(size)}) exceeds maximum (${formatBytes(
        limits.max
      )})`
    );
  } else if (size > limits.recommended) {
    warnings.push(
      `File size (${formatBytes(size)}) exceeds recommended (${formatBytes(
        limits.recommended
      )})`
    );
  }

  return { valid: issues.length === 0, issues, warnings, size };
}

/**
 * Validate file format
 */
function validateFormat(extension) {
  const issues = [];
  const info = { category: null };

  const allFormats = [
    ...RULES.formats.image,
    ...RULES.formats.vector,
    ...RULES.formats.video,
    ...RULES.formats.document,
  ];

  if (!allFormats.includes(extension)) {
    issues.push(`Unsupported file format: .${extension}`);
    return { valid: false, issues, info };
  }

  // Determine category
  if (RULES.formats.image.includes(extension)) info.category = "image";
  else if (RULES.formats.vector.includes(extension)) info.category = "vector";
  else if (RULES.formats.video.includes(extension)) info.category = "video";
  else if (RULES.formats.document.includes(extension))
    info.category = "document";

  return { valid: true, issues, info };
}

/**
 * Read dimensions for common image formats without external dependencies.
 */
function getImageDimensions(filepath, extension) {
  const buffer = fs.readFileSync(filepath);

  if (extension === "png" && buffer.toString("ascii", 1, 4) === "PNG") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (extension === "gif" && buffer.toString("ascii", 0, 3) === "GIF") {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
    };
  }

  if (["jpg", "jpeg"].includes(extension)) {
    return getJpegDimensions(buffer);
  }

  if (extension === "webp") {
    return getWebpDimensions(buffer);
  }

  if (extension === "svg") {
    return getSvgDimensions(buffer.toString("utf-8"));
  }

  return null;
}

function getJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}

function getWebpDimensions(buffer) {
  if (
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkType === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkType === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (chunkType === "VP8 ") {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  return null;
}

function getSvgDimensions(svg) {
  const widthMatch = svg.match(/\bwidth=["']?([0-9.]+)/i);
  const heightMatch = svg.match(/\bheight=["']?([0-9.]+)/i);
  if (widthMatch && heightMatch) {
    return {
      width: Number(widthMatch[1]),
      height: Number(heightMatch[1]),
    };
  }

  const viewBoxMatch = svg.match(
    /\bviewBox=["'][^"']*\s([0-9.]+)\s([0-9.]+)["']/i
  );
  if (viewBoxMatch) {
    return {
      width: Number(viewBoxMatch[1]),
      height: Number(viewBoxMatch[2]),
    };
  }

  return null;
}

/**
 * Validate image dimensions against asset type minimums.
 */
function validateDimensions(filepath, extension, assetType, category) {
  const issues = [];
  const warnings = [];

  if (!["image", "vector"].includes(category)) {
    return { valid: true, issues, warnings, dimensions: null, required: null };
  }

  const required = RULES.dimensions[assetType] || RULES.dimensions.default;
  const dimensions = getImageDimensions(filepath, extension);

  if (!dimensions) {
    warnings.push("Unable to read image dimensions");
    return { valid: true, issues, warnings, dimensions: null, required };
  }

  if (
    dimensions.width < required.minWidth ||
    dimensions.height < required.minHeight
  ) {
    issues.push(
      `Dimensions (${dimensions.width}x${dimensions.height}) are below minimum (${required.minWidth}x${required.minHeight})`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    dimensions,
    required,
  };
}

/**
 * Check if asset exists in manifest
 */
function checkManifest(filepath) {
  const manifestPath = path.join(process.cwd(), ".assets", "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return { registered: false, message: "Manifest not found" };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const relativePath = path.relative(process.cwd(), filepath);
    const found = manifest.assets?.find(
      a => a.path === relativePath || a.path === filepath
    );

    return {
      registered: !!found,
      message: found ? "Asset registered in manifest" : "Asset not in manifest",
      asset: found,
    };
  } catch {
    return { registered: false, message: "Error reading manifest" };
  }
}

/**
 * Generate suggested filename
 */
function suggestFilename(original, parsed) {
  if (!parsed) return null;

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const type = parsed.type || "asset";
  const campaign = parsed.campaign || "general";
  const description = parsed.description || "untitled";
  const ext = (parsed.extension || "png").toLowerCase();
  const variantSuffix = parsed.variant ? `_${parsed.variant}` : "";

  return `${type}_${campaign}_${description}_${today}${variantSuffix}.${ext}`;
}

function updateManifestPath(oldPath, newPath) {
  const manifestPath = path.join(process.cwd(), ".assets", "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return false;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const oldRelativePath = path.relative(process.cwd(), oldPath);
    const newRelativePath = path.relative(process.cwd(), newPath);
    let updated = false;

    for (const asset of manifest.assets || []) {
      if (asset.path === oldRelativePath || asset.path === oldPath) {
        asset.path = newRelativePath;
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    return updated;
  } catch {
    return false;
  }
}

function applyFixes(results) {
  const fixes = [];
  const filenameResult = results.checks.filename;
  const suggested = suggestFilename(results.filename, filenameResult?.parsed);

  if (
    !results.valid &&
    filenameResult &&
    !filenameResult.valid &&
    suggested &&
    suggested !== results.filename
  ) {
    const targetPath = path.join(path.dirname(results.path), suggested);
    if (fs.existsSync(targetPath)) {
      results.warnings.push(
        `Could not rename asset; target exists: ${targetPath}`
      );
    } else {
      fs.renameSync(results.path, targetPath);
      fixes.push(`Renamed asset to ${suggested}`);
      if (updateManifestPath(results.path, targetPath)) {
        fixes.push("Updated manifest path");
      }
      results = validateAsset(targetPath);
    }
  }

  results.fixes = fixes;
  return results;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Main validation function
 */
function validateAsset(assetPath) {
  const results = {
    path: assetPath,
    filename: path.basename(assetPath),
    valid: true,
    issues: [],
    warnings: [],
    suggestions: [],
    checks: {},
  };

  // Check file exists
  if (!fs.existsSync(assetPath)) {
    results.valid = false;
    results.issues.push(`File not found: ${assetPath}`);
    return results;
  }

  const filename = path.basename(assetPath);
  const extension = path.extname(filename).slice(1).toLowerCase();

  // 1. Validate filename
  const filenameResult = validateFilename(filename);
  results.checks.filename = filenameResult;
  if (!filenameResult.valid) {
    results.issues.push(...filenameResult.issues);
    results.suggestions.push(...filenameResult.suggestions);
  }

  // 2. Validate format
  const formatResult = validateFormat(extension);
  results.checks.format = formatResult;
  if (!formatResult.valid) {
    results.issues.push(...formatResult.issues);
  }

  // 3. Validate dimensions
  const assetType = filenameResult.parsed?.type || "default";
  const dimensionsResult = validateDimensions(
    assetPath,
    extension,
    assetType,
    formatResult.info.category
  );
  results.checks.dimensions = dimensionsResult;
  if (!dimensionsResult.valid) {
    results.issues.push(...dimensionsResult.issues);
  }
  results.warnings.push(...dimensionsResult.warnings);

  // 4. Validate file size
  const sizeResult = validateFileSize(assetPath, extension);
  results.checks.fileSize = sizeResult;
  if (!sizeResult.valid) {
    results.issues.push(...sizeResult.issues);
  }
  results.warnings.push(...sizeResult.warnings);

  // 5. Check manifest registration
  const manifestResult = checkManifest(assetPath);
  results.checks.manifest = manifestResult;
  if (!manifestResult.registered) {
    results.warnings.push("Asset not registered in manifest.json");
    results.suggestions.push(
      "Register asset in .assets/manifest.json for tracking"
    );
  }

  // 6. Suggest corrected filename if needed
  if (!filenameResult.valid && filenameResult.parsed) {
    const suggested = suggestFilename(filename, filenameResult.parsed);
    if (suggested) {
      results.suggestions.push(`Suggested filename: ${suggested}`);
    }
  }

  // Overall validity
  results.valid = results.issues.length === 0;

  return results;
}

/**
 * Format output for console
 */
function formatOutput(results) {
  const lines = [];

  lines.push("\n" + "=".repeat(60));
  lines.push(`ASSET VALIDATION: ${results.filename}`);
  lines.push("=".repeat(60));

  lines.push(`\nStatus: ${results.valid ? "PASS" : "FAIL"}`);
  lines.push(`Path: ${results.path}`);

  if (results.issues.length > 0) {
    lines.push("\nISSUES:");
    results.issues.forEach(issue => lines.push(`  - ${issue}`));
  }

  if (results.warnings.length > 0) {
    lines.push("\nWARNINGS:");
    results.warnings.forEach(warning => lines.push(`  - ${warning}`));
  }

  if (results.suggestions.length > 0) {
    lines.push("\nSUGGESTIONS:");
    results.suggestions.forEach(suggestion => lines.push(`  - ${suggestion}`));
  }

  if (results.fixes?.length > 0) {
    lines.push("\nFIXES:");
    results.fixes.forEach(fix => lines.push(`  - ${fix}`));
  }

  // File size info
  if (results.checks.fileSize?.size) {
    lines.push(`\nFile Size: ${formatBytes(results.checks.fileSize.size)}`);
  }

  if (results.checks.dimensions?.dimensions) {
    const { width, height } = results.checks.dimensions.dimensions;
    lines.push(`Dimensions: ${width}x${height}`);
  }

  lines.push("\n" + "=".repeat(60));

  return lines.join("\n");
}

/**
 * Main
 */
function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const fix = args.includes("--fix");
  const assetPath = args.find(a => !a.startsWith("--"));

  if (!assetPath) {
    console.error(
      "Usage: node validate-asset.cjs <asset-path> [--json] [--fix]"
    );
    console.error("\nExamples:");
    console.error(
      "  node validate-asset.cjs assets/banners/social-media/banner_launch_hero_20251209.png"
    );
    console.error(
      "  node validate-asset.cjs assets/logos/icon-only/logo-icon.svg --json"
    );
    console.error(
      "  node validate-asset.cjs assets/logos/icon-only/logo-icon.svg --fix"
    );
    process.exit(1);
  }

  // Resolve path
  const resolvedPath = path.isAbsolute(assetPath)
    ? assetPath
    : path.join(process.cwd(), assetPath);

  // Validate
  let results = validateAsset(resolvedPath);
  if (fix) {
    results = applyFixes(results);
  }

  // Output
  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(formatOutput(results));
  }

  // Exit with appropriate code
  process.exit(results.valid ? 0 : 1);
}

main();
