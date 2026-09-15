// Metro does not timestamp console.log, so logs from different files can't be
// ordered against each other. Every line carries seconds since launch instead.
// __DEV__-gated: nothing here reaches a TestFlight or production build.
const bootTime = Date.now();

export function debugLog(tag: string, ...args: unknown[]) {
    if (!__DEV__) return;
    const elapsedSeconds = ((Date.now() - bootTime) / 1000).toFixed(2);
    console.log(`[${elapsedSeconds}s] ${tag}`, ...args);
}
