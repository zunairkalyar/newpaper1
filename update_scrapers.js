const fs = require('fs');

const code = `const path = require('path');
const fs = require('fs');
const { assembleAndWatermarkPdf } = require('../services/pdfAssembler');

// Validation helper functions
function isValidImage(buf) {
    if (!buf || buf.length < 5000) return false;
    // JPEG: FF D8 FF
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
    // PNG: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
    // WebP: RIFF ... WEBP
    if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true;
    return false;
}

function isJpeg(buf) {
    return buf && buf.length > 5000 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
}

async function fetchBufferDirect(url, customReferer, timeoutMs = 15000) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/jpeg,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
    };
    if (customReferer) {
        headers['Referer'] = customReferer;
    }
    const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) {
        throw new Error('HTTP ' + res.status + ' for ' + url);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * 1. Business Recorder (National)
 * Broadsheet Main + Regional City Pages (Lahore, Islamabad) + Financial Supplements
 */
async function fetchBusinessRecorder(dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = \`\${dateObj.fileDate} Business Recorder National.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`Business Recorder: Scraping all broadsheet pages and supplements for \${formatted}...\`);
    const pageBuffers = [];
    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yStr = String(year);

    // 1. Discover broadsheet page URLs from live homepage
    const discoveredUrls = new Set();
    try {
        const homeRes = await fetch('https://epaper.brecorder.com/', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(8000)
        });
        if (homeRes.ok) {
            const html = await homeRes.text();
            const matches = html.match(/https?:\\/\\/[^\\s\"'<>]+image\\/papers\\/[^\\s\"'<>]+\\.jpg/gi) || [];
            for (const m of matches) {
                discoveredUrls.add(m.replace('/thumbs/', '/'));
            }
        }
    } catch (_) {}

    // 2. Comprehensive candidate list of all potential pages & regional inserts
    const candidateUrls = [];
    for (let p = 1; p <= 14; p++) {
        for (const suffix of ['', '_LHR', '_ISB']) {
            candidateUrls.push(\`https://e.brecorder.com/image/papers/\${yStr}/\${mStr}/\${dStr}/page_\${p}\${suffix}.jpg\`);
        }
    }
    for (const p of [91, 95, 96, 97, 98, 99]) {
        for (const suffix of ['', '_LHR', '_ISB']) {
            candidateUrls.push(\`https://e.brecorder.com/image/papers/\${yStr}/\${mStr}/\${dStr}/page_\${p}\${suffix}.jpg\`);
        }
    }

    const allUrls = Array.from(new Set([...discoveredUrls, ...candidateUrls]));
    const fetchedBuffers = new Map();

    // Concurrent probe
    const chunkSize = 6;
    for (let i = 0; i < allUrls.length; i += chunkSize) {
        const chunk = allUrls.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (url) => {
            try {
                const buf = await fetchBufferDirect(url, 'https://epaper.brecorder.com/', 4000);
                if (buf && buf.length > 15000 && isValidImage(buf)) {
                    fetchedBuffers.set(url, buf);
                }
            } catch (_) {}
        }));
    }

    for (const url of allUrls) {
        if (fetchedBuffers.has(url)) {
            const buf = fetchedBuffers.get(url);
            pageBuffers.push(buf);
            const pageName = url.split('/').pop();
            log(\`Business Recorder: [\${pageBuffers.length}] Downloaded \${pageName} (\${(buf.length / 1024).toFixed(0)} KB)\`);
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`Business Recorder: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`Business Recorder: Compiling \${pageBuffers.length} broadsheet pages into single comprehensive PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Business Recorder',
        editionName: 'National',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 2. Dawn (National / Karachi)
 * Broadsheet Main + Karachi Metro + Islamabad Metro + Lahore Metro + Supplements (All 28-29 pages)
 */
async function fetchDawn(editionKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = \`\${dateObj.fileDate} Dawn Karachi.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yStr = String(year);

    log(\`Dawn (National): Downloading all broadsheet sections (Main, Karachi, Isb, Lhr, Supplements) for \${formatted}...\`);

    const slots = [];
    for (let p = 1; p <= 25; p++) slots.push(p);
    for (let p = 90; p <= 99; p++) slots.push(p);
    for (let p = 113; p <= 125; p++) slots.push(p);
    for (let p = 150; p <= 165; p++) slots.push(p);
    for (let p = 175; p <= 190; p++) slots.push(p);

    const pageBuffersMap = new Map();
    const chunkSize = 8;

    for (let i = 0; i < slots.length; i += chunkSize) {
        const chunk = slots.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (slot) => {
            const pStr = String(slot).padStart(3, '0');
            const url = \`https://e.dawn.com/\${yStr}/\${mStr}/\${dStr}/pages/\${dStr}_\${mStr}_\${yStr}_\${pStr}.jpg\`;
            try {
                const buf = await fetchBufferDirect(url, 'https://e.dawn.com/', 3500);
                if (buf && buf.length > 20000 && isJpeg(buf)) {
                    pageBuffersMap.set(slot, buf);
                }
            } catch (_) {}
        }));
    }

    const pageBuffers = [];
    for (const slot of slots) {
        if (pageBuffersMap.has(slot)) {
            const buf = pageBuffersMap.get(slot);
            pageBuffers.push(buf);
            const sectionLabel = slot >= 175 ? 'Lahore Metro' : slot >= 150 ? 'Islamabad Metro' : slot >= 113 ? 'Karachi Metro' : slot >= 90 ? 'Supplement' : 'Main';
            log(\`Dawn: [\${pageBuffers.length}] Downloaded \${sectionLabel} Page \${slot} (\${(buf.length / 1024).toFixed(0)} KB).\`);
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`Dawn: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`Dawn: Compiling \${pageBuffers.length} broadsheet pages into single comprehensive PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Dawn',
        editionName: 'National (Karachi)',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 3. The Nation (Lahore, Islamabad, Karachi)
 */
async function fetchTheNation(editionKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Lahore';
    const outputFilename = \`\${dateObj.fileDate} The Nation \${cleanCity}.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`The Nation \${cleanCity}: Scraping authentic high-resolution broadsheet pages for \${formatted}...\`);
    const pageBuffers = [];
    const citySlug = editionKey === 'nation_isb' ? 'islamabad' : editionKey === 'nation_khi' ? 'karachi' : 'lahore';

    for (let p = 1; p <= 24; p++) {
        const pageUrl = \`https://nation.com.pk/epaper/\${citySlug}/\${year}-\${month}-\${day}/page-\${p}\`;
        try {
            const res = await fetch(pageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(12000)
            });
            if (!res.ok) break;
            const html = await res.text();
            const match = html.match(/src=[\"']([^\"']*epaper_img[^\"']*)[\"']/i) || html.match(/src=[\"']([^\"']*uploads\/[^\"']*)[\"']/i);
            if (!match) break;

            let imgUrl = match[1];
            if (!imgUrl.startsWith('http')) {
                imgUrl = 'https://nation.com.pk' + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
            }

            const buf = await fetchBufferDirect(imgUrl, 'https://nation.com.pk/');
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(\`The Nation \${cleanCity}: [\${pageBuffers.length}] Downloaded Page \${p} (\${(buf.length / 1024).toFixed(0)} KB)\`);
            } else {
                break;
            }
        } catch (e) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`The Nation \${cleanCity}: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`The Nation \${cleanCity}: Compiling \${pageBuffers.length} pages into PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'The Nation',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 4. The News (Karachi, Lahore, Islamabad)
 * All broadsheet pages + Supplements (33+ pages)
 */
async function fetchTheNews(editionKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Lahore';
    const outputFilename = \`\${dateObj.fileDate} The News \${cleanCity}.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`The News \${cleanCity}: Scraping broadsheet pages and supplements for \${formatted}...\`);
    const pageBuffers = [];
    const citySlug = editionKey === 'thenews_khi' ? 'karachi' : editionKey === 'thenews_isb' ? 'rawalpindi-islamabad' : 'lahore';
    const dInt = parseInt(day, 10);
    const mInt = parseInt(month, 10);

    // 1. Broadsheet main section (pages 1 to 18)
    for (let p = 1; p <= 18; p++) {
        const url = \`https://e.thenews.pk/static_pages/\${mInt}-\${dInt}-\${year}/\${citySlug}/mainpage/page\${p}.jpg\`;
        try {
            const buf = await fetchBufferDirect(url, 'https://e.thenews.pk/', 5000);
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(\`The News \${cleanCity}: [\${pageBuffers.length}] Downloaded Main Section Page \${p} (\${(buf.length / 1024).toFixed(0)} KB)\`);
            } else {
                break;
            }
        } catch (_) {
            break;
        }
    }

    // 2. City & Classified Supplements (us1 to us15)
    for (let p = 1; p <= 15; p++) {
        const url = \`https://e.thenews.pk/static_pages/\${mInt}-\${dInt}-\${year}/\${citySlug}/mainpage/us\${p}.jpg\`;
        try {
            const buf = await fetchBufferDirect(url, 'https://e.thenews.pk/', 4000);
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(\`The News \${cleanCity}: [\${pageBuffers.length}] Downloaded City Supplement Page \${p} (\${(buf.length / 1024).toFixed(0)} KB)\`);
            } else {
                break;
            }
        } catch (_) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`The News \${cleanCity}: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`The News \${cleanCity}: Compiling \${pageBuffers.length} broadsheet pages into single comprehensive PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'The News',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 5. Daily Lead Pakistan (National)
 */
async function fetchDailyLeadPakistan(dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = \`\${dateObj.fileDate} Daily Lead Pakistan National.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`Daily Lead Pakistan: Scraping authentic broadsheet pages for \${formatted}...\`);
    const pageBuffers = [];

    for (let p = 1; p <= 12; p++) {
        const pageUrl = \`https://epaper.dailylead.com.pk/page.php?date=\${year}-\${month}-\${day}&page=\${p}\`;
        try {
            const res = await fetch(pageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(12000)
            });
            if (!res.ok) break;
            const html = await res.text();
            const match = html.match(/src=[\"']([^\"']*epaper_img[^\"']*)[\"']/i) || html.match(/src=[\"']([^\"']*uploads\/[^\"']*)[\"']/i) || html.match(/src=[\"']([^\"']*pages\/[^\"']*)[\"']/i);
            if (!match) break;

            let imgUrl = match[1];
            if (!imgUrl.startsWith('http')) {
                imgUrl = 'https://epaper.dailylead.com.pk/' + imgUrl.replace(/^\\//, '');
            }

            const buf = await fetchBufferDirect(imgUrl, 'https://epaper.dailylead.com.pk/');
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(\`Daily Lead Pakistan: [\${pageBuffers.length}] Downloaded Page \${p} (\${(buf.length / 1024).toFixed(0)} KB)\`);
            } else {
                break;
            }
        } catch (e) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`Daily Lead Pakistan: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`Daily Lead Pakistan: Compiling \${pageBuffers.length} pages into PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Lead Pakistan',
        editionName: 'National',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 6. Pakistan Observer (Islamabad, Lahore, Karachi)
 */
async function fetchPakistanObserver(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Islamabad';
    const outputFilename = \`\${dateObj.fileDate} Pakistan Observer \${cleanCity}.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`Pakistan Observer \${cleanCity}: Scraping authentic broadsheet pages for \${formatted}...\`);
    const pageBuffers = [];
    const citySlug = stationKey === 'pak_observer_lhr' ? 'lahore' : stationKey === 'pak_observer_khi' ? 'karachi' : 'islamabad';

    for (let p = 1; p <= 16; p++) {
        const pageUrl = \`https://pakobserver.net/epaper/\${citySlug}/\${year}-\${month}-\${day}/page-\${p}\`;
        try {
            const res = await fetch(pageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(12000)
            });
            if (!res.ok) break;
            const html = await res.text();
            const match = html.match(/src=[\"']([^\"']*epaper_img[^\"']*)[\"']/i) || html.match(/src=[\"']([^\"']*uploads\/[^\"']*)[\"']/i);
            if (!match) break;

            let imgUrl = match[1];
            if (!imgUrl.startsWith('http')) {
                imgUrl = 'https://pakobserver.net' + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
            }

            const buf = await fetchBufferDirect(imgUrl, 'https://pakobserver.net/');
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(\`Pakistan Observer \${cleanCity}: [\${pageBuffers.length}] Downloaded Page \${p} (\${(buf.length / 1024).toFixed(0)} KB)\`);
            } else {
                break;
            }
        } catch (e) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`Pakistan Observer \${cleanCity}: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`Pakistan Observer \${cleanCity}: Compiling \${pageBuffers.length} pages into PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Pakistan Observer',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 7. Daily Times (Lahore, Islamabad, Karachi)
 */
async function fetchDailyTimes(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Lahore';
    const outputFilename = \`\${dateObj.fileDate} Daily Times \${cleanCity}.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`Daily Times \${cleanCity}: Scraping authentic broadsheet pages for \${formatted}...\`);
    const pageBuffers = [];

    for (let p = 1; p <= 12; p++) {
        const pageUrl = \`https://dailytimes.com.pk/epaper/\${stationKey}/\${year}-\${month}-\${day}/page-\${p}\`;
        try {
            const res = await fetch(pageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(12000)
            });
            if (!res.ok) break;
            const html = await res.text();
            const match = html.match(/src=[\"']([^\"']*epaper_img[^\"']*)[\"']/i) || html.match(/src=[\"']([^\"']*uploads\/[^\"']*)[\"']/i);
            if (!match) break;

            let imgUrl = match[1];
            if (!imgUrl.startsWith('http')) {
                imgUrl = 'https://dailytimes.com.pk' + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
            }

            const buf = await fetchBufferDirect(imgUrl, 'https://dailytimes.com.pk/');
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(\`Daily Times \${cleanCity}: [\${pageBuffers.length}] Downloaded Page \${p} (\${(buf.length / 1024).toFixed(0)} KB)\`);
            } else {
                break;
            }
        } catch (e) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`Daily Times \${cleanCity}: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`Daily Times \${cleanCity}: Compiling \${pageBuffers.length} pages into PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Times',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 8. The Express Tribune (National)
 */
async function fetchExpressTribune(editionName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = \`\${dateObj.fileDate} The Express Tribune National.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`The Express Tribune: Scraping authentic broadsheet pages for \${formatted}...\`);
    const pageBuffers = [];

    for (let p = 1; p <= 16; p++) {
        const pageUrl = \`https://tribune.com.pk/epaper/\${year}-\${month}-\${day}/page-\${p}\`;
        try {
            const res = await fetch(pageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(12000)
            });
            if (!res.ok) break;
            const html = await res.text();
            const match = html.match(/src=[\"']([^\"']*epaper_img[^\"']*)[\"']/i) || html.match(/src=[\"']([^\"']*uploads\/[^\"']*)[\"']/i);
            if (!match) break;

            let imgUrl = match[1];
            if (!imgUrl.startsWith('http')) {
                imgUrl = 'https://tribune.com.pk' + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
            }

            const buf = await fetchBufferDirect(imgUrl, 'https://tribune.com.pk/');
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(\`The Express Tribune: [\${pageBuffers.length}] Downloaded Page \${p} (\${(buf.length / 1024).toFixed(0)} KB)\`);
            } else {
                break;
            }
        } catch (e) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`The Express Tribune: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`The Express Tribune: Compiling \${pageBuffers.length} pages into PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'The Express Tribune',
        editionName: 'National',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 9. Daily Juraat (Karachi, Hyderabad)
 */
async function fetchDailyJuraat(editionKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = \`\${dateObj.fileDate} Daily Juraat \${cityName}.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`Daily Juraat \${cityName}: Scraping broadsheet pages for \${formatted}...\`);
    const pageBuffers = [];
    const cityParam = editionKey === 'juraat_hyd' ? 'hyd' : 'khi';
    const seenUrls = new Set();

    for (let p = 1; p <= 12; p++) {
        const url = \`https://e.juraat.com/?date=\${year}/\${month}/\${day}&city=\${cityParam}&pgNo=\${p}\`;
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(8000)
            });
            if (!res.ok) break;
            const html = await res.text();
            const match = html.match(/src=[\"']([^\"']*uploads\/[^\"']*\.(?:jpg|jpeg|png|webp))[\"']/i) || html.match(/src=[\"']([^\"']*page-[0-9]+\.(?:jpg|jpeg|png|webp))[\"']/i);
            if (!match) break;

            let imgUrl = match[1];
            if (!imgUrl.startsWith('http')) {
                imgUrl = 'https://e.juraat.com' + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
            }

            if (seenUrls.has(imgUrl)) break;
            seenUrls.add(imgUrl);

            const buf = await fetchBufferDirect(imgUrl, 'https://e.juraat.com/');
            if (buf && buf.length > 15000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(\`Daily Juraat \${cityName}: [\${pageBuffers.length}] Downloaded Page \${p} (\${(buf.length / 1024).toFixed(0)} KB)\`);
            } else {
                break;
            }
        } catch (_) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`Daily Juraat \${cityName}: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`Daily Juraat \${cityName}: Compiling \${pageBuffers.length} pages into PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Juraat',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 10. Daily Ausaf (Islamabad, Lahore, Karachi, Muzaffarabad)
 */
async function fetchDailyAusaf(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Islamabad';
    const outputFilename = \`\${dateObj.fileDate} Daily Ausaf \${cleanCity}.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`Daily Ausaf \${cleanCity}: Scraping authentic broadsheet pages for \${formatted}...\`);
    const pageBuffers = [];
    const stationIdMap = {
        'islamabad': 1,
        'lahore': 2,
        'karachi': 3,
        'muzaffarabad': 4
    };
    const sid = stationIdMap[stationKey] || 1;
    const stationUrl = sid === 1 ? 'https://epaper.dailyausaf.com/page' : \`https://epaper.dailyausaf.com/page?station_id=\${sid}\`;

    try {
        const res = await fetch(stationUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(12000)
        });
        if (res.ok) {
            const html = await res.text();
            const matches = html.match(/src=[\"']([^\"']*issues\/[^\"']*)[\"']/gi) || [];
            const pageUrls = [];
            for (const m of matches) {
                const srcMatch = m.match(/src=[\"']([^\"']+)[\"']/i);
                if (srcMatch) {
                    let u = srcMatch[1].replace('-thumb.jpg', '-full.jpg');
                    if (!u.startsWith('http')) {
                        u = 'https://epaper.dailyausaf.com/' + u.replace(/^\\//, '');
                    }
                    if (!pageUrls.includes(u)) pageUrls.push(u);
                }
            }

            for (const imgUrl of pageUrls) {
                try {
                    const buf = await fetchBufferDirect(imgUrl, 'https://epaper.dailyausaf.com/', 6000);
                    if (buf && buf.length > 20000 && isValidImage(buf)) {
                        pageBuffers.push(buf);
                        log(\`Daily Ausaf \${cleanCity}: [\${pageBuffers.length}] Downloaded Page (\${(buf.length / 1024).toFixed(0)} KB)\`);
                    }
                } catch (_) {}
            }
        }
    } catch (e) {
        log(\`Daily Ausaf \${cleanCity} fetch note: \${e.message}\`);
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`Daily Ausaf \${cleanCity}: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`Daily Ausaf \${cleanCity}: Compiling \${pageBuffers.length} pages into PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Ausaf',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 11. Daily Aaj (Peshawar, Abbottabad)
 */
async function fetchDailyAaj(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Peshawar';
    const outputFilename = `\\${dateObj.fileDate} Daily Aaj \\${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Aaj \\${cleanCity}: Scraping authentic broadsheet pages for \\${formatted}...`);
    const typeVal = stationKey === 'abbottabad' ? 'abbotabad' : 'peshawar';

    // Step 1: Extract dynamic page options from <select name="epaperpage">
    let pageIds = ['1', '16', '17', '18', '20', '22', '26'];
    try {
        const initForm = new URLSearchParams();
        initForm.append('epapertype', typeVal);
        initForm.append('epaperpage', '1');
        initForm.append('dated', `\\${year}-\\${month}-\\${day}`);

        const initRes = await fetch('https://epaper.dailyaaj.com.pk/main/epaper', {
            method: 'POST',
            body: initForm,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            signal: AbortSignal.timeout(8000)
        });
        if (initRes.ok) {
            const initHtml = await initRes.text();
            const optionMatches = [...initHtml.matchAll(/<option[^>]*value=["'](\\\\d+)["'][^>]*>/gi)];
            if (optionMatches.length > 0) {
                pageIds = optionMatches.map(m => m[1]);
            }
        }
    } catch (_) {}

    const pageBuffers = [];
    const seenImages = new Set();

    for (const pVal of pageIds) {
        try {
            const formData = new URLSearchParams();
            formData.append('epapertype', typeVal);
            formData.append('epaperpage', pVal);
            formData.append('dated', `\\${year}-\\${month}-\\${day}`);

            const res = await fetch('https://epaper.dailyaaj.com.pk/main/epaper', {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                signal: AbortSignal.timeout(8000)
            });

            if (res.ok) {
                const html = await res.text();
                const m = html.match(/src=["']([^"']*epaper[^"']*\.jpg)["']/i);
                if (m) {
                    let imgUrl = m[1];
                    if (!imgUrl.startsWith('http')) {
                        imgUrl = 'https://epaper.dailyaaj.com.pk/' + imgUrl.replace(/^\\.\\//, '').replace(/^\\//, '');
                    }
                    if (imgUrl.includes('/pages/') || imgUrl.includes('placeholder')) {
                        continue;
                    }
                    if (!seenImages.has(imgUrl)) {
                        seenImages.add(imgUrl);
                        const buf = await fetchBufferDirect(imgUrl, 'https://epaper.dailyaaj.com.pk/');
                        if (buf && buf.length > 20000 && isValidImage(buf)) {
                            pageBuffers.push(buf);
                            log(`Daily Aaj \\${cleanCity}: [\\${pageBuffers.length}] Downloaded Page \\${pVal} (\\${(buf.length / 1024).toFixed(0)} KB)`);
                        }
                    }
                }
            }
        } catch (_) {}
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Daily Aaj \\${cleanCity}: No broadsheet pages found for \\${formatted}.`);
    }

    log(`Daily Aaj \\${cleanCity}: Compiling \\${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Aaj',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 12. Nai Baat (Lahore, Islamabad, Karachi, Peshawar, Quetta, Sargodha, Faisalabad)
 */
async function fetchNaiBaat(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Lahore';
    const outputFilename = \`\${dateObj.fileDate} Nai Baat \${cleanCity}.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`Nai Baat \${cleanCity}: Scraping authentic broadsheet pages for \${formatted}...\`);
    const pageBuffers = [];

    for (let p = 1; p <= 12; p++) {
        const pageUrl = \`https://www.naibaat.pk/E-Paper/\${stationKey}/\${year}-\${month}-\${day}/page-\${p}\`;
        try {
            const res = await fetch(pageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(8000)
            });
            if (!res.ok) break;
            const html = await res.text();
            const match = html.match(/src=[\"']([^\"']*epaper_image[^\"']*)[\"']/i) || html.match(/src=[\"']([^\"']*epaper-[0-9]+[^\"']*)[\"']/i);
            if (!match) break;

            let imgUrl = match[1].replace('/medium/', '/large/');
            if (!imgUrl.startsWith('http')) {
                imgUrl = 'https://www.naibaat.pk' + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
            }

            const buf = await fetchBufferDirect(imgUrl, 'https://www.naibaat.pk/');
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(\`Nai Baat \${cleanCity}: [\${pageBuffers.length}] Downloaded Page \${p} (\${(buf.length / 1024).toFixed(0)} KB)\`);
            } else {
                break;
            }
        } catch (_) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`Nai Baat \${cleanCity}: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`Nai Baat \${cleanCity}: Compiling \${pageBuffers.length} pages into PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Nai Baat',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 13. Daily Jasarat (Karachi, Islamabad, Hyderabad)
 */
async function fetchDailyJasarat(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Karachi';
    const outputFilename = \`\${dateObj.fileDate} Daily Jasarat \${cleanCity}.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`Daily Jasarat \${cleanCity}: Scraping broadsheet pages for \${formatted}...\`);
    const pageBuffers = [];

    for (let p = 1; p <= 12; p++) {
        const pageUrl = \`https://www.jasarat.com/epaper/page.php?date=\${year}-\${month}-\${day}&edition=\${stationKey}&page=\${p}\`;
        try {
            const res = await fetch(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                signal: AbortSignal.timeout(8000)
            });
            if (!res.ok) break;
            const html = await res.text();
            const match = html.match(/src=[\"']([^\"']*epaper_img[^\"']*)[\"']/i) || html.match(/src=[\"']([^\"']*uploads\/[^\"']*)[\"']/i) || html.match(/src=[\"']([^\"']*page_\\d+\\.jpg)[\"']/i);
            if (!match) break;

            let imgUrl = match[1];
            if (!imgUrl.startsWith('http')) {
                imgUrl = 'https://www.jasarat.com/epaper/' + imgUrl.replace(/^\\//, '');
            }

            const buf = await fetchBufferDirect(imgUrl, 'https://www.jasarat.com/');
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(\`Daily Jasarat \${cleanCity}: [\${pageBuffers.length}] Downloaded Page \${p} (\${(buf.length / 1024).toFixed(0)} KB)\`);
            } else {
                break;
            }
        } catch (_) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`Daily Jasarat \${cleanCity}: No broadsheet pages found for \${formatted}.\`);
    }

    log(\`Daily Jasarat \${cleanCity}: Compiling \${pageBuffers.length} pages into PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Jasarat',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 14. Daily Job Ads (National Classifieds)
 * Dawn Classifieds + The News Classifieds broadsheet pages
 */
async function fetchJobAds(dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = \`\${dateObj.fileDate} Daily Job Ads Pakistan.pdf\`;
    const outputPath = path.join(outputDir, outputFilename);

    log(\`Daily Job Ads: Scraping authentic classified newspaper broadsheets for \${formatted}...\`);
    const pageBuffers = [];
    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yStr = String(year);
    const dInt = parseInt(day, 10);
    const mInt = parseInt(month, 10);

    // 1. Dawn Classifieds broadsheet pages
    for (const p of ['019', '020', '021']) {
        const url = \`https://e.dawn.com/\${yStr}/\${mStr}/\${dStr}/pages/\${dStr}_\${mStr}_\${yStr}_\${p}.jpg\`;
        try {
            const buf = await fetchBufferDirect(url, 'https://e.dawn.com/', 4000);
            if (buf && buf.length > 20000 && isJpeg(buf)) {
                pageBuffers.push(buf);
                log(\`Daily Job Ads: [\${pageBuffers.length}] Downloaded Dawn Classifieds Page \${p} (\${(buf.length / 1024).toFixed(0)} KB).\`);
            }
        } catch (_) {}
    }

    // 2. The News Classifieds / Career broadsheet pages (us1 to us10)
    for (let p = 1; p <= 10; p++) {
        const url = \`https://e.thenews.pk/static_pages/\${mInt}-\${dInt}-\${year}/lahore/mainpage/us\${p}.jpg\`;
        try {
            const buf = await fetchBufferDirect(url, 'https://e.thenews.pk/', 4000);
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(\`Daily Job Ads: [\${pageBuffers.length}] Downloaded The News Classifieds Page \${p} (\${(buf.length / 1024).toFixed(0)} KB).\`);
            }
        } catch (_) {}
    }

    if (pageBuffers.length === 0) {
        throw new Error(\`Daily Job Ads: No job advert clippings found for \${formatted}.\`);
    }

    const coverPath = path.join(__dirname, 'assets', 'jobz_cover_page.png');
    if (fs.existsSync(coverPath)) {
        try {
            const coverBuf = fs.readFileSync(coverPath);
            pageBuffers.unshift(coverBuf);
            log(\`Daily Job Ads: Prepended cover page (jobz_cover_page.png) as Page 1\`);
        } catch (cErr) {
            log(\`Daily Job Ads: Warning - Failed to read cover page: \${cErr.message}\`);
        }
    }

    log(\`Daily Job Ads: Compiling \${pageBuffers.length} advertisement clippings into PDF...\`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Job Ads',
        editionName: 'Pakistan',
        dateFormatted: formatted,
        outputPath
    }, config);
}

// Complete Accurate Newspaper Catalog (All 35 editions)
const NEWSPAPER_CATALOG = [
    // 1. English Broadsheets (16 Editions)
    { id: 'brecorder', name: 'Business Recorder National', category: 'english', handler: (d, out, cfg, l) => fetchBusinessRecorder(d, out, cfg, l) },
    { id: 'dawn_khi', name: 'Dawn Karachi', category: 'english', handler: (d, out, cfg, l) => fetchDawn('dawn_khi', 'Karachi', d, out, cfg, l) },
    { id: 'nation_lhr', name: 'The Nation Lahore', category: 'english', handler: (d, out, cfg, l) => fetchTheNation('nation_lhr', 'Lahore', d, out, cfg, l) },
    { id: 'nation_isb', name: 'The Nation Islamabad', category: 'english', handler: (d, out, cfg, l) => fetchTheNation('nation_isb', 'Islamabad', d, out, cfg, l) },
    { id: 'nation_khi', name: 'The Nation Karachi', category: 'english', handler: (d, out, cfg, l) => fetchTheNation('nation_khi', 'Karachi', d, out, cfg, l) },
    { id: 'thenews_khi', name: 'The News Karachi', category: 'english', handler: (d, out, cfg, l) => fetchTheNews('thenews_khi', 'Karachi', d, out, cfg, l) },
    { id: 'thenews_lhr', name: 'The News Lahore', category: 'english', handler: (d, out, cfg, l) => fetchTheNews('thenews_lhr', 'Lahore', d, out, cfg, l) },
    { id: 'thenews_isb', name: 'The News Islamabad / Rawalpindi', category: 'english', handler: (d, out, cfg, l) => fetchTheNews('thenews_isb', 'Islamabad', d, out, cfg, l) },
    { id: 'leadpakistan_nat', name: 'Daily Lead Pakistan National', category: 'english', handler: (d, out, cfg, l) => fetchDailyLeadPakistan(d, out, cfg, l) },
    { id: 'pak_observer_isb', name: 'Pakistan Observer Islamabad', category: 'english', handler: (d, out, cfg, l) => fetchPakistanObserver('pak_observer_isb', 'Islamabad', d, out, cfg, l) },
    { id: 'pak_observer_lhr', name: 'Pakistan Observer Lahore', category: 'english', handler: (d, out, cfg, l) => fetchPakistanObserver('pak_observer_lhr', 'Lahore', d, out, cfg, l) },
    { id: 'pak_observer_khi', name: 'Pakistan Observer Karachi', category: 'english', handler: (d, out, cfg, l) => fetchPakistanObserver('pak_observer_khi', 'Karachi', d, out, cfg, l) },
    { id: 'dailytimes_lhr', name: 'Daily Times Lahore', category: 'english', handler: (d, out, cfg, l) => fetchDailyTimes('lahore', 'Lahore', d, out, cfg, l) },
    { id: 'dailytimes_isb', name: 'Daily Times Islamabad', category: 'english', handler: (d, out, cfg, l) => fetchDailyTimes('islamabad', 'Islamabad', d, out, cfg, l) },
    { id: 'dailytimes_khi', name: 'Daily Times Karachi', category: 'english', handler: (d, out, cfg, l) => fetchDailyTimes('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'express_tribune', name: 'The Express Tribune National', category: 'english', handler: (d, out, cfg, l) => fetchExpressTribune('National', d, out, cfg, l) },

    // 2. Urdu Broadsheets (18 Editions)
    { id: 'juraat_khi', name: 'Daily Juraat Karachi', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyJuraat('juraat_khi', 'Karachi', d, out, cfg, l) },
    { id: 'juraat_hyd', name: 'Daily Juraat Hyderabad', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyJuraat('juraat_hyd', 'Hyderabad', d, out, cfg, l) },
    { id: 'ausaf_isb', name: 'Daily Ausaf Islamabad', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('islamabad', 'Islamabad', d, out, cfg, l) },
    { id: 'ausaf_lhr', name: 'Daily Ausaf Lahore', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('lahore', 'Lahore', d, out, cfg, l) },
    { id: 'ausaf_khi', name: 'Daily Ausaf Karachi', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'ausaf_mzd', name: 'Daily Ausaf Muzaffarabad', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('muzaffarabad', 'Muzaffarabad', d, out, cfg, l) },
    { id: 'dailyaaj_pesh', name: 'Daily Aaj Peshawar', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAaj('peshawar', 'Peshawar', d, out, cfg, l) },
    { id: 'dailyaaj_atd', name: 'Daily Aaj Abbottabad', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAaj('abbottabad', 'Abbottabad', d, out, cfg, l) },
    { id: 'naibaat_lhr', name: 'Nai Baat Lahore', category: 'urdu', handler: (d, out, cfg, l) => fetchNaiBaat('lahore', 'Lahore', d, out, cfg, l) },
    { id: 'naibaat_isb', name: 'Nai Baat Islamabad', category: 'urdu', handler: (d, out, cfg, l) => fetchNaiBaat('islamabad', 'Islamabad', d, out, cfg, l) },
    { id: 'naibaat_khi', name: 'Nai Baat Karachi', category: 'urdu', handler: (d, out, cfg, l) => fetchNaiBaat('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'naibaat_pesh', name: 'Nai Baat Peshawar', category: 'urdu', handler: (d, out, cfg, l) => fetchNaiBaat('peshawar', 'Peshawar', d, out, cfg, l) },
    { id: 'naibaat_qta', name: 'Nai Baat Quetta', category: 'urdu', handler: (d, out, cfg, l) => fetchNaiBaat('quetta', 'Quetta', d, out, cfg, l) },
    { id: 'naibaat_sgd', name: 'Nai Baat Sargodha', category: 'urdu', handler: (d, out, cfg, l) => fetchNaiBaat('sargodha', 'Sargodha', d, out, cfg, l) },
    { id: 'naibaat_fsd', name: 'Nai Baat Faisalabad', category: 'urdu', handler: (d, out, cfg, l) => fetchNaiBaat('faisalabad', 'Faisalabad', d, out, cfg, l) },
    { id: 'jasarat_khi', name: 'Daily Jasarat Karachi', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyJasarat('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'jasarat_isb', name: 'Daily Jasarat Islamabad', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyJasarat('islamabad', 'Islamabad', d, out, cfg, l) },
    { id: 'jasarat_hyd', name: 'Daily Jasarat Hyderabad', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyJasarat('hyderabad', 'Hyderabad', d, out, cfg, l) },

    // 3. Classified Ads (1 Edition)
    { id: 'jobz_pk', name: 'Daily Job Ads', category: 'jobs', handler: (d, out, cfg, l) => fetchJobAds(d, out, cfg, l) }
];

module.exports = {
    NEWSPAPER_CATALOG,
    fetchBusinessRecorder,
    fetchDawn,
    fetchTheNation,
    fetchTheNews,
    fetchDailyLeadPakistan,
    fetchPakistanObserver,
    fetchDailyTimes,
    fetchExpressTribune,
    fetchDailyJuraat,
    fetchDailyAusaf,
    fetchDailyAaj,
    fetchNaiBaat,
    fetchDailyJasarat,
    fetchJobAds
};
`;

fs.writeFileSync('scrapers/index.js', code, 'utf8');
console.log('Successfully wrote scrapers/index.js!');
