import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const packageDir = join(testDir, '..')
const stylesPath = join(packageDir, 'styles.css')
const srcDir = join(packageDir, 'src')

function classesFromStylesheet(css: string): Set<string> {
  const classes = new Set<string>()
  for (const match of css.matchAll(/\.((?:guide-[a-zA-Z0-9-]+))/g)) {
    const name = match[1]
    if (name) classes.add(name)
  }
  return classes
}

function classesFromSource(source: string): Set<string> {
  const classes = new Set<string>()
  for (const match of source.matchAll(/className="([^"]*)"/g)) {
    const attribute = match[1]
    if (!attribute) continue
    for (const token of attribute.split(/\s+/)) {
      if (token.startsWith('guide-')) classes.add(token)
    }
  }
  return classes
}

function readAllSource(): string {
  return readdirSync(srcDir)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => readFileSync(join(srcDir, name), 'utf-8'))
    .join('\n')
}

describe('styles.css matches the markup it targets', () => {
  it('every .guide- class the stylesheet names is rendered somewhere in src/*.tsx', () => {
    const css = readFileSync(stylesPath, 'utf-8')
    const styled = classesFromStylesheet(css)
    const rendered = classesFromSource(readAllSource())

    const dead = Array.from(styled).filter((name) => !rendered.has(name))
    expect(dead).toEqual([])
  })

  it('reports every guide- class the source renders and whether the stylesheet styles it', () => {
    const css = readFileSync(stylesPath, 'utf-8')
    const styled = classesFromStylesheet(css)
    const rendered = classesFromSource(readAllSource())

    const unstyled = Array.from(rendered)
      .filter((name) => !styled.has(name))
      .sort()

    // Two classes are deliberately left without a rule: see packages/unstyled/README.md
    // ("Parts the stylesheet does not style") for why each one is invisible on purpose rather
    // than an oversight.
    expect(unstyled).toEqual(['guide-launcher-anchor', 'guide-visually-hidden'])
  })

  it('is proven by a class that does not exist (red check, not part of the shipped rule set)', () => {
    const styled = classesFromStylesheet('.guide-this-class-does-not-exist-anywhere { color: red; }')
    const rendered = classesFromSource(readAllSource())
    const dead = Array.from(styled).filter((name) => !rendered.has(name))
    expect(dead).toEqual(['guide-this-class-does-not-exist-anywhere'])
  })
})
