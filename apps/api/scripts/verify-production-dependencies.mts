import { builtinModules, createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const dist = join(root, 'dist');
const runtimeRequire = createRequire(join(root, 'package.json'));
const files: string[] = [];

function walk(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.js')) files.push(path);
  }
}

walk(dist);
const packages = new Set<string>();
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/require\(["']([^"']+)["']\)/g)) {
    const specifier = match[1];
    if (
      !specifier ||
      specifier.startsWith('.') ||
      specifier.startsWith('node:') ||
      builtinModules.includes(specifier)
    )
      continue;
    const parts = specifier.split('/');
    packages.add(parts[0]!.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!);
  }
}

const unresolved: string[] = [];
for (const name of [...packages].sort()) {
  try {
    runtimeRequire.resolve(name);
  } catch {
    unresolved.push(name);
  }
}
console.log(`YAML_RESOLVED=${runtimeRequire.resolve('yaml')}`);
console.log(`DIRECT_IMPORTS=${packages.size}`);
console.log(`UNRESOLVED=${JSON.stringify(unresolved)}`);
if (unresolved.length) process.exitCode = 1;
