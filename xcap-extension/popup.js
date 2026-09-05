// Lucide icons (ISC), inlined - MV3 forbids remote code, so there is no
// stylesheet or sprite to pull in.
const ICONS = {
    sheet: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>'
        + '<line x1="3" x2="21" y1="9" y2="9"/><line x1="3" x2="21" y1="15" y2="15"/>'
        + '<line x1="9" x2="9" y1="9" y2="21"/><line x1="15" x2="15" y1="9" y2="21"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>'
        + '<polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>'
        + '<path d="M12 9v4"/><path d="M12 17h.01"/>'
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function icon(name, size, width) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', width || 2);
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = ICONS[name];
    return svg;
}

// The app's mark - the same blade the web header draws, bare rather than on
// the icon's rounded ground: the popup is already dark, so a ground behind
// it would only be a square nobody can see the edges of.
function mark() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 128 128');
    svg.setAttribute('width', '26');
    svg.setAttribute('height', '26');
    svg.innerHTML =
        '<path fill="#f5f5f7" stroke="#f5f5f7" stroke-width="1.5" '
        + 'stroke-linejoin="round" d="M103.6 24.4 L82 64 L103.6 103.6 L64 82 '
        + 'L24.4 103.6 L46 64 L24.4 24.4 L64 46 Z"/>';
    return svg;
}

document.getElementById('mark').appendChild(mark());
document.getElementById('i-sheet').appendChild(icon('sheet', 11));
document.getElementById('i-save').appendChild(icon('save', 13));
document.getElementById('i-show').appendChild(icon('eye', 13));
document.querySelectorAll('[data-check]').forEach(box => {
    box.appendChild(icon('check', 12, 3));
});

// popup.js also runs under tools/render.js, which has no chrome.* at all
if (typeof chrome === 'undefined' || !chrome.storage) {
    document.getElementById('sheetUrl').value = '';
    document.getElementById('deriveAvatar').checked = true;
    document.getElementById('nativeAsUcid').checked = true;
} else {
    start();
}

function start() {
    const DEFAULTS = {
        sheetUrl: '',
        sheetSameTab: false,
        deriveAvatar: true,
        nativeAsUcid: true
    };
    const TOGGLES = ['sheetSameTab', 'deriveAvatar', 'nativeAsUcid'];
    const statusBar = document.getElementById('status');

    function say(text, iconName) {
        statusBar.textContent = '';
        statusBar.appendChild(icon(iconName, 11));
        statusBar.appendChild(document.createTextNode(text));
        setTimeout(() => { statusBar.textContent = ''; }, 2400);
    }

    function flash(button) {
        button.classList.add('ok');
        setTimeout(() => button.classList.remove('ok'), 1200);
    }

    chrome.storage.local.get(DEFAULTS, config => {
        document.getElementById('sheetUrl').value = config.sheetUrl || '';
        TOGGLES.forEach(key => { document.getElementById(key).checked = !!config[key]; });
    });

    document.getElementById('save').addEventListener('click', event => {
        const config = { sheetUrl: document.getElementById('sheetUrl').value.trim() };
        TOGGLES.forEach(key => { config[key] = document.getElementById(key).checked; });

        chrome.storage.local.set(config, () => {
            if (chrome.runtime.lastError) { say('Save failed', 'alert'); return; }
            // an open tab picks this up through storage.onChanged, so a page
            // already loaded does not need reloading
            flash(event.currentTarget);
            say('Saved — applies to open tabs', 'check');
        });
    });

    document.getElementById('show').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        // fails on any tab the extension does not run in, which is most of them
        chrome.tabs.sendMessage(tab.id, { type: 'xcap:show' }, () => {
            if (chrome.runtime.lastError) say('Not a supported page', 'alert');
            else say('Scan started', 'check');
        });
    });
}
