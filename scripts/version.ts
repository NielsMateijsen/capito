import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface BuildInfo {
  app: string
  commit: string
  content: string
  built: string
}

function getApp(): string {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  ) as { version: string }
  return pkg.version
}

function getCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return 'dev'
  }
}

function hashContentDir(): string {
  const dir = join(process.cwd(), 'content')
  const hash = createHash('sha256')

  function walk(d: string): void {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name)
      if (statSync(full).isDirectory()) {
        walk(full)
      } else {
        hash.update(name)
        hash.update(readFileSync(full))
      }
    }
  }

  try {
    walk(dir)
  } catch {
    hash.update('no-content')
  }

  return hash.digest('hex').slice(0, 8)
}

export function getBuildInfo(): BuildInfo {
  return {
    app: getApp(),
    commit: getCommit(),
    content: hashContentDir(),
    built: new Date().toISOString(),
  }
}
