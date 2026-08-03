// Lightweight timestamped debug logger. Built specifically for tracing the
// booking/cancel refresh bug — Metro doesn't timestamp console.log by
// default, which makes it hard to reconstruct the exact order and timing
// of events (a user tapping "Book", a WebView's navigation events, a
// scrape result arriving) when they're logged from several different
// files. Every call is prefixed with elapsed seconds since app launch so
// lines from different files can be lined up chronologically afterward.
//
// Gated by __DEV__ so none of this ships to a production/TestFlight build.
const bootTime = Date.now();

export function debugLog(tag: string, ...args: unknown[]) {
    if (!__DEV__) return;
    const elapsedSeconds = ((Date.now() - bootTime) / 1000).toFixed(2);
    console.log(`[${elapsedSeconds}s] ${tag}`, ...args);
}
