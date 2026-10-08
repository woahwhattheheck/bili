import { Bundler } from '../src'
import logger from '../src/logger'
import { watch } from 'rollup'

jest.mock('rollup', () => ({
  rollup: jest.fn(),
  watch: jest.fn(),
}))

const mockWatch = watch as jest.Mock

function createBundler() {
  return new Bundler(
    { input: 'index.js' },
    {
      configFile: false,
      logLevel: 'quiet',
      rootDir: __dirname,
    }
  )
}

describe('watch mode', () => {
  beforeEach(() => {
    mockWatch.mockReset()
    process.exitCode = undefined
    jest.spyOn(logger, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.exitCode = undefined
    jest.restoreAllMocks()
  })

  it('logs fatal Rollup watch events and shuts down the watcher', async () => {
    const error = new Error('watch failed')
    const close = jest.fn()

    mockWatch.mockReturnValue({
      close,
      on(_event: string, listener: (payload: any) => void) {
        listener({ code: 'FATAL', error })
      },
    })

    await createBundler().run({ watch: true })

    expect(logger.error).toHaveBeenCalledWith('watch failed')
    expect(close).toHaveBeenCalledTimes(1)
    expect(process.exitCode).toBe(1)
  })

  it('closes on a malformed fatal event without dereferencing a missing error', async () => {
    const close = jest.fn()
    mockWatch.mockReturnValue({
      close,
      on(_event: string, listener: (payload: any) => void) {
        listener({ code: 'FATAL' })
      },
    })

    await createBundler().run({ watch: true })

    expect(logger.error).toHaveBeenCalledWith(
      'Rollup watcher stopped without error details'
    )
    expect(close).toHaveBeenCalledTimes(1)
    expect(process.exitCode).toBe(1)
  })

  it('keeps logging normal Rollup watch errors', async () => {
    const error = new Error('build failed')

    mockWatch.mockReturnValue({
      on(_event: string, listener: (payload: any) => void) {
        listener({ code: 'ERROR', error })
      },
    })

    await createBundler().run({ watch: true })

    expect(logger.error).toHaveBeenCalledWith('build failed')
  })

  it('ignores non-error watch events', async () => {
    mockWatch.mockReturnValue({
      on(_event: string, listener: (payload: any) => void) {
        listener({ code: 'BUNDLE_END' })
      },
    })

    await createBundler().run({ watch: true })

    expect(logger.error).not.toHaveBeenCalled()
  })
})
