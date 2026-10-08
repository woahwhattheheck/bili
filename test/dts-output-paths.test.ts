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
