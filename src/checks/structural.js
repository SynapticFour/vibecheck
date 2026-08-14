// Type-2 (renamed-identifier) clone detection.
//
// Why not just tune jscpd? Its tokenizer is literal: `user` and `customer`
// are different tokens, so the stated primary use case — "the AI wrote this
// function four times with slightly different names" — is invisible to it.
//
// Why not jsinspect / a structural-diff library? jsinspect is unmaintained
// and pulls a heavier Babel stack. Acorn is ~570KB, zero sub-dependencies,
// and already a reasonable parser for a zero-config Node CLI. We keep jscpd
// for type-1 (literal) clones and add this as a second, additive signal.
//
// Method: parse each JS file, extract outermost functions of at least
// MIN_LINES, replace local variable/parameter/function names with positional
// placeholders (ID1, ID2, …), then exact-match the canonical token string.
// Exact match (not a similarity %) is the false-positive guard: two unrelated
// 6-line functions share length, not structure+literals, so they won't collide.
import { parse } from "acorn";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const MIN_LINES = 5;
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", "venv", "__pycache__"]);
const JS_EXT = /\.(js|mjs|cjs)$/;

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

export function findStructuralClones(repoPath) {
  const functions = [];
  for (const file of listJsFiles(repoPath)) {
    const source = readSource(file);
    if (source == null) continue;
    const ast = tryParse(source);
    if (!ast) continue;
    for (const fn of extractOutermostFunctions(ast, source)) {
      functions.push({
        file: relative(repoPath, file) || file,
        start: fn.node.start,
        end: fn.node.end,
        lines: fn.lines,
        name: functionName(fn.node),
        original: fn.original,
        normalized: fn.normalized,
      });
    }
  }

  const groups = new Map();
  for (const fn of functions) {
    if (!groups.has(fn.normalized)) groups.set(fn.normalized, []);
    groups.get(fn.normalized).push(fn);
  }

  const pairs = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        // Same function compared with itself (shouldn't happen, but cheap).
        if (a.file === b.file && a.start === b.start) continue;
        // Type-1: identical even before renaming. Leave those to jscpd.
        if (a.original === b.original) continue;
        pairs.push({ a, b, lines: Math.min(a.lines, b.lines) });
      }
    }
  }

  const totalStructuralDuplicateLines = pairs.reduce((sum, p) => sum + p.lines, 0);
  const structuralOffenders = [...pairs]
    .sort((x, y) => y.lines - x.lines)
    .slice(0, 5)
    .map((p) => ({
      fileA: p.a.file,
      fileB: p.b.file,
      nameA: p.a.name,
      nameB: p.b.name,
      lines: p.lines,
    }));

  return {
    structuralCloneCount: pairs.length,
    totalStructuralDuplicateLines,
    structuralOffenders,
  };
}

function listJsFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      listJsFiles(full, out);
    } else if (stat.isFile() && JS_EXT.test(name) && !name.endsWith(".min.js")) {
      out.push(full);
    }
  }
  return out;
}

function readSource(file) {
  try {
    const source = readFileSync(file, "utf8");
    if (source.length > 1_000_000) return null;
    return source;
  } catch {
    return null;
  }
}

function tryParse(source) {
  const opts = {
    ecmaVersion: "latest",
    locations: true,
    allowHashBang: true,
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
  };
  try {
    return parse(source, { ...opts, sourceType: "module" });
  } catch {
    try {
      return parse(source, { ...opts, sourceType: "script" });
    } catch {
      return null;
    }
  }
}

function extractOutermostFunctions(ast, source) {
  const all = [];
  walk(ast, null, (node) => {
    if (!FUNCTION_TYPES.has(node.type) || !node.loc) return;
    const lines = node.loc.end.line - node.loc.start.line + 1;
    if (lines < MIN_LINES) return;
    all.push({
      node,
      lines,
      original: canonicalize(source.slice(node.start, node.end)),
      normalized: normalizeFunction(source, node),
    });
  });

  return all.filter(
    (fn) =>
      !all.some(
        (other) =>
          other !== fn && other.node.start <= fn.node.start && other.node.end >= fn.node.end,
      ),
  );
}

function normalizeFunction(source, fnNode) {
  const bindings = collectBindings(fnNode);
  const map = new Map(bindings.map((name, i) => [name, `ID${i + 1}`]));
  const replacements = [];

  walk(fnNode, null, (node, parent) => {
    if (node.type !== "Identifier") return;
    if (!map.has(node.name)) return;
    if (isPropertyName(node, parent)) return;
    replacements.push({ start: node.start, end: node.end, text: map.get(node.name) });
  });

  replacements.sort((a, b) => b.start - a.start);
  let out = source.slice(fnNode.start, fnNode.end);
  const offset = fnNode.start;
  for (const r of replacements) {
    const s = r.start - offset;
    const e = r.end - offset;
    out = out.slice(0, s) + r.text + out.slice(e);
  }
  return canonicalize(out);
}

function collectBindings(fnNode) {
  const seen = new Set();
  const bindings = [];
  const add = (name) => {
    if (name && !seen.has(name)) {
      seen.add(name);
      bindings.push(name);
    }
  };

  if (fnNode.id?.name) add(fnNode.id.name);
  for (const p of fnNode.params || []) collectPatternBindings(p, add);

  walk(fnNode.body, fnNode, (node, parent) => {
    if (node === fnNode) return;
    if (FUNCTION_TYPES.has(node.type) && node !== fnNode) {
      if (node.id?.name) add(node.id.name);
      for (const p of node.params || []) collectPatternBindings(p, add);
    }
    if (node.type === "VariableDeclarator") collectPatternBindings(node.id, add);
    if (node.type === "ClassDeclaration" && node.id) add(node.id.name);
    if (node.type === "CatchClause" && node.param) collectPatternBindings(node.param, add);
    if (parent?.type === "ImportDeclaration") return;
  });

  return bindings;
}

function collectPatternBindings(pattern, add) {
  if (!pattern) return;
  switch (pattern.type) {
    case "Identifier":
      add(pattern.name);
      break;
    case "ObjectPattern":
      for (const prop of pattern.properties) {
        if (prop.type === "RestElement") collectPatternBindings(prop.argument, add);
        else collectPatternBindings(prop.value, add);
      }
      break;
    case "ArrayPattern":
      for (const el of pattern.elements) {
        if (el) collectPatternBindings(el, add);
      }
      break;
    case "RestElement":
      collectPatternBindings(pattern.argument, add);
      break;
    case "AssignmentPattern":
      collectPatternBindings(pattern.left, add);
      break;
    default:
      break;
  }
}

function isPropertyName(node, parent) {
  if (!parent) return false;
  if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) {
    return true;
  }
  if (
    (parent.type === "Property" ||
      parent.type === "MethodDefinition" ||
      parent.type === "PropertyDefinition") &&
    parent.key === node &&
    !parent.computed &&
    !parent.shorthand
  ) {
    return true;
  }
  if (parent.type === "LabeledStatement" && parent.label === node) return true;
  if (
    (parent.type === "BreakStatement" || parent.type === "ContinueStatement") &&
    parent.label === node
  ) {
    return true;
  }
  if (parent.type === "MetaProperty") return true;
  return false;
}

function functionName(node) {
  if (node.id?.name) return node.id.name;
  return "(anonymous)";
}

function canonicalize(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function walk(node, parent, visit) {
  if (!node || typeof node !== "object") return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === "start" || key === "end" || key === "loc" || key === "range") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === "object" && c.type) walk(c, node, visit);
      }
    } else if (child && typeof child === "object" && child.type) {
      walk(child, node, visit);
    }
  }
}
