/**
 * Observe DexScreener chart traffic, including fetches from Web Workers.
 * MAIN-world fetch wrapping never sees those; the network stack does.
 */
const FILTER = {
    urls: [
        "https://io.dexscreener.com/*",
        "https://*.dexscreener.com/*"
    ]
};

chrome.webRequest.onBeforeRequest.addListener((details) => {
    if (details.tabId < 0 || !details.url) return;
    chrome.tabs.sendMessage(details.tabId, { type: "xcap:net", url: details.url }, () => {
        void chrome.runtime.lastError;
    });
}, FILTER);
