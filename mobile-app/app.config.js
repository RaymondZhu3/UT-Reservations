// Dynamic layer on top of app.json — app.json stays the source of truth and
// is passed in here already parsed, so nothing has to be migrated or kept in
// sync by hand.
//
// WHY THIS EXISTS: the development build and the production/TestFlight build
// both used bundle identifier com.rz9.UTReservations, so installing one
// replaced the other on the device. Installing TestFlight build #1 silently
// removed the dev client, and every subsequent "test" ran build #1's compiled
// JS — a staleness fix appeared not to work for an afternoon because the code
// under test was never on the phone. Same shape as the .reload() bug in
// context.md §6: the thing being acted on was not the thing it appeared to be.
//
// Note `slug` and `owner` are deliberately NOT touched. They identify the EAS
// *project*; bundleIdentifier identifies the app to *Apple*. Separate
// namespaces — one EAS project can build several bundle identifiers.
//
// APP_VARIANT is set by eas.json's development profile. If it ever leaked
// into a production build, `eas submit` would reject the binary against the
// App Store Connect record — a loud failure at submit time, never a silent
// wrong-identity ship.
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
    ...config,
    name: IS_DEV ? 'UT Reserve (dev)' : config.name,
    // Varied too: two installed apps registering the same URL scheme means
    // iOS picks between them nondeterministically, so `expo start` could
    // open the wrong one.
    scheme: IS_DEV ? 'utreservations-dev' : config.scheme,
    ios: {
        ...config.ios,
        bundleIdentifier: IS_DEV
            ? 'com.rz9.UTReservations.dev'
            : config.ios.bundleIdentifier,
    },
});
