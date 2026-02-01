import { test, expect, beforeEach, afterEach } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PackageUsage, PackageUsageStats } from "../../src/types.js";
import type { PackageJson } from "../../src/internal_types.js";
import { extractPackageNames } from "../../src/usage_analyzer.js";

// Create a temporary directory for test files
const testDir = "./tmp-test-usage-analyzer";
const packagePath = path.join(process.cwd(), testDir);

beforeEach(async () => {
  // Create test directory if it doesn't exist
  await fs.mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  // Clean up test directory
  await fs.rm(testDir, { recursive: true, force: true });
});

test("extractPackageNames: no imports", () => {
  const content = "const x = 5;";
  const packages = extractPackageNames(content);
  expect(packages).toEqual([]);
});

test("extractPackageNames: ES6 default import", () => {
  const content = `import express from 'express';`;
  const packages = extractPackageNames(content);
  expect(packages).toEqual(["express"]);
});

test("extractPackageNames: ES6 named import", () => {
  const content = `import { Router } from 'express';`;
  const packages = extractPackageNames(content);
  expect(packages).toEqual(["express"]);
});

test("extractPackageNames: ES6 namespace import", () => {
  const content = `import * as express from 'express';`;
  const packages = extractPackageNames(content);
  expect(packages).toEqual(["express"]);
});

test("extractPackageNames: ES6 mixed imports", () => {
  const content = `
import express from 'express';
import { Router } from 'express';
import * as http from 'http';
`;
  const packages = extractPackageNames(content);
  expect(packages.sort()).toEqual(["express", "http"]);
});

test("extractPackageNames: CommonJS require", () => {
  const content = `const express = require('express');`;
  const packages = extractPackageNames(content);
  expect(packages).toEqual(["express"]);
});

test("extractPackageNames: dynamic import", () => {
  const content = `const express = await import('express');`;
  const packages = extractPackageNames(content);
  expect(packages).toEqual(["express"]);
});

test("extractPackageNames: local imports are ignored", () => {
  const content = `
import express from 'express';
import { helper } from './helper';
import { config } from '../config';
`;
  const packages = extractPackageNames(content);
  expect(packages).toEqual(["express"]);
});

test("extractPackageNames: scoped packages", () => {
  const content = `import { Logger } from '@nestjs/common';`;
  const packages = extractPackageNames(content);
  expect(packages).toEqual(["@nestjs/common"]);
});

test("extractPackageNames: multiple imports", () => {
  const content = `
import express from 'express';
import { Router } from 'express';
import * as http from 'http';
import { Logger } from '@nestjs/common';
const mongoose = require('mongoose');
const React = await import('react');
`;
  const packages = extractPackageNames(content);
  expect(packages.sort()).toEqual(["@nestjs/common", "express", "http", "mongoose", "react"]);
});

test("analyzePackageUsageAsync: empty project", async () => {
  const { analyzePackageUsageAsync } = await import("../../src/usage_analyzer.js");
  
  const pkg: PackageJson = {
    name: "test-package",
    version: "1.0.0",
    dependencies: {},
    devDependencies: {}
  };

  const result = await analyzePackageUsageAsync(pkg, packagePath, true);
  
  expect(result.totalPackages).toBe(0);
  expect(result.analyzedFiles).toBe(0);
  expect(result.usageByPackage.size).toBe(0);
});

test("analyzePackageUsageAsync: packages but no source files", async () => {
  const { analyzePackageUsageAsync } = await import("../../src/usage_analyzer.js");
  
  const pkg: PackageJson = {
    name: "test-package",
    version: "1.0.0",
    dependencies: {
      "express": "^4.18.2"
    },
    devDependencies: {
      "jest": "^29.0.0"
    }
  };

  const result = await analyzePackageUsageAsync(pkg, packagePath, true);
  
  expect(result.totalPackages).toBe(2);
  expect(result.analyzedFiles).toBe(0);
  expect(result.usageByPackage.size).toBe(2);
  
  const expressUsage = result.usageByPackage.get("express");
  expect(expressUsage).toBeDefined();
  expect(expressUsage?.fileCount).toBe(0);
  expect(expressUsage?.filePaths).toEqual([]);
  
  const jestUsage = result.usageByPackage.get("jest");
  expect(jestUsage).toBeDefined();
  expect(jestUsage?.fileCount).toBe(0);
  expect(jestUsage?.filePaths).toEqual([]);
});

test("analyzePackageUsageAsync: with source files", async () => {
  const { analyzePackageUsageAsync } = await import("../../src/usage_analyzer.js");
  
  // Create test source files
  const srcDir = path.join(packagePath, "src");
  await fs.mkdir(srcDir, { recursive: true });
  
  await fs.writeFile(
    path.join(srcDir, "app.ts"),
    `import express from 'express';
import { Router } from 'express';`
  );
  
  await fs.writeFile(
    path.join(srcDir, "server.ts"),
    `const http = require('http');
import { Logger } from '@nestjs/common';`
  );

  const pkg: PackageJson = {
    name: "test-package",
    version: "1.0.0",
    dependencies: {
      "express": "^4.18.2",
      "http": "latest",
      "@nestjs/common": "^10.0.0"
    },
    devDependencies: {
      "jest": "^29.0.0"
    }
  };

  const result = await analyzePackageUsageAsync(pkg, packagePath, true);
  
  expect(result.totalPackages).toBe(4);
  expect(result.analyzedFiles).toBe(2);
  
  // Check express usage
  const expressUsage = result.usageByPackage.get("express");
  expect(expressUsage).toBeDefined();
  expect(expressUsage?.fileCount).toBe(1);
  // Normalize paths for cross-platform comparison
  const expressPaths = expressUsage?.filePaths.map(p => p.replace(/\\/g, "/")) ?? [];
  expect(expressPaths).toEqual(["src/app.ts"]);
  
  // Check http usage
  const httpUsage = result.usageByPackage.get("http");
  expect(httpUsage).toBeDefined();
  expect(httpUsage?.fileCount).toBe(1);
  const httpPaths = httpUsage?.filePaths.map(p => p.replace(/\\/g, "/")) ?? [];
  expect(httpPaths).toEqual(["src/server.ts"]);
  
  // Check @nestjs/common usage
  const nestjsUsage = result.usageByPackage.get("@nestjs/common");
  expect(nestjsUsage).toBeDefined();
  expect(nestjsUsage?.fileCount).toBe(1);
  const nestjsPaths = nestjsUsage?.filePaths.map(p => p.replace(/\\/g, "/")) ?? [];
  expect(nestjsPaths).toEqual(["src/server.ts"]);
  
  // Check jest usage (not used in files)
  const jestUsage = result.usageByPackage.get("jest");
  expect(jestUsage).toBeDefined();
  expect(jestUsage?.fileCount).toBe(0);
  expect(jestUsage?.filePaths).toEqual([]);
});

test("analyzePackageUsageAsync: multiple files using same package", async () => {
  const { analyzePackageUsageAsync } = await import("../../src/usage_analyzer.js");
  
  // Create test source files
  const srcDir = path.join(packagePath, "src");
  await fs.mkdir(srcDir, { recursive: true });
  
  await fs.writeFile(
    path.join(srcDir, "app.ts"),
    `import express from 'express';`
  );
  
  await fs.writeFile(
    path.join(srcDir, "server.ts"),
    `import express from 'express';`
  );
  
  await fs.writeFile(
    path.join(srcDir, "routes.ts"),
    `import { Router } from 'express';`
  );

  const pkg: PackageJson = {
    name: "test-package",
    version: "1.0.0",
    dependencies: {
      "express": "^4.18.2"
    }
  };

  const result = await analyzePackageUsageAsync(pkg, packagePath, true);
  
  const expressUsage = result.usageByPackage.get("express");
  expect(expressUsage).toBeDefined();
  expect(expressUsage?.fileCount).toBe(3);
  const expressPaths = expressUsage?.filePaths.map(p => p.replace(/\\/g, "/")) ?? [];
  expect(expressPaths).toEqual(["src/app.ts", "src/routes.ts", "src/server.ts"]);
});

test("analyzePackageUsageAsync: includeDetails false", async () => {
  const { analyzePackageUsageAsync } = await import("../../src/usage_analyzer.js");
  
  // Create test source file
  const srcDir = path.join(packagePath, "src");
  await fs.mkdir(srcDir, { recursive: true });
  
  await fs.writeFile(
    path.join(srcDir, "app.ts"),
    `import express from 'express';`
  );

  const pkg: PackageJson = {
    name: "test-package",
    version: "1.0.0",
    dependencies: {
      "express": "^4.18.2"
    }
  };

  const result = await analyzePackageUsageAsync(pkg, packagePath, false);
  
  const expressUsage = result.usageByPackage.get("express");
  expect(expressUsage).toBeDefined();
  expect(expressUsage?.fileCount).toBe(1);
  expect(expressUsage?.filePaths).toEqual([]);
});

test("analyzePackageUsageAsync: ignores node_modules", async () => {
  const { analyzePackageUsageAsync } = await import("../../src/usage_analyzer.js");
  
  // Create node_modules directory with a file
  const nodeModulesDir = path.join(packagePath, "node_modules");
  await fs.mkdir(nodeModulesDir, { recursive: true });
  
  await fs.writeFile(
    path.join(nodeModulesDir, "package.js"),
    `import express from 'express';`
  );
  
  // Create src directory
  const srcDir = path.join(packagePath, "src");
  await fs.mkdir(srcDir, { recursive: true });
  
  await fs.writeFile(
    path.join(srcDir, "app.ts"),
    `import express from 'express';`
  );

  const pkg: PackageJson = {
    name: "test-package",
    version: "1.0.0",
    dependencies: {
      "express": "^4.18.2"
    }
  };

  const result = await analyzePackageUsageAsync(pkg, packagePath, true);
  
  // Should only analyze src/app.ts, not node_modules/package.js
  expect(result.analyzedFiles).toBe(1);
});

test("analyzePackageUsageAsync: handles subdirectories", async () => {
  const { analyzePackageUsageAsync } = await import("../../src/usage_analyzer.js");
  
  // Create test source files in subdirectories
  const srcDir = path.join(packagePath, "src");
  const servicesDir = path.join(srcDir, "services");
  await fs.mkdir(servicesDir, { recursive: true });
  
  await fs.writeFile(
    path.join(srcDir, "app.ts"),
    `import express from 'express';`
  );
  
  await fs.writeFile(
    path.join(servicesDir, "database.ts"),
    `import mongoose from 'mongoose';`
  );

  const pkg: PackageJson = {
    name: "test-package",
    version: "1.0.0",
    dependencies: {
      "express": "^4.18.2",
      "mongoose": "^7.0.0"
    }
  };

  const result = await analyzePackageUsageAsync(pkg, packagePath, true);
  
  expect(result.analyzedFiles).toBe(2);
  
  const expressUsage = result.usageByPackage.get("express");
  const expressPaths = expressUsage?.filePaths.map(p => p.replace(/\\/g, "/")) ?? [];
  expect(expressPaths).toEqual(["src/app.ts"]);
  
  const mongooseUsage = result.usageByPackage.get("mongoose");
  const mongoosePaths = mongooseUsage?.filePaths.map(p => p.replace(/\\/g, "/")) ?? [];
  expect(mongoosePaths).toEqual(["src/services/database.ts"]);
});

test("analyzePackageUsageAsync: ignores hidden directories", async () => {
  const { analyzePackageUsageAsync } = await import("../../src/usage_analyzer.js");
  
  // Create hidden directory
  const hiddenDir = path.join(packagePath, ".hidden");
  await fs.mkdir(hiddenDir, { recursive: true });
  
  await fs.writeFile(
    path.join(hiddenDir, "app.ts"),
    `import express from 'express';`
  );
  
  // Create src directory
  const srcDir = path.join(packagePath, "src");
  await fs.mkdir(srcDir, { recursive: true });
  
  await fs.writeFile(
    path.join(srcDir, "app.ts"),
    `import express from 'express';`
  );

  const pkg: PackageJson = {
    name: "test-package",
    version: "1.0.0",
    dependencies: {
      "express": "^4.18.2"
    }
  };

  const result = await analyzePackageUsageAsync(pkg, packagePath, true);
  
  // Should only analyze src/app.ts, not .hidden/app.ts
  expect(result.analyzedFiles).toBe(1);
});
