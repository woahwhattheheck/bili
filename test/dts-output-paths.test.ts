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


test('failed declaration publication preserves the previous bundle', async () => {
  const cwd = path.join(__dirname, 'fixtures', 'declaration-bundle')
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-dts-rollback-'))
  const output = path.join(dist, 'index.d.ts')
  const previous = '// last successfully published declaration bundle\n'
  fs.writeFileSync(output, previous)
  const bundler = new Bundler(
    { input: 'index.ts', output: { dir: dist, dts: true } },
    { rootDir: cwd, configFile: false, logLevel: 'quiet' }
  )
  const source = {
    input: ['index.ts'],
    files: ['index.ts', 'message.ts'],
    hasTs: true,
    hasVue: false,
  } as any

  // Fail exactly at the final publication boundary, after TypeScript emit
  // and Rollup output, to exercise atomic rollback rather than typechecking.
  const rename = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
    throw new Error('simulated declaration publication failure')
  })
  try {
    await expect(bundler.buildDtsBundle(source)).rejects.toThrow(
      'simulated declaration publication failure'
    )
  } finally {
    rename.mockRestore()
  }

  try {
    expect(fs.readFileSync(output, 'utf8')).toBe(previous)
    expect(fs.existsSync(`${output}.tmp`)).toBe(false)
    expect(fs.existsSync(path.join(dist, 'message.d.ts'))).toBe(false)
  } finally {
    removeTree(dist)
  }
}, 20000)

test('project-local alias and package type resolution survive declaration staging', async () => {
  const cwd = fs.mkdtempSync(path.join(__dirname, 'fixtures', 'bili-dts-resolution-'))
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-dts-resolution-output-'))
  const src = path.join(cwd, 'src')
  const dependency = path.join(cwd, 'node_modules', 'typed-package')
  fs.mkdirSync(src, { recursive: true })
  fs.mkdirSync(dependency, { recursive: true })
  fs.writeFileSync(path.join(cwd, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      baseUrl: '.',
      paths: { '@project/*': ['src/*'] },
      module: 'esnext', moduleResolution: 'node', target: 'es2017',
    },
    include: ['src/**/*.ts'],
  }))
  fs.writeFileSync(path.join(src, 'model.ts'), 'export interface Model { modelId: string }\n')
  fs.writeFileSync(path.join(dependency, 'package.json'), JSON.stringify({ types: 'index.d.ts' }))
  fs.writeFileSync(path.join(dependency, 'index.d.ts'), 'export interface Dependency { enabled: boolean }\n')
  fs.writeFileSync(path.join(src, 'index.ts'), [
    "import type { Model } from '@project/model'",
    "import type { Dependency } from 'typed-package'",
    'export interface PublicContract extends Model, Dependency {}',
  ].join('\n'))
  const bundler = new Bundler(
    { input: 'src/index.ts', output: { dir: dist, dts: true } },
    { rootDir: cwd, configFile: false, logLevel: 'quiet' }
  )
  try {
    await bundler.buildDtsBundle({
      input: ['src/index.ts'], files: ['src/index.ts', 'src/model.ts'],
      hasTs: true, hasVue: false,
    } as any)
    const bundled = fs.readFileSync(path.join(dist, 'index.d.ts'), 'utf8')
    expect(bundled).toContain('PublicContract')
    expect(bundled).toContain('modelId')
    expect(bundled).toContain('enabled')
    expect(bundled).not.toContain('@project/model')
    expect(fs.readdirSync(cwd).filter((name) => name.startsWith('.bili-dts-'))).toHaveLength(0)
  } finally {
    removeTree(dist)
    removeTree(cwd)
  }
}, 20000)
