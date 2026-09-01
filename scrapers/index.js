const { assembleAndWatermarkPdf } = require('../services/pdfAssembler');
const path = require('path');
const fs = require('fs');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/'
};

function isJpeg(buf) {
    return buf && buf.length > 4 && buf[0] === 0xFF && buf[1] === 0xD8;
}

function isPng(buf) {
    return buf && buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
}

async function fetchBufferDirect(url) {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
}

/**
 * 1. The News International
 */
async function fetchTheNews(editionKey, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cityName = { 'karachi': 'Karachi', 'lahore': 'Lahore', 'pindi': 'Islamabad' }[editionKey] || editionKey;
    const outputFilename = `${formatted} The News ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`The News (${cityName}): Checking available sources...`);

    // Check direct PDF (Available for Karachi and select editions)
    const directPdfUrl = `https://e.thenews.pk/static_pages/${month}-${day}-${year}/${editionKey}/thenews.pdf`;
    try {
        const res = await fetch(directPdfUrl, { headers: BROWSER_HEADERS });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('pdf')) {
            log(`The News (${cityName}): Direct PDF found. Downloading...`);
            const arrayBuf = await res.arrayBuffer();
            const pdfBuf = Buffer.from(arrayBuf);
            if (pdfBuf.slice(0, 5).toString() === '%PDF-') {
                return await assembleAndWatermarkPdf(pdfBuf, {
                    newspaperName: 'The News',
                    editionName: cityName,
                    dateFormatted: formatted,
                    outputPath
                }, config);
            }
        }
    } catch (_) {}

    // Fallback to high-res JPG pages
    log(`The News (${cityName}): Downloading broadsheet pages...`);
    const pageBuffers = [];
    for (let p = 1; p <= 16; p++) {
        const pageUrl = `https://e.thenews.pk/static_pages/${month}-${day}-${year}/${editionKey}/mainpage/page${p}.jpg`;
        try {
            const buf = await fetchBufferDirect(pageUrl);
            if (isJpeg(buf) || isPng(buf)) {
                pageBuffers.push(buf);
                log(`The News (${cityName}): Page ${p} downloaded.`);
            } else {
                if (p === 1) throw new Error(`Pages for ${cityName} not found for ${formatted}`);
                break;
            }
        } catch (err) {
            if (p === 1) throw err;
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`The News ${cityName} pages not available for ${formatted}.`);
    }

    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'The News',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 2. Daily Jang
 */
async function fetchDailyJang(editionKey, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cityMap = {
        'lahore': 'Lahore',
        'karachi': 'Karachi',
        'rawalpindi': 'Rawalpindi',
        'multan': 'Multan',
        'quetta': 'Quetta'
    };
    const cityName = cityMap[editionKey] || editionKey.toUpperCase();
    const outputFilename = `${formatted} Daily Jang ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Jang (${cityName}): Downloading broadsheet pages...`);
    const pageBuffers = [];

    for (let p = 1; p <= 16; p++) {
        const pageUrl = `https://e.jang.com.pk/static_pages/${month}-${day}-${year}/${editionKey}/mainpage/page${p}.jpg`;
        try {
            const buf = await fetchBufferDirect(pageUrl);
            if ((isJpeg(buf) || isPng(buf)) && buf.length > 50000) {
                pageBuffers.push(buf);
                log(`Daily Jang (${cityName}): Page ${p} downloaded.`);
            }
        } catch (_) {}
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Daily Jang ${cityName} pages not available for ${formatted}.`);
    }

    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Jang',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 3. Pakistan Observer
 */
async function fetchPakistanObserver(dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${formatted} Pakistan Observer.pdf`;
    const outputPath = path.join(outputDir, outputFilename);
    const dateFormattedYMD = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    log(`Pakistan Observer: Scraping pages for ${dateFormattedYMD}...`);
    const epaperHome = 'https://epaper.pakobserver.net/';
    const res = await fetch(epaperHome, { headers: BROWSER_HEADERS });
    const html = await res.text();

    const matches = html.match(new RegExp(`issues/(?:${year}/)?${dateFormattedYMD}/[0-9]+-full\\.jpg`, 'g')) || [];
    const uniquePages = [...new Set(matches)];

    if (uniquePages.length === 0) {
        const fallbackMatches = html.match(/issues\/[0-9/-]+-full\.jpg/g) || [];
        uniquePages.push(...new Set(fallbackMatches));
    }

    if (uniquePages.length === 0) {
        throw new Error('No broadsheet pages found on Pakistan Observer for this date.');
    }

    log(`Pakistan Observer: Found ${uniquePages.length} pages. Downloading...`);
    const pageBuffers = [];
    for (let i = 0; i < uniquePages.length; i++) {
        const pageUrl = `https://epaper.pakobserver.net/${uniquePages[i]}`;
        const buf = await fetchBufferDirect(pageUrl);
        if (isJpeg(buf) || isPng(buf)) {
            pageBuffers.push(buf);
            log(`Pakistan Observer: Page ${i + 1}/${uniquePages.length} downloaded.`);
        }
    }

    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Pakistan Observer',
        editionName: '',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 4. Daily Lead Pakistan
 */
async function fetchLeadPakistan(dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${formatted} Daily Lead Pakistan.pdf`;
    const outputPath = path.join(outputDir, outputFilename);
    const monthPad = String(month).padStart(2, '0');
    const dayPad = String(day).padStart(2, '0');

    log(`Daily Lead Pakistan: Fetching pages for ${dayPad}-${monthPad}-${year}...`);
    const pageBuffers = [];

    for (let p = 1; p <= 16; p++) {
        const urlsToTry = [
            `https://leadpakistan.com.pk/ep/${year}${monthPad}/${dayPad}/pages/Page${p}.jpg`,
            `https://leadpakistan.com.pk/ep/${year}${monthPad}/${dayPad}/small/small_Page${p}.jpg`
        ];

        let loaded = false;
        for (const u of urlsToTry) {
            try {
                const buf = await fetchBufferDirect(u);
                if (isJpeg(buf) || isPng(buf)) {
                    pageBuffers.push(buf);
                    log(`Daily Lead Pakistan: Page ${p} downloaded.`);
                    loaded = true;
                    break;
                }
            } catch (_) {}
        }
        if (!loaded && p > 4) break;
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Daily Lead Pakistan pages not available for ${formatted}.`);
    }

    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Lead Pakistan',
        editionName: '',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 5. Daily Ausaf
 */
async function fetchDailyAusaf(editionKey, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${formatted} Daily Ausaf ${editionKey.toUpperCase()}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);
    const dateYMD = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    log(`Daily Ausaf: Fetching edition for ${dateYMD}...`);
    const res = await fetch('https://epaper.dailyausaf.com/', { headers: BROWSER_HEADERS });
    const html = await res.text();

    const matches = html.match(new RegExp(`issues/${dateYMD}/[0-9]+-full\\.jpg`, 'g')) || [];
    const uniquePages = [...new Set(matches)];

    if (uniquePages.length === 0) {
        const fallbackMatches = html.match(/issues\/[0-9/-]+-full\.jpg/g) || [];
        uniquePages.push(...new Set(fallbackMatches));
    }

    if (uniquePages.length === 0) {
        throw new Error(`Daily Ausaf pages not found for ${formatted}.`);
    }

    log(`Daily Ausaf: Found ${uniquePages.length} pages. Downloading...`);
    const pageBuffers = [];
    for (let i = 0; i < uniquePages.length; i++) {
        const pageUrl = `https://epaper.dailyausaf.com/${uniquePages[i]}`;
        const buf = await fetchBufferDirect(pageUrl);
        if (isJpeg(buf) || isPng(buf)) {
            pageBuffers.push(buf);
            log(`Daily Ausaf: Page ${i + 1}/${uniquePages.length} downloaded.`);
        }
    }

    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Ausaf',
        editionName: editionKey.toUpperCase(),
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 6. Daily Express
 */
async function fetchDailyExpress(editionKey, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const issueCode = {
        'isb': 'NP_ISB',
        'lhr': 'NP_LHE',
        'khi': 'NP_KHI',
        'pesh': 'NP_PEW'
    }[editionKey] || 'NP_ISB';

    const cityName = {
        'isb': 'Islamabad',
        'lhr': 'Lahore',
        'khi': 'Karachi',
        'pesh': 'Peshawar'
    }[editionKey] || editionKey.toUpperCase();

    const outputFilename = `${formatted} Daily Express ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);
    const dateFormattedYMD = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;

    log(`Daily Express (${cityName}): Fetching broadsheet pages...`);
    const pageBuffers = [];

    for (let p = 1; p <= 16; p++) {
        const pageUrl = `https://www.express.com.pk/epaper/Index.aspx?Issue=${issueCode}&Date=${dateFormattedYMD}&Pageno=${p}`;
        try {
            const res = await fetch(pageUrl, { headers: BROWSER_HEADERS });
            if (!res.ok) break;
            const html = await res.text();
            
            const imgMatch = html.match(/id=["']?NewsImage["']?[^>]+src=["']?([^"'\s>]+)/i) ||
                             html.match(/src=["']([^"']+\/images\/[^"']+)["']/i);
            
            if (imgMatch) {
                let imgUrl = imgMatch[1];
                if (!imgUrl.startsWith('http')) {
                    imgUrl = `https://www.express.com.pk${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
                }
                const buf = await fetchBufferDirect(imgUrl);
                if (isJpeg(buf) || isPng(buf)) {
                    pageBuffers.push(buf);
                    log(`Daily Express (${cityName}): Page ${p} downloaded.`);
                }
            } else {
                if (p === 1) throw new Error(`Daily Express ${cityName} not found for ${formatted}`);
                break;
            }
        } catch (err) {
            if (p === 1) throw err;
            break;
        }
    }

    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Express',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 7. Daily Aaj
 */
async function fetchDailyAaj(dateObj, outputDir, config, log) {
    const { formatted } = dateObj;
    const outputFilename = `${formatted} Daily Aaj Peshawar.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Aaj: Fetching pages...`);
    const res = await fetch('https://dailyaaj.com.pk/', { headers: BROWSER_HEADERS });
    const html = await res.text();

    const matches = html.match(/src=["']([^"']+\/uploads\/(?:thumb\/)?[a-f0-9]+\.jpg)["']/gi) || [];
    const fullUrls = [...new Set(matches.map(m => {
        const raw = m.match(/src=["']([^"']+)["']/i)[1];
        return raw.replace('/thumb/', '/').replace('./uploads', 'uploads');
    }))].slice(0, 12);

    if (fullUrls.length === 0) {
        throw new Error(`Daily Aaj pages not available for ${formatted}.`);
    }

    log(`Daily Aaj: Found ${fullUrls.length} pages. Downloading...`);
    const pageBuffers = [];
    for (let i = 0; i < fullUrls.length; i++) {
        let u = fullUrls[i];
        if (!u.startsWith('http')) u = `https://dailyaaj.com.pk/${u}`;
        try {
            const buf = await fetchBufferDirect(u);
            if ((isJpeg(buf) || isPng(buf)) && buf.length > 30000) {
                pageBuffers.push(buf);
                log(`Daily Aaj: Page ${pageBuffers.length} downloaded.`);
            }
        } catch (_) {}
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Daily Aaj pages could not be loaded.`);
    }

    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Aaj',
        editionName: 'Peshawar',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 8. Daily Ibrat (Sindhi)
 */
async function fetchDailyIbrat(dateObj, outputDir, config, log) {
    const { formatted } = dateObj;
    const outputFilename = `${formatted} Daily Ibrat Hyderabad.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Ibrat: Fetching Sindhi Daily pages...`);
    const res = await fetch('https://dailyibrat.com/news/', { headers: BROWSER_HEADERS });
    const html = await res.text();

    const matches = html.match(/src=["'](https:\/\/dailyibrat\.com\/news\/wp-content\/uploads\/[^"']+\.jpg)["']/gi) || [];
    const unique = [...new Set(matches.map(m => m.match(/src=["']([^"']+)["']/i)[1]))].slice(0, 8);

    if (unique.length === 0) {
        throw new Error(`Daily Ibrat pages not found for ${formatted}.`);
    }

    log(`Daily Ibrat: Downloading ${unique.length} pages...`);
    const pageBuffers = [];
    for (let i = 0; i < unique.length; i++) {
        try {
            const buf = await fetchBufferDirect(unique[i]);
            if (isJpeg(buf) || isPng(buf)) {
                pageBuffers.push(buf);
                log(`Daily Ibrat: Page ${i + 1}/${unique.length} downloaded.`);
            }
        } catch (_) {}
    }

    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Ibrat',
        editionName: 'Sindh',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * Complete Master Catalog of Pakistani Newspapers
 */
const NEWSPAPER_CATALOG = [
    // English Dailies
    { id: 'thenews_khi', name: 'The News International (Karachi)', category: 'english', handler: (d, out, cfg, l) => fetchTheNews('karachi', d, out, cfg, l) },
    { id: 'thenews_lhr', name: 'The News International (Lahore)', category: 'english', handler: (d, out, cfg, l) => fetchTheNews('lahore', d, out, cfg, l) },
    { id: 'thenews_isb', name: 'The News International (Islamabad)', category: 'english', handler: (d, out, cfg, l) => fetchTheNews('pindi', d, out, cfg, l) },
    { id: 'pak_observer', name: 'Pakistan Observer', category: 'english', handler: (d, out, cfg, l) => fetchPakistanObserver(d, out, cfg, l) },
    { id: 'lead_pakistan', name: 'Daily Lead Pakistan', category: 'english', handler: (d, out, cfg, l) => fetchLeadPakistan(d, out, cfg, l) },

    // Urdu Dailies
    { id: 'jang_lhr', name: 'Daily Jang (Lahore)', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyJang('lahore', d, out, cfg, l) },
    { id: 'jang_khi', name: 'Daily Jang (Karachi)', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyJang('karachi', d, out, cfg, l) },
    { id: 'jang_rwp', name: 'Daily Jang (Rawalpindi)', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyJang('rawalpindi', d, out, cfg, l) },
    { id: 'express_isb', name: 'Daily Express (Islamabad)', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyExpress('isb', d, out, cfg, l) },
    { id: 'express_lhr', name: 'Daily Express (Lahore)', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyExpress('lhr', d, out, cfg, l) },
    { id: 'ausaf_isb', name: 'Daily Ausaf (Islamabad)', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('isb', d, out, cfg, l) },
    { id: 'dailyaaj_pesh', name: 'Daily Aaj (Peshawar)', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAaj(d, out, cfg, l) },

    // Regional & Sindhi
    { id: 'ibrat_hyd', name: 'Daily Ibrat (Sindhi)', category: 'regional', handler: (d, out, cfg, l) => fetchDailyIbrat(d, out, cfg, l) }
];

module.exports = {
    NEWSPAPER_CATALOG,
    fetchTheNews,
    fetchDailyJang,
    fetchPakistanObserver,
    fetchLeadPakistan,
    fetchDailyAusaf,
    fetchDailyExpress,
    fetchDailyAaj,
    fetchDailyIbrat
};
