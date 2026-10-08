import fs from 'fs'
import os from 'os'
import path from 'path'
import { Bundler } from '../src'

function removeTree(dir: string) {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name)
    if (fs.statSync(file).isDirectory()) {
      removeTree(file)
    } else {
      fs.unlinkSync(file)
    }
  }
  fs.rmdirSync(dir)
}

test('dts output supports nested names and refuses paths outside output.dir', async () => {
  const cwd = path.join(__dirname, 'fixtures', 'declaration-bundle')
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-dts-output-'))
  const source = {
    input: ['index.ts'],
    files: ['index.ts', 'message.ts'],
    hasTs: true,
    hasVue: false,
  } as any
  const options = { rootDir: cwd, configFile: false, logLevel: 'quiet' as const }

  try {
    const bundler = new Bundler(
      { input: 'index.ts', output: { dir: dist, dts: 'types/public.d.ts' } },
      options
    )
    await bundler.buildDtsBundle(source)
    const result = fs.readFileSync(path.join(dist, 'types', 'public.d.ts'), 'utf8')
    expect(result).toContain('createMessage')
    expect(result).toContain('interface Message')

    const outside = new Bundler(
      { input: 'index.ts', output: { dir: dist, dts: '../escaped.d.ts' } },
      options
    )
    await expect(outside.buildDtsBundle(source)).rejects.toThrow(
      'output.dts must stay within output.dir'
    )
    expect(fs.existsSync(path.resolve(dist, '..', 'escaped.d.ts'))).toBe(false)
  } finally {
    removeTree(dist)
  }
}, 20000)

test('two declaration entries cannot overwrite the same named bundle', async () => {
  const cwd = path.join(__dirname, 'fixtures', 'declaration-bundle')
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-dts-collision-'))
  const bundler = new Bundler(
    { input: 'index.ts', output: { dir: dist, dts: true } },
    { rootDir: cwd, configFile: false, logLevel: 'quiet' }
  )
  const completed = new Set<string>()

  try {
    await bundler.buildDtsBundle(
      { input: ['index.ts'], files: ['index.ts'], hasTs: true, hasVue: false } as any,
      completed
    )
    const output = path.join(dist, 'index.d.ts')
    const firstBundle = fs.readFileSync(output, 'utf8')
    expect(firstBundle).toContain('createMessage')

    await expect(bundler.buildDtsBundle(
      { input: ['nested/index.ts'], files: ['nested/index.ts'], hasTs: true, hasVue: false } as any,
      completed
    )).rejects.toThrow('Multiple declaration entries target the same output')
    expect(fs.readFileSync(output, 'utf8')).toBe(firstBundle)
  } finally {
    removeTree(dist)
  }
}, 20000)
