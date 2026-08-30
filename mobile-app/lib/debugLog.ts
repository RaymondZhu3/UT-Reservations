// Timestamped debug logger. Metro does not timestamp console.log, which makes
// it hard to reconstruct the order of events logged from different files — a
// tap, a WebView navigation, a scrape result arriving. Every line carries
// elapsed seconds since launch so they can be lined up chronologically.
//
// __DEV__-gated, so nothing here reaches a TestFlight or production build.
const bootTime = Date.now();

export function debugLog(tag: string, ...args: unknown[]) {
    if (!__DEV__) return;
    const elapsedSeconds = ((Date.now() - bootTime) / 1000).toFixed(2);
    console.log(`[${elapsedSeconds}s] ${tag}`, ...args);
}
