/**
 * Runs in the ISOLATED world, where chrome.* is available but the page's own
 * fetch is not. The capture scripts run in the MAIN world, where it is the
 * other way round. Nothing is shared between the two but the DOM, so settings
 * cross on an attribute and requests cross as events.
 */
const DEFAULTS = {
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1Yk2vMgJEQEidZ0D7EjQMZcRDXwaMghtTQhEMvsOCpsE/edit?gid=808635128#gid=808635128',
    sheetSameTab: false,
    deriveAvatar: true,
    nativeAsUcid: true
};

function publish(config) {
    const write = () => {
        try {
            document.documentElement.setAttribute('data-xcap-config', JSON.stringify(config));
            document.dispatchEvent(new Event('xcap:config'));
        } catch (e) { /* page torn down mid-write */ }
    };
    // at document_start the root element is normally there already, but the
    // storage read is async and may land either side of it
    if (document.documentElement) write();
    else document.addEventListener('DOMContentLoaded', write, { once: true });
}

chrome.storage.local.get(DEFAULTS, publish);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') chrome.storage.local.get(DEFAULTS, publish);
});

chrome.runtime.onMessage.addListener(message => {
    if (message && message.type === 'xcap:show') {
        document.dispatchEvent(new Event('xcap:show'));
    }
    if (message && message.type === 'xcap:net' && message.url) {
        document.dispatchEvent(new CustomEvent('xcap:net', { detail: message.url }));
    }
});
