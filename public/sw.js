// Minimal service worker - its only job is to exist and respond to fetches,
// which is what Chrome/Android require before showing the "Install App"
// prompt. It doesn't cache anything or work offline on purpose - the site
// relies on live blockchain data, so serving a stale cached version would
// be misleading (e.g. showing sold-out stock as available).
self.addEventListener('fetch', () => {});