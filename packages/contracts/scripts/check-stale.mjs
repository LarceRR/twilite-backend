import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const distDir = join(root, 'dist');

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else if (entry.isFile() && path.endsWith('.ts') && !path.endsWith('.spec.ts')) {
      files.push(path);
    }
  }
  return files;
}

async function newestMtime(paths) {
  let newest = 0;
  for (const path of paths) {
    const info = await stat(path);
    newest = Math.max(newest, info.mtimeMs);
  }
  return newest;
}

async function main() {
  const sources = await listFiles(srcDir);
  const indexJs = join(distDir, 'index.js');
  const indexDts = join(distDir, 'index.d.ts');

  try {
    await stat(indexJs);
    await stat(indexDts);
  } catch {
    console.error('@twilite/contracts dist is missing — run npm run build -w @twilite/contracts');
    process.exit(1);
  }

  const srcNewest = await newestMtime(sources);
  const distNewest = await newestMtime([indexJs, indexDts]);

  if (srcNewest > distNewest + 1) {
    console.error('@twilite/contracts dist is stale relative to src — rebuild required');
    process.exit(1);
  }

  const hash = createHash('sha256');
  for (const path of sources.sort()) {
    hash.update(relative(srcDir, path));
    hash.update('\0');
    hash.update(await readFile(path));
    hash.update('\0');
  }
  console.log(`@twilite/contracts ok checksum=${hash.digest('hex').slice(0, 16)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
