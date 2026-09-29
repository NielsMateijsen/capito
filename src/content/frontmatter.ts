import { parse } from 'yaml'

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

/** Splits a Markdown file into its YAML frontmatter and body. Browser-safe (no Node APIs). */
export function parseFrontmatter(raw: string): { data: unknown; body: string } {
  const text = raw.replace(/^﻿/, '')
  const match = FRONTMATTER.exec(text)
  if (!match) return { data: {}, body: text }
  return { data: parse(match[1]) ?? {}, body: text.slice(match[0].length) }
}
