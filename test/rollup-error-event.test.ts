import { isRollupErrorEvent } from '../src'

test('detects rollup watch error events', () => {
  expect(
    isRollupErrorEvent({ code: 'ERROR', error: { message: 'boom' } })
  ).toBe(true)
  expect(
    isRollupErrorEvent({ code: 'FATAL', error: { message: 'boom' } })
  ).toBe(true)
  // A code alone does not establish an error object; callbacks must not crash.
  expect(isRollupErrorEvent({ code: 'FATAL' })).toBe(false)
  expect(isRollupErrorEvent({ code: 'FATAL', error: null })).toBe(false)
  expect(isRollupErrorEvent({ code: 'ERROR', error: {} })).toBe(false)
  expect(isRollupErrorEvent({ code: 'BUNDLE_END' })).toBe(false)
  expect(isRollupErrorEvent({ code: 'START' })).toBe(false)
  expect(isRollupErrorEvent({})).toBe(false)
  expect(isRollupErrorEvent(null)).toBe(false)
})
