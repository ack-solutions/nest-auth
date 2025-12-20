#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");

// Package paths
const NEST_AUTH_PATH = path.join(__dirname, "../packages/nest-auth/package.json");
const NEST_AUTH_JS_PATH = path.join(__dirname, "../packages/nest-auth-js/package.json");
const NEST_AUTH_DIR = path.dirname(NEST_AUTH_PATH);
const NEST_AUTH_JS_DIR = path.dirname(NEST_AUTH_JS_PATH);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function closeReadline() {
  rl.close();
}

// Get current version from nest-auth package.json (master version)
function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(NEST_AUTH_PATH, "utf8"));
  return packageJson.version;
}

// Calculate new version
function calculateVersion(currentVersion, versionType) {
  const [major, minor, patch] = currentVersion.split(".").map(Number);

  switch (versionType) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      return versionType; // Custom version
  }
}

// Select version type interactively
async function selectVersionType(currentVersion) {
  const [major, minor, patch] = currentVersion.split(".").map(Number);
  const patchVersion = `${major}.${minor}.${patch + 1}`;
  const minorVersion = `${major}.${minor + 1}.0`;
  const majorVersion = `${major + 1}.0.0`;

  console.log(`\n📝 Select version bump type:\n`);
  console.log(`   1) Patch  ${currentVersion} → ${patchVersion}  (Bug fixes, small changes)`);
  console.log(`   2) Minor  ${currentVersion} → ${minorVersion}  (New features, backward compatible)`);
  console.log(`   3) Major  ${currentVersion} → ${majorVersion}  (Breaking changes)\n`);

  const selection = await question("❓ Enter your choice (1-3): ");

  let versionType;
  switch (selection.trim()) {
    case "1":
      versionType = "patch";
      break;
    case "2":
      versionType = "minor";
      break;
    case "3":
      versionType = "major";
      break;
    default:
      console.error("❌ Invalid selection. Please choose 1, 2, or 3.");
      process.exit(1);
  }

  console.log(`\n✅ Selected: ${versionType.toUpperCase()}\n`);
  return versionType;
}

// Generate Swagger docs
function generateSwaggerDocs() {
  console.log("📚 Generating Swagger documentation...\n");
  try {
    execSync(`pnpm generate:swagger`, { cwd: NEST_AUTH_DIR, stdio: "inherit" });
    console.log("\n✅ Swagger docs generated successfully\n");
  } catch (error) {
    console.error("❌ Swagger generation failed");
    console.log("⚠️  Continuing without Swagger docs...\n");
  }
}

// Build UI
function buildUI() {
  console.log("🎨 Building UI...\n");
  try {
    console.log("📦 Building admin console UI...");
    execSync("pnpm build:ui", { cwd: NEST_AUTH_DIR, stdio: "inherit" });
    console.log("\n✅ UI built successfully\n");
  } catch (error) {
    console.error("❌ UI build failed");
    process.exit(1);
  }
}

// Build packages
function buildPackages() {
  console.log("🔨 Building packages...\n");
  try {
    // Build nest-auth
    console.log("📦 Building @ackplus/nest-auth...");
    execSync("pnpm build", { cwd: NEST_AUTH_DIR, stdio: "inherit" });
    
    // Build nest-auth-js
    console.log("\n📦 Building @ackplus/nest-auth-js...");
    execSync("pnpm build", { cwd: NEST_AUTH_JS_DIR, stdio: "inherit" });
    
    console.log("\n✅ All packages built successfully\n");
  } catch (error) {
    console.error("❌ Build failed");
    process.exit(1);
  }
}

// Update version in both package.json files
function updateVersions(versionType) {
  const newVersion = calculateVersion(getCurrentVersion(), versionType);

  console.log("📦 Updating package versions...\n");

  // Update nest-auth-js first (dependency)
  const nestAuthJsJson = JSON.parse(fs.readFileSync(NEST_AUTH_JS_PATH, "utf8"));
  const oldNestAuthJsVersion = nestAuthJsJson.version;
  nestAuthJsJson.version = newVersion;
  fs.writeFileSync(NEST_AUTH_JS_PATH, JSON.stringify(nestAuthJsJson, null, 2) + "\n");
  console.log(`✅ Updated @ackplus/nest-auth-js from ${oldNestAuthJsVersion} to ${newVersion}`);

  // Update nest-auth and replace workspace dependency
  const nestAuthJson = JSON.parse(fs.readFileSync(NEST_AUTH_PATH, "utf8"));
  const oldNestAuthVersion = nestAuthJson.version;
  nestAuthJson.version = newVersion;
  // Replace workspace dependency with actual version for publishing
  if (nestAuthJson.dependencies && nestAuthJson.dependencies["@ackplus/nest-auth-js"]) {
    nestAuthJson.dependencies["@ackplus/nest-auth-js"] = newVersion;
  }
  fs.writeFileSync(NEST_AUTH_PATH, JSON.stringify(nestAuthJson, null, 2) + "\n");
  console.log(`✅ Updated @ackplus/nest-auth from ${oldNestAuthVersion} to ${newVersion}`);
  console.log(`✅ Replaced workspace dependency with version ${newVersion}\n`);

  return { oldVersion: oldNestAuthVersion, newVersion };
}

// Ensure NPM authentication
async function ensureNpmAuth() {
  try {
    execSync("npm whoami", { stdio: "ignore" });
    return true;
  } catch (error) {
    console.error("❌ Not authenticated with npm");
    console.error("   Run: npm login\n");
    return false;
  }
}

// Publish a single package
async function publishSinglePackage(packageName, packageDir) {
  try {
    console.log(`📦 Publishing ${packageName}...`);
    execSync("npm publish --access public", { 
      cwd: packageDir,
      stdio: "inherit" 
    });
    console.log(`✅ ${packageName} published successfully!\n`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to publish ${packageName}\n`);
    return false;
  }
}

// Publish both packages
async function publishPackages() {
  console.log("🚀 Publishing packages to npm...\n");

  // Publish nest-auth-js first (dependency)
  const nestAuthJsSuccess = await publishSinglePackage("@ackplus/nest-auth-js", NEST_AUTH_JS_DIR);
  if (!nestAuthJsSuccess) {
    return false;
  }

  // Publish nest-auth (depends on nest-auth-js)
  const nestAuthSuccess = await publishSinglePackage("@ackplus/nest-auth", NEST_AUTH_DIR);
  if (!nestAuthSuccess) {
    return false;
  }

  return true;
}

// Main execution
async function main() {
  try {
    console.log("🚀 Starting publish process for both packages...\n");

    // Get current version
    const currentVersion = getCurrentVersion();
    console.log(`📦 Current version: ${currentVersion}\n`);

    // Select version type
    const versionType = await selectVersionType(currentVersion);
    const newVersion = calculateVersion(currentVersion, versionType);

    // Show summary and confirm
    console.log(`📋 Summary:`);
    console.log(`   Current version:  ${currentVersion}`);
    console.log(`   New version:      ${newVersion}`);
    console.log(`   Type:             ${versionType}`);
    console.log(`   Packages:         @ackplus/nest-auth`);
    console.log(`                     @ackplus/nest-auth-js\n`);
    console.log(`⚠️  Both packages will be published with the same version to avoid conflicts.\n`);

    const confirm = await question("❓ Proceed with publish? (Y/n): ");
    if (confirm.toLowerCase() === "n" || confirm.toLowerCase() === "no") {
      console.log("❌ Cancelled\n");
      closeReadline();
      return;
    }

    // Generate Swagger docs
    generateSwaggerDocs();
    
    // Build UI
    buildUI();
    
    // Build packages
    buildPackages();

    // Update versions
    const versionInfo = updateVersions(versionType);

    // Ensure npm auth
    const isAuthenticated = await ensureNpmAuth();
    if (!isAuthenticated) {
      console.log("⚠️  Skipping publish (not authenticated)\n");
      closeReadline();
      return;
    }

    // Publish packages
    const success = await publishPackages();

    if (success) {
      console.log("🎉 All packages published successfully!\n");
      console.log(`📦 Package Links:`);
      console.log(`   https://www.npmjs.com/package/@ackplus/nest-auth/v/${versionInfo.newVersion}`);
      console.log(`   https://www.npmjs.com/package/@ackplus/nest-auth-js/v/${versionInfo.newVersion}`);
      console.log(`\n📥 Install with:`);
      console.log(`   npm install @ackplus/nest-auth@${versionInfo.newVersion} @ackplus/nest-auth-js@${versionInfo.newVersion}`);
      console.log(`   pnpm add @ackplus/nest-auth@${versionInfo.newVersion} @ackplus/nest-auth-js@${versionInfo.newVersion}\n`);
    }

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    closeReadline();
  }
}

main();
