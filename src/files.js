// Reading the two input files. A file is read whole, and only when it is a regular file under the size limit.
// The size is taken from the open file, so it cannot change between the check and the read.

import { open } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export const LIMITS = { maxFileBytes: 10 * 1024 * 1024 };

// An error with the path in its message and the reason alone in .reason, so a caller can show its own path.
export function fileError(path, reason) {
  return Object.assign(new Error(`${path}: ${reason}`), { reason });
}

export async function readBounded(path, limits = LIMITS) {
  let handle;
  try {
    handle = await open(resolve(path), 'r');
  } catch (error) {
    if (error.code === 'ENOENT') throw fileError(path, 'no such file');
    if (error.code === 'EISDIR') throw fileError(path, 'a folder, not a file');
    throw fileError(path, `cannot be read (${error.code ?? error.message})`);
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw fileError(path, 'not a regular file');
    if (info.size > limits.maxFileBytes) throw fileError(path, `${info.size.toLocaleString('en-US')} bytes is over the ${(limits.maxFileBytes / 1024 / 1024).toLocaleString('en-US')} MB limit`);
    const buffer = Buffer.alloc(info.size);
    let read = 0;
    while (read < info.size) {
      const { bytesRead } = await handle.read(buffer, read, info.size - read, read);
      if (bytesRead === 0) break;
      read += bytesRead;
    }
    return buffer.subarray(0, read);
  } finally {
    await handle.close();
  }
}

function toPosix(path) {
  return sep === '/' ? path : path.split(sep).join('/');
}

// A path as shown in a report: relative to the base folder with forward slashes; a path outside it is shown
// absolute, also with forward slashes.
export function displayPath(path, base) {
  const rel = relative(base, path);
  if (rel === '') return '.';
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return toPosix(path);
  return toPosix(rel);
}
