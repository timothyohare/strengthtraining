// StrykerJS mutation testing (gate-mutation, CHG-0034). Scoped to the pure,
// unit-tested logic: the program engine (schedule, progression, warm-up,
// plates) and the lib helpers that each have a direct, mock-free test file.
// Excluded: auth/cognito/session/db (AWS + cookie side effects, covered by
// gate-verify rather than unit oracles), workouts.ts and units.ts (static
// data / no direct test yet — add here once tested).
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const strykerConfig = {
  packageManager: 'pnpm',
  testRunner: 'vitest',
  // pnpm's isolated node_modules hides plugins from Stryker's auto-discovery.
  plugins: ['@stryker-mutator/vitest-runner'],
  coverageAnalysis: 'perTest',
  mutate: [
    'lib/program-engine/{plates,progression,schedule,warmup}.ts',
    'lib/{dates,password,push-endpoint,redirect,set-tap,weight-adjust,with-timeout,workout-progress}.ts',
  ],
  reporters: ['clear-text', 'progress', 'json'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  incremental: true,
  incrementalFile: 'reports/mutation/stryker-incremental.json',
  // break = measured baseline (2026-10-14: 87.00%, 39 survivors). Ratchet up as
  // tests are strengthened; never lower it.
  thresholds: { high: 95, low: 87, break: 87 },
};
export default strykerConfig;
