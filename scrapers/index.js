const https = require('https');
const path = require('path');
const fs = require('fs');
const { assembleAndWatermarkPdf } = require('../services/pdfAssembler');

let puppeteer = null;
try {
    puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
} catch (e) {}

let realBrowser = null;
try {
    realBrowser = require('puppeteer-real-browser');
} catch (e) {}

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
};


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
    const outputFilename = `${dateObj.fileDate} Business Recorder National.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Business Recorder: Scraping all broadsheet pages and supplements for ${formatted}...`);
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
            const matches = html.match(/https?:\/\/[^\s"'<>]+image\/papers\/[^\s"'<>]+\.jpg/gi) || [];
            for (const m of matches) {
                discoveredUrls.add(m.replace('/thumbs/', '/'));
            }
        }
    } catch (_) {}

    // 2. Comprehensive candidate list of all potential pages & regional inserts
    const candidateUrls = [];
    for (let p = 1; p <= 14; p++) {
        for (const suffix of ['', '_LHR', '_ISB']) {
            candidateUrls.push(`https://e.brecorder.com/image/papers/${yStr}/${mStr}/${dStr}/page_${p}${suffix}.jpg`);
        }
    }
    for (const p of [91, 95, 96, 97, 98, 99]) {
        for (const suffix of ['', '_LHR', '_ISB']) {
            candidateUrls.push(`https://e.brecorder.com/image/papers/${yStr}/${mStr}/${dStr}/page_${p}${suffix}.jpg`);
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
            log(`Business Recorder: [${pageBuffers.length}] Downloaded ${pageName} (${(buf.length / 1024).toFixed(0)} KB)`);
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Business Recorder: No broadsheet pages found for ${formatted}.`);
    }

    log(`Business Recorder: Compiling ${pageBuffers.length} broadsheet pages into single comprehensive PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Business Recorder',
        editionName: 'National',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 2. Dawn (National / Karachi)
 * Broadsheet Main + Karachi Metro + Islamabad Metro + Lahore Metro + Peshawar Metro + Sunday Magazines (ICON, EOS) + Supplements + Classifieds (All 28 to 53+ pages)
 */
async function fetchDawn(editionKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Dawn Karachi.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yStr = String(year);
    const dateStr = `${dStr}_${mStr}_${yStr}`;

    log(`Dawn (National): Discovering all published sections (Main, Metros, Magazines, Supplements, Classifieds) for ${formatted}...`);

    let slots = [];
    const seenSlots = new Set();

    // 1. Dynamic extraction: query Dawn ePaper index to get exact published pages and section titles
    try {
        const { execSync } = require('child_process');
        const helperPath = path.join(__dirname, 'getDawnSlots.py');
        const pyOutput = execSync(`python3 "${helperPath}" ${dateStr}`, { timeout: 12000, encoding: 'utf-8' });
        const parsed = JSON.parse(pyOutput.trim() || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
            for (const item of parsed) {
                if (!seenSlots.has(item.slot)) {
                    seenSlots.add(item.slot);
                    slots.push(item);
                }
            }
            log(`Dawn: Dynamically discovered ${slots.length} published broadsheet pages from ePaper index.`);
        }
    } catch (e) {
        log(`Dawn: Dynamic discovery note: ${e.message}. Using comprehensive range scan.`);
    }

    // 2. Comprehensive candidate ranges complement (ensures no section is ever missed)
    const candidateRanges = [
        [1, 25],
        [113, 125],
        [150, 165],
        [175, 185],
        [370, 385],
        [501, 515],
        [521, 535],
        [701, 715],
        [801, 825]
    ];
    for (const [start, end] of candidateRanges) {
        for (let p = start; p <= end; p++) {
            if (!seenSlots.has(p)) {
                seenSlots.add(p);
                const sStr = String(p).padStart(3, '0');
                const defaultTitle = p >= 800 ? 'Classified' :
                                     p >= 700 ? 'Supplement' :
                                     p >= 520 ? 'EOS' :
                                     p >= 500 ? 'ICON' :
                                     p >= 370 ? 'Young World' :
                                     p >= 180 ? 'Metro Peshawar' :
                                     p >= 175 ? 'Metro Lahore' :
                                     p >= 150 ? 'Metro Islamabad' :
                                     p >= 113 ? 'Metro Karachi' :
                                     p >= 90 ? 'Supplement' : 'Main';
                slots.push({ slot: p, slotStr: sStr, title: defaultTitle });
            }
        }
    }

    // Sort slots by slot number to preserve authentic broadsheet reading flow
    slots.sort((a, b) => a.slot - b.slot);

    // 3. Concurrently download pages
    const pageBuffersMap = new Map();
    const chunkSize = 10;

    for (let i = 0; i < slots.length; i += chunkSize) {
        const chunk = slots.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
            const url = `https://e.dawn.com/${yStr}/${mStr}/${dStr}/pages/${dStr}_${mStr}_${yStr}_${item.slotStr}.jpg`;
            try {
                const buf = await fetchBufferDirect(url, 'https://e.dawn.com/', 6000);
                if (buf && buf.length > 20000 && isJpeg(buf)) {
                    pageBuffersMap.set(item.slot, { buf, title: item.title, slotStr: item.slotStr });
                }
            } catch (_) {}
        }));
    }

    // 4. Assemble valid pages
    const pageBuffers = [];
    for (const item of slots) {
        if (pageBuffersMap.has(item.slot)) {
            const pageData = pageBuffersMap.get(item.slot);
            pageBuffers.push(pageData.buf);
            log(`Dawn: [${pageBuffers.length}] Downloaded ${pageData.title} (Slot ${pageData.slotStr}, ${(pageData.buf.length / 1024).toFixed(0)} KB).`);
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Dawn: No broadsheet pages found for ${formatted}.`);
    }

    log(`Dawn: Compiling all ${pageBuffers.length} broadsheet pages into single comprehensive PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Dawn',
        editionName: 'National (Karachi)',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 2b. Dawn Editorials (Editorial Columns & Articles)
 */
async function fetchDawnEditorials(dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Dawn Editorials.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Dawn Editorials: Scraping editorial columns and articles for ${formatted}...`);

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yStr = String(year);
    const datePath = `${yStr}/${mStr}/${dStr}`;
    const dateCode = `${dStr}_${mStr}_${yStr}`;

    // Step 1: Find slot string for Editorial (default '006')
    let editorialSlot = '006';
    try {
        const indexUrl = `https://epaper.dawn.com/?page=${dateCode}_001`;
        const res = await fetch(indexUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
            const html = await res.text();
            const matches = [...html.matchAll(/href=["'][^"']*page=[0-9]{2}_[0-9]{2}_[0-9]{4}_([0-9]{3})["'][^>]*>(.*?)<\/a>/gi)];
            for (const m of matches) {
                const sStr = m[1];
                const title = m[2].replace(/<[^>]+>/g, '').trim().toLowerCase();
                if (title.includes('editorial') || title.includes('opinion')) {
                    editorialSlot = sStr;
                    break;
                }
            }
        }
    } catch (_) {}

    log(`Dawn Editorials: Target slot identified as ${editorialSlot}`);

    // Step 2: Fetch subpage HTML to get exact story indices
    const subpageUrl = `https://e.dawn.com/${datePath}/pages/${dateCode}_${editorialSlot}.html`;
    const storyIndices = [];

    try {
        const subRes = await fetch(subpageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://epaper.dawn.com/'
            },
            signal: AbortSignal.timeout(8000)
        });
        if (subRes.ok) {
            const subHtml = await subRes.text();
            const storyMatches = [...subHtml.matchAll(/(?:StoryText|StoryImage)=([0-9]{2}_[0-9]{2}_[0-9]{4}_[0-9]{3}_([0-9]{3}))/gi)];
            for (const sm of storyMatches) {
                const idxStr = sm[2];
                if (!storyIndices.includes(idxStr)) {
                    storyIndices.push(idxStr);
                }
            }
        }
    } catch (_) {}

    // Fallback if subpage parsing failed: scan indices 001 to 010
    if (storyIndices.length === 0) {
        for (let i = 1; i <= 10; i++) {
            storyIndices.push(String(i).padStart(3, '0'));
        }
    }

    log(`Dawn Editorials: Discovered ${storyIndices.length} story clipping slots.`);

    const pageBuffers = [];

    // Step 3: Read cover page if exists (Page 1)
    const coverPath = path.join(__dirname, '..', 'assets', 'dawn_columns_cover.png');
    if (fs.existsSync(coverPath)) {
        try {
            const coverBuf = fs.readFileSync(coverPath);
            pageBuffers.push(coverBuf);
            log(`Dawn Editorials: Prepended cover page (Page 1)`);
        } catch (cErr) {
            log(`Dawn Editorials: Warning - Failed to load cover page: ${cErr.message}`);
        }
    }

    // Step 4: Download story clipping images
    for (const idxStr of storyIndices) {
        const imgUrl = `https://e.dawn.com/${datePath}/stories/${dateCode}_${editorialSlot}_${idxStr}.jpg`;
        try {
            const buf = await fetchBufferDirect(imgUrl, 'https://epaper.dawn.com/', 8000);
            if (buf && buf.length > 20000) {
                pageBuffers.push(buf);
                log(`Dawn Editorials: [${pageBuffers.length}] Downloaded Article Clipping ${idxStr} (${(buf.length / 1024).toFixed(0)} KB)`);
            }
        } catch (_) {}
    }

    if (pageBuffers.length <= 1) {
        throw new Error(`Dawn Editorials: No article clippings found for ${formatted}.`);
    }

    log(`Dawn Editorials: Compiling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Dawn Editorials',
        editionName: '',
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
    const outputFilename = `${dateObj.fileDate} The Nation ${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`The Nation ${cleanCity}: Scraping authentic high-resolution broadsheet pages for ${formatted}...`);
    const pageBuffers = [];
    const citySlug = editionKey === 'nation_isb' ? 'islamabad' : editionKey === 'nation_khi' ? 'karachi' : editionKey === 'nation_qta' ? 'quetta' : 'lahore';

    let browser = null;
    try {
        if (!puppeteer) {
            puppeteer = require('puppeteer-extra');
            const StealthPlugin = require('puppeteer-extra-plugin-stealth');
            puppeteer.use(StealthPlugin());
        }
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/usr/bin/google-chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        const editionUrl = `https://www.nation.com.pk/E-Paper/${citySlug}/${year}-${month}-${day}`;
        await page.goto(editionUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        
        let pageLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href*="/page-"]')).map(a => a.href);
        });
        pageLinks = Array.from(new Set(pageLinks)).sort((a, b) => {
            const numA = parseInt((a.match(/page-(\d+)/) || [0, 0])[1]);
            const numB = parseInt((b.match(/page-(\d+)/) || [0, 0])[1]);
            return numA - numB;
        });

        const imageUrls = [];
        for (const pUrl of pageLinks) {
            try {
                await page.goto(pUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                const img = await page.evaluate(() => {
                    const el = document.querySelector('#epaper_image, .epaper_image img, img[src*="epaper_img"]');
                    return el ? el.src : null;
                });
                if (img) imageUrls.push(img);
            } catch (e) {}
        }
        await browser.close();
        browser = null;

        for (let i = 0; i < imageUrls.length; i++) {
            const rawUrl = imageUrls[i];
            const cleanHost = rawUrl.replace(/^https?:\/\//, '');
            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(cleanHost)}&output=jpg&q=90`;
            try {
                const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
                if (res.ok) {
                    const buf = Buffer.from(await res.arrayBuffer());
                    if (buf.length > 20000 && isValidImage(buf)) {
                        pageBuffers.push(buf);
                        log(`The Nation ${cleanCity}: [${pageBuffers.length}] Downloaded Page ${i + 1} (${(buf.length / 1024).toFixed(0)} KB)`);
                    }
                }
            } catch (e) {}
        }
    } catch (err) {
        log(`The Nation ${cleanCity}: Fetch error - ${err.message}`);
    } finally {
        if (browser) try { await browser.close(); } catch(e) {}
    }

    if (pageBuffers.length === 0) {
        throw new Error(`The Nation ${cleanCity}: No broadsheet pages found for ${formatted}.`);
    }

    log(`The Nation ${cleanCity}: Compiling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'The Nation',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * 4. The News (Karachi, Lahore, Islamabad)
 * All broadsheet pages + Sunday Magazines (The News on Sunday - TNS) + Friday Youth Magazine (US) + Special Supplements (18 to 52+ pages)
 */
async function fetchTheNews(editionKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Lahore';
    const outputFilename = `${dateObj.fileDate} The News ${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`The News ${cleanCity}: Discovering all broadsheet pages, Sunday TNS magazine, and supplements for ${formatted}...`);

    const citySlug = editionKey === 'thenews_khi' ? 'karachi' : editionKey === 'thenews_isb' ? 'pindi' : 'lahore';
    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yStr = String(year);
    const mInt = parseInt(month, 10);
    const dInt = parseInt(day, 10);

    let candidatePages = [];
    try {
        const { execSync } = require('child_process');
        const helperPath = path.join(__dirname, 'getTheNewsPages.py');
        const pyOutput = execSync(`python3 "${helperPath}" ${citySlug} ${dStr} ${mStr} ${yStr}`, { timeout: 12000, encoding: 'utf-8' });
        candidatePages = JSON.parse(pyOutput.trim() || '[]');
        log(`The News ${cleanCity}: Dynamically discovered edition index (${candidatePages.length} candidate slots).`);
    } catch (err) {
        log(`The News ${cleanCity}: Dynamic index note: ${err.message}. Probing standard broadsheet & magazine slots.`);
    }

    if (!Array.isArray(candidatePages) || candidatePages.length === 0) {
        candidatePages = [];
        for (let p = 1; p <= 35; p++) {
            candidatePages.push({
                title: `Main Page ${p}`,
                imgUrl: `https://e.thenews.pk/static_pages/${mInt}-${dInt}-${year}/${citySlug}/mainpage/page${p}.jpg`,
                sortKey: p
            });
        }
        for (let p = 1; p <= 30; p++) {
            candidatePages.push({
                title: `The News on Sunday ${p}`,
                imgUrl: `https://e.thenews.pk/static_pages/${mInt}-${dInt}-${year}/${citySlug}/mainpage/nos${p}.jpg`,
                sortKey: 1000 + p
            });
        }
        for (let p = 1; p <= 20; p++) {
            candidatePages.push({
                title: `US Magazine ${p}`,
                imgUrl: `https://e.thenews.pk/static_pages/${mInt}-${dInt}-${year}/${citySlug}/mainpage/us${p}.jpg`,
                sortKey: 2000 + p
            });
        }
    }

    // Concurrently download valid pages in chunks of 10
    const pageBuffersMap = new Map();
    const chunkSize = 10;

    for (let i = 0; i < candidatePages.length; i += chunkSize) {
        const chunk = candidatePages.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item, idx) => {
            const pageIndex = i + idx;
            try {
                const buf = await fetchBufferDirect(item.imgUrl, 'https://e.thenews.pk/', 6000);
                if (buf && buf.length > 20000 && isValidImage(buf)) {
                    pageBuffersMap.set(pageIndex, { buf, title: item.title });
                }
            } catch (_) {}
        }));
    }

    const pageBuffers = [];
    for (let i = 0; i < candidatePages.length; i++) {
        if (pageBuffersMap.has(i)) {
            const pageData = pageBuffersMap.get(i);
            pageBuffers.push(pageData.buf);
            log(`The News ${cleanCity}: [${pageBuffers.length}] Downloaded ${pageData.title} (${(pageData.buf.length / 1024).toFixed(0)} KB)`);
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`The News ${cleanCity}: No broadsheet pages found for ${formatted}.`);
    }

    log(`The News ${cleanCity}: Compiling all ${pageBuffers.length} pages into complete broadsheet PDF...`);
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
    const outputFilename = `${dateObj.fileDate} Daily Lead Pakistan National.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Lead Pakistan: Scraping authentic broadsheet pages for ${formatted}...`);
    const pageBuffers = [];

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yStr = String(year);
    const epUrl = `https://leadpakistan.com.pk/ep/${yStr}${mStr}/${dStr}/`;

    let browser = null;
    try {
        const { connect } = require('puppeteer-real-browser');
        const connected = await connect({
            headless: 'auto',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            turnstile: true
        });
        browser = connected.browser;
        const page = connected.page;

        log(`Daily Lead Pakistan: Connecting and bypassing security on ${epUrl}...`);
        await page.goto(epUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        
        for (let i = 0; i < 20; i++) {
            const title = await page.title();
            if (!title.toLowerCase().includes('just a moment') && !title.toLowerCase().includes('attention')) break;
            await new Promise(r => setTimeout(r, 1000));
        }
        await new Promise(r => setTimeout(r, 2000));

        const pageNums = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img[src*="small_Page"]')).map(i => i.src);
            const nums = imgs.map(s => {
                const m = s.match(/small_Page(\d+)\.jpg/i);
                return m ? parseInt(m[1], 10) : null;
            }).filter(Boolean);
            return Array.from(new Set(nums)).sort((a, b) => a - b);
        });

        const pList = pageNums.length ? pageNums : [1, 2, 3, 4, 5, 6, 7, 8];
        log(`Daily Lead Pakistan: Detected ${pList.length} broadsheet pages (${pList.join(', ')})...`);

        for (const pNum of pList) {
            const fullImgUrl = `https://leadpakistan.com.pk/ep/${yStr}${mStr}/${dStr}/pages/Page${pNum}.jpg`;
            const b64 = await page.evaluate(async (imgUrl) => {
                try {
                    const res = await fetch(imgUrl);
                    if (!res.ok) return null;
                    const blob = await res.blob();
                    return await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                } catch(e) { return null; }
            }, fullImgUrl);

            if (b64 && b64.includes('base64,')) {
                const buf = Buffer.from(b64.split('base64,')[1], 'base64');
                if (buf.length > 20000 && isValidImage(buf)) {
                    pageBuffers.push(buf);
                    log(`Daily Lead Pakistan: [${pageBuffers.length}] Downloaded Page ${pNum} (${(buf.length / 1024).toFixed(0)} KB)`);
                }
            }
        }
        await browser.close();
        browser = null;
    } catch (e) {
        log(`Daily Lead Pakistan: Error - ${e.message}`);
    } finally {
        if (browser) try { await browser.close(); } catch(e) {}
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Daily Lead Pakistan: No broadsheet pages found for ${formatted}.`);
    }

    log(`Daily Lead Pakistan: Compiling all ${pageBuffers.length} broadsheet pages into single comprehensive PDF...`);
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
    const outputFilename = `${dateObj.fileDate} Pakistan Observer ${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    const stationId = stationKey === 'pak_observer_lhr' ? 2 : stationKey === 'pak_observer_khi' ? 3 : 1;
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateQuery = `${year}-${mStr}-${dStr}`;

    log(`Pakistan Observer ${cleanCity}: Scraping authentic broadsheet pages for ${formatted} (Station ${stationId})...`);
    const pageBuffers = [];

    try {
        const indexUrl = `https://epaper.pakobserver.net/pages.php?station_id=${stationId}&date=${dateQuery}`;
        const res = await fetch(indexUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(12000)
        });
        if (res.ok) {
            const html = await res.text();
            const thumbMatches = [...html.matchAll(/src=["'](issues\/[^"']+-full_thump\.jpg)["']/gi)];
            const seenThumbs = new Set();
            for (const match of thumbMatches) {
                const thumbRel = match[1];
                if (seenThumbs.has(thumbRel)) continue;
                seenThumbs.add(thumbRel);
                const fullUrl = `https://epaper.pakobserver.net/${thumbRel.replace('-full_thump.jpg', '-full.jpg')}`;
                const buf = await fetchBufferDirect(fullUrl, 'https://epaper.pakobserver.net/', 8000);
                if (buf && buf.length > 20000 && isValidImage(buf)) {
                    pageBuffers.push(buf);
                    log(`Pakistan Observer ${cleanCity}: [${pageBuffers.length}] Downloaded Page ${pageBuffers.length} (${(buf.length / 1024).toFixed(0)} KB)`);
                }
            }
        }
    } catch (err) {
        log(`Pakistan Observer ${cleanCity}: Index page scrape error: ${err.message}`);
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Pakistan Observer ${cleanCity}: No broadsheet pages found for ${formatted}.`);
    }

    log(`Pakistan Observer ${cleanCity}: Compiling ${pageBuffers.length} pages into PDF...`);
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
    const outputFilename = `${dateObj.fileDate} Daily Times ${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Times ${cleanCity}: Scraping broadsheet pages for ${formatted}...`);
    const pageBuffers = [];

    const cacheFile = path.join(__dirname, '..', 'cache', 'dailytimes_id_cache.json');
    let anchorId = 1556521;
    try {
        if (fs.existsSync(cacheFile)) {
            const diskData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            if (diskData && diskData.postId) anchorId = parseInt(diskData.postId, 10);
        }
    } catch (_) {}

    // Helper to probe a single image URL directly with short timeout
    async function probeImg(id, prefix, p) {
        const url = `https://dailytimes.com.pk/assets/uploads/epaper/${id}/${prefix}${p}.jpg`;
        try {
            const buf = await fetchBufferDirect(url, 'https://dailytimes.com.pk/', 4000);
            if (buf && buf.length > 15000 && isValidImage(buf)) {
                return buf;
            }
        } catch (_) {}
        return null;
    }

    // 1. High-Speed Direct Probing (No Puppeteer overhead, instant execution)
    let postId = null;
    let mainPrefix = 'a';
    let firstPageBuf = null;

    const candidates = [anchorId];
    for (let delta = 1; delta <= 60; delta++) {
        candidates.push(anchorId + delta);
        candidates.push(anchorId - delta);
    }

    log(`Daily Times ${cleanCity}: Probing issue IDs around anchor ${anchorId}...`);
    const chunkSize = 5;
    for (let i = 0; i < candidates.length && !postId; i += chunkSize) {
        const chunk = candidates.slice(i, i + chunkSize);
        const results = await Promise.all(chunk.map(async (id) => {
            for (const prefix of ['a', 'b', 'c', '']) {
                const buf = await probeImg(id, prefix, 1);
                if (buf) return { id, prefix, buf };
            }
            return null;
        }));

        const hit = results.find(r => r !== null);
        if (hit) {
            postId = hit.id;
            mainPrefix = hit.prefix;
            firstPageBuf = hit.buf;
            try {
                fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
                fs.writeFileSync(cacheFile, JSON.stringify({ postId: hit.id, updatedAt: new Date().toISOString() }), 'utf8');
            } catch (_) {}
            break;
        }
    }

    if (postId) {
        log(`Daily Times ${cleanCity}: Found issue ID ${postId}. Downloading pages in parallel...`);
        const prefixesToTry = [mainPrefix, 'a', 'b', 'c', ''].filter((v, idx, arr) => arr.indexOf(v) === idx);

        const pageTasks = [];
        for (let p = 1; p <= 16; p++) {
            pageTasks.push((async () => {
                if (p === 1 && firstPageBuf) return { pageNum: 1, buf: firstPageBuf };
                for (const prefix of prefixesToTry) {
                    const buf = await probeImg(postId, prefix, p);
                    if (buf) return { pageNum: p, buf };
                }
                return null;
            })());
        }

        const pageResults = await Promise.all(pageTasks);
        const validPages = pageResults.filter(r => r !== null).sort((a, b) => a.pageNum - b.pageNum);
        validPages.forEach(p => pageBuffers.push(p.buf));
        log(`Daily Times ${cleanCity}: Downloaded ${pageBuffers.length} broadsheet pages.`);
    }

    // 2. Fallback to Puppeteer if direct probing found no pages
    if (pageBuffers.length === 0) {
        let browser = null;
        try {
            const { connect } = require('puppeteer-real-browser');
            log(`Daily Times ${cleanCity}: Browser fallback - Bypassing Cloudflare protection...`);
            const connected = await connect({
                headless: 'auto',
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                customConfig: { executablePath: '/usr/bin/google-chrome' },
                turnstile: true
            });
            browser = connected.browser;
            const page = connected.page;

            await page.goto('https://dailytimes.com.pk/e-paper/', { waitUntil: 'domcontentloaded', timeout: 25000 });
            await new Promise(r => setTimeout(r, 2000));

            const pageInfo = await page.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('img')).map(i => i.src);
                const epaperImg = imgs.find(s => s.includes('/assets/uploads/epaper/'));
                let pId = null;
                if (epaperImg) {
                    const m = epaperImg.match(/\/assets\/uploads\/epaper\/(\d+)\//);
                    if (m) pId = m[1];
                }
                return { postId: pId };
            });

            if (pageInfo.postId) {
                postId = pageInfo.postId;
                log(`Daily Times ${cleanCity}: Browser found issue ID ${postId}. Downloading pages...`);
                for (let p = 1; p <= 16; p++) {
                    let pageDownloaded = false;
                    for (const prefix of ['a', 'b', 'c', '']) {
                        const imgUrl = `https://dailytimes.com.pk/assets/uploads/epaper/${postId}/${prefix}${p}.jpg`;
                        try {
                            const buf = await fetchBufferDirect(imgUrl, 'https://dailytimes.com.pk/', 5000);
                            if (buf && buf.length > 15000 && isValidImage(buf)) {
                                pageBuffers.push(buf);
                                log(`Daily Times ${cleanCity}: [${pageBuffers.length}] Downloaded Page ${p} (${(buf.length / 1024).toFixed(0)} KB)`);
                                pageDownloaded = true;
                                break;
                            }
                        } catch (_) {}
                    }
                    if (!pageDownloaded && p > 1) {
                        break;
                    }
                }
            }
        } catch (e) {
            log(`Daily Times ${cleanCity}: Browser bypass error: ${e.message}`);
        } finally {
            if (browser) {
                try { await browser.close(); } catch (_) {}
            }
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Daily Times ${cleanCity}: No broadsheet pages found for ${formatted}.`);
    }

    log(`Daily Times ${cleanCity}: Compiling ${pageBuffers.length} pages into PDF...`);
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
    const outputFilename = `${dateObj.fileDate} The Express Tribune National.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`The Express Tribune: Scraping authentic broadsheet pages for ${formatted}...`);
    const pageBuffers = [];

    try {
        const epaperUrl = 'https://tribune.com.pk/epaper';
        const res = await fetch(epaperUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(15000)
        });
        if (res.ok) {
            const html = await res.text();
            const matches = html.match(/https:\/\/i\.tribune\.com\.pk\/epaper\/[^"'\s]+\/\d+\/[a-f0-9]+\.jpg/gi) || [];
            const uniqueUrls = [];
            const seen = new Set();
            for (const u of matches) {
                if (!u.includes('thumbnails') && !seen.has(u)) {
                    seen.add(u);
                    uniqueUrls.push(u);
                }
            }

            for (let i = 0; i < uniqueUrls.length; i++) {
                const u = uniqueUrls[i];
                const buf = await fetchBufferDirect(u, 'https://tribune.com.pk/');
                if (buf && buf.length > 20000 && isValidImage(buf)) {
                    pageBuffers.push(buf);
                    log(`The Express Tribune: [${pageBuffers.length}] Downloaded Page ${i + 1} (${(buf.length / 1024).toFixed(0)} KB)`);
                }
            }
        }
    } catch (e) {
        log(`The Express Tribune: Warning - ${e.message}`);
    }

    if (pageBuffers.length === 0) {
        throw new Error(`The Express Tribune: No broadsheet pages found for ${formatted}.`);
    }

    log(`The Express Tribune: Compiling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'The Express Tribune',
        editionName: 'National',
        dateFormatted: formatted,
        outputPath
    }, config);
}

async function fetchDailyJuraat(editionKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Daily Juraat ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yStr = String(year);

    log(`Daily Juraat ${cityName}: Scraping broadsheet pages for ${formatted}...`);
    const pageBuffers = [];

    for (let p = 1; p <= 12; p++) {
        const directUrl = `https://e.juraat.com/uploads/${yStr}/${mStr}/${dStr}/page-${p}.jpg`;
        try {
            const buf = await fetchBufferDirect(directUrl, 'https://e.juraat.com/');
            if (buf && buf.length > 15000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`Daily Juraat ${cityName}: [${pageBuffers.length}] Downloaded Page ${p} (${(buf.length / 1024).toFixed(0)} KB)`);
            } else {
                const webpUrl = `https://e.juraat.com/uploads/${yStr}/${mStr}/${dStr}/page-${p}.webp`;
                const wbuf = await fetchBufferDirect(webpUrl, 'https://e.juraat.com/');
                if (wbuf && wbuf.length > 15000 && isValidImage(wbuf)) {
                    pageBuffers.push(wbuf);
                    log(`Daily Juraat ${cityName}: [${pageBuffers.length}] Downloaded Page ${p} (WebP ${(wbuf.length / 1024).toFixed(0)} KB)`);
                } else {
                    break;
                }
            }
        } catch (_) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Daily Juraat ${cityName}: No broadsheet pages found for ${formatted}.`);
    }

    log(`Daily Juraat ${cityName}: Compiling ${pageBuffers.length} pages into PDF...`);
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
    const outputFilename = `${dateObj.fileDate} Daily Ausaf ${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Ausaf ${cleanCity}: Scraping authentic broadsheet pages for ${formatted}...`);
    const pageBuffers = [];
    const stationIdMap = {
        'islamabad': 1,
        'lahore': 2,
        'peshawar': 3,
        'gilgit': 4,
        'europe': 5,
        'muzaffarabad': 7,
        'kashmir': 7,
        'karachi': 8
    };
    const sid = stationIdMap[stationKey] || 1;

    let browser = null;
    try {
        const { connect } = require('puppeteer-real-browser');
        const connected = await connect({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            turnstile: true
        });
        browser = connected.browser;
        const page = connected.page;

        let stationUrl = sid === 1 ? 'https://epaper.dailyausaf.com/' : `https://epaper.dailyausaf.com/page?station_id=${sid}`;
        await page.goto(stationUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

        for (let i = 0; i < 15; i++) {
            const title = await page.title();
            if (!title.includes('Just a moment')) break;
            await new Promise(r => setTimeout(r, 1000));
        }

        for (let i = 0; i < 10; i++) {
            const count = await page.evaluate(() => (document.documentElement.innerHTML.match(/issues\/[^"']*/g) || []).length);
            if (count > 0) break;
            await new Promise(r => setTimeout(r, 500));
        }

        let pageUrls = await page.evaluate(() => {
            const html = document.documentElement.innerHTML;
            const matches = html.match(/(?:src|href|data-src)=["']([^"']*issues\/[^"']*)["']/gi) || [];
            const urls = [];
            for (const m of matches) {
                const p = m.replace(/^(?:src|href|data-src)=["']|["']$/g, '');
                let fullUrl = p.startsWith('http') ? p : `https://epaper.dailyausaf.com/${p.replace(/^\//, '')}`;
                fullUrl = fullUrl.replace('-thumb.', '-full.');
                if (!urls.includes(fullUrl)) urls.push(fullUrl);
            }
            return urls;
        });

        if (pageUrls.length === 0 && sid === 1) {
            log(`Daily Ausaf ${cleanCity}: Retrying with station_id=1 URL...`);
            await page.goto('https://epaper.dailyausaf.com/page?station_id=1', { waitUntil: 'domcontentloaded', timeout: 35000 });
            await new Promise(r => setTimeout(r, 2000));
            pageUrls = await page.evaluate(() => {
                const html = document.documentElement.innerHTML;
                const matches = html.match(/(?:src|href|data-src)=["']([^"']*issues\/[^"']*)["']/gi) || [];
                const urls = [];
                for (const m of matches) {
                    const p = m.replace(/^(?:src|href|data-src)=["']|["']$/g, '');
                    let fullUrl = p.startsWith('http') ? p : `https://epaper.dailyausaf.com/${p.replace(/^\//, '')}`;
                    fullUrl = fullUrl.replace('-thumb.', '-full.');
                    if (!urls.includes(fullUrl)) urls.push(fullUrl);
                }
                return urls;
            });
        }

        for (let i = 0; i < pageUrls.length; i++) {
            const pUrl = pageUrls[i];
            const b64 = await page.evaluate(async (imgUrl) => {
                try {
                    const res = await fetch(imgUrl);
                    if (!res.ok) return null;
                    const blob = await res.blob();
                    return await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    return null;
                }
            }, pUrl);

            if (b64 && b64.includes('base64,')) {
                const buf = Buffer.from(b64.split('base64,')[1], 'base64');
                if (buf.length > 20000 && isValidImage(buf)) {
                    pageBuffers.push(buf);
                    log(`Daily Ausaf ${cleanCity}: [${pageBuffers.length}] Downloaded Page ${i + 1} (${(buf.length / 1024).toFixed(0)} KB)`);
                }
            }
        }
    } catch (e) {
        log(`Daily Ausaf ${cleanCity}: Fetch error - ${e.message}`);
    } finally {
        if (browser) try { await browser.close(); } catch (e) {}
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Daily Ausaf ${cleanCity}: No broadsheet pages found for ${formatted}.`);
    }

    log(`Daily Ausaf ${cleanCity}: Compiling ${pageBuffers.length} pages into PDF...`);
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
/**
 * 11. Daily Aaj (Peshawar, Abbottabad)
 */
async function fetchDailyAaj(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Peshawar';
    const outputFilename = `${dateObj.fileDate} Daily Aaj ${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Aaj ${cleanCity}: Scraping authentic broadsheet pages for ${formatted}...`);
    const typeVal = stationKey === 'abbottabad' ? 'abbotabad' : 'peshawar';

    // Step 1: Extract dynamic page options from <select name="epaperpage">
    let pageIds = ['1', '16', '17', '18', '20', '22', '26'];
    try {
        const initForm = new URLSearchParams();
        initForm.append('epapertype', typeVal);
        initForm.append('epaperpage', '1');
        initForm.append('dated', `${year}-${month}-${day}`);

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
            const optionMatches = [...initHtml.matchAll(/<option[^>]*value=["'](\d+)["'][^>]*>/gi)];
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
            formData.append('dated', `${year}-${month}-${day}`);

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
                        imgUrl = 'https://epaper.dailyaaj.com.pk/' + imgUrl.replace(/^\.\//, '').replace(/^\//, '');
                    }
                    if (imgUrl.includes('/pages/') || imgUrl.includes('placeholder')) {
                        continue;
                    }
                    if (!seenImages.has(imgUrl)) {
                        seenImages.add(imgUrl);
                        const buf = await fetchBufferDirect(imgUrl, 'https://epaper.dailyaaj.com.pk/');
                        if (buf && buf.length > 20000 && isValidImage(buf)) {
                            pageBuffers.push(buf);
                            log(`Daily Aaj ${cleanCity}: [${pageBuffers.length}] Downloaded Page ${pVal} (${(buf.length / 1024).toFixed(0)} KB)`);
                        }
                    }
                }
            }
        } catch (_) {}
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Daily Aaj ${cleanCity}: No broadsheet pages found for ${formatted}.`);
    }

    log(`Daily Aaj ${cleanCity}: Compiling ${pageBuffers.length} pages into PDF...`);
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
    const outputFilename = `${dateObj.fileDate} Nai Baat ${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Nai Baat ${cleanCity}: Scraping authentic broadsheet pages for ${formatted}...`);
    const pageBuffers = [];

    for (let p = 1; p <= 12; p++) {
        const pageUrl = `https://www.naibaat.pk/E-Paper/${stationKey}/${year}-${month}-${day}/page-${p}`;
        try {
            const res = await fetch(pageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(8000)
            });
            if (!res.ok) break;
            const html = await res.text();
            const match = html.match(/src=["']([^"']*epaper_image[^"']*)["']/i) || html.match(/src=["']([^"']*epaper-[0-9]+[^"']*)["']/i);
            if (!match) break;

            let imgUrl = match[1].replace('/medium/', '/large/');
            if (!imgUrl.startsWith('http')) {
                imgUrl = 'https://www.naibaat.pk' + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
            }

            const buf = await fetchBufferDirect(imgUrl, 'https://www.naibaat.pk/');
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`Nai Baat ${cleanCity}: [${pageBuffers.length}] Downloaded Page ${p} (${(buf.length / 1024).toFixed(0)} KB)`);
            } else {
                break;
            }
        } catch (_) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Nai Baat ${cleanCity}: No broadsheet pages found for ${formatted}.`);
    }

    log(`Nai Baat ${cleanCity}: Compiling ${pageBuffers.length} pages into PDF...`);
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
    const outputFilename = `${dateObj.fileDate} Daily Jasarat ${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Jasarat ${cleanCity}: Scraping authentic broadsheet pages for ${formatted}...`);
    const pageBuffers = [];

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yStr = String(year);
    const dateStr = `${yStr}-${mStr}-${dStr}`;

    const st = (stationKey || 'karachi').toLowerCase();
    const prefix = st === 'karachi' ? 'epaper' : st;

    // Probe and download broadsheet pages (Karachi 8-16 pages, Islamabad ~4, Hyderabad ~8)
    for (let p = 1; p <= 32; p++) {
        const imgUrl = `https://jasarat.news/${prefix}/images/dates/${dateStr}/${st}/mm/${p}.jpg`;
        try {
            const res = await fetch(imgUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Referer': 'https://jasarat.news/'
                },
                signal: AbortSignal.timeout(15000)
            });
            if (!res.ok) break;
            const ab = await res.arrayBuffer();
            const buf = Buffer.from(ab);
            if (buf && buf.length > 20000 && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`Daily Jasarat ${cleanCity}: [${pageBuffers.length}] Downloaded Page ${p} (${(buf.length / 1024).toFixed(0)} KB)`);
            } else {
                break;
            }
        } catch (e) {
            log(`Daily Jasarat ${cleanCity}: Page ${p} download ended (${e.message})`);
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Daily Jasarat ${cleanCity}: No broadsheet pages found for ${formatted}.`);
    }

    log(`Daily Jasarat ${cleanCity}: Compiling all ${pageBuffers.length} broadsheet pages into single comprehensive PDF...`);
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

function fetchJinaMarkdown(url, timeoutMs = 20000) {
    return new Promise((resolve) => {
        const req = https.get('https://r.jina.ai/' + url, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/plain' },
            timeout: timeoutMs
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', (e) => {
            console.warn('[Jina Error]', url, e.message);
            resolve('');
        });
        req.on('timeout', () => {
            req.destroy();
            console.warn('[Jina Timeout]', url);
            resolve('');
        });
    });
}

function fetchBufferDirectHttps(url, timeoutMs = 15000) {
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: timeoutMs
        }, (res) => {
            if (res.statusCode !== 200) return resolve(null);
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

async function fetchJobAds(dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Jobz.pk Daily Job Ads.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Jobz.pk Daily Job Ads: Scraping daily newspaper job clippings for ${formatted}...`);

    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dStr = String(day).padStart(2, '0');
    const mShort = MONTHS_SHORT[parseInt(month, 10) - 1];
    const datePat1 = `${dStr}-${mShort}-${year}`.toLowerCase(); // e.g. 06-sep-2026
    const datePat2 = `${dStr} ${mShort} ${year}`.toLowerCase();  // e.g. 06 sep 2026
    const datePat3 = `${parseInt(day, 10)} ${mShort} ${year}`.toLowerCase(); // e.g. 6 sep 2026

    const pageBuffers = [];
    let browser = null;

    try {
        const { connect } = require('puppeteer-real-browser');
        const connected = await connect({
            headless: 'auto',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            turnstile: true
        });
        browser = connected.browser;
        const page = connected.page;

        log(`Jobz.pk Daily Job Ads: Connecting to Jobz.pk and solving security challenge...`);
        await page.goto('https://www.jobz.pk/', { waitUntil: 'networkidle2', timeout: 45000 });

        for (let i = 0; i < 20; i++) {
            const title = await page.title();
            if (!title.toLowerCase().includes('just a moment') && !title.toLowerCase().includes('attention')) break;
            await new Promise(r => setTimeout(r, 1000));
        }
        await new Promise(r => setTimeout(r, 2000));

        try {
            await page.waitForSelector('.row_container', { timeout: 15000 });
        } catch (_) {}

        // 1. Extract job links for the requested date
        const targetJobs = await page.evaluate((pat1, pat2, pat3) => {
            const rows = Array.from(document.querySelectorAll('.row_container'));
            const results = [];
            const seen = new Set();

            for (const row of rows) {
                const link = row.querySelector('a[href*="_jobs-"]');
                if (!link || !link.href) continue;
                const rText = row.innerText.toLowerCase();
                if (rText.includes(pat1) || rText.includes(pat2) || rText.includes(pat3)) {
                    if (!seen.has(link.href)) {
                        seen.add(link.href);
                        results.push({
                            title: link.innerText.trim(),
                            href: link.href
                        });
                    }
                }
            }
            return results;
        }, datePat1, datePat2, datePat3);

        log(`Jobz.pk Daily Job Ads: Found ${targetJobs.length} job advertisements published on ${formatted}. Extracting advert images...`);

        if (targetJobs.length > 0) {
            // 2. Fetch job advert images in parallel batches
            const fetchedList = await page.evaluate(async (jobs) => {
                const fetchBase64 = async (url) => {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000);
                        const res = await fetch(url, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        if (!res.ok) return null;
                        const blob = await res.blob();
                        if (blob.size < 5000) return null;
                        return await new Promise(resolve => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve({ size: blob.size, base64: reader.result });
                            reader.onerror = () => resolve(null);
                            reader.readAsDataURL(blob);
                        });
                    } catch(e) {
                        return null;
                    }
                };

                const batchSize = 6;
                const allImages = [];

                for (let i = 0; i < jobs.length; i += batchSize) {
                    const batch = jobs.slice(i, i + batchSize);
                    const batchResults = await Promise.all(batch.map(async (j) => {
                        try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 10000);
                            const res = await fetch(j.href, { signal: controller.signal });
                            clearTimeout(timeoutId);
                            if (!res.ok) return [];

                            const html = await res.text();
                            const matches = Array.from(html.matchAll(/src="([^"]*\/images\/jobs\/[^"]+)"/gi)).map(m => m[1]);
                            const uniqueUrls = Array.from(new Set(matches));

                            const imagesForJob = [];
                            for (let rawUrl of uniqueUrls) {
                                let fullUrl = rawUrl;
                                if (!fullUrl.startsWith('http')) {
                                    fullUrl = 'https://www.jobz.pk' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
                                }
                                const b64Res = await fetchBase64(fullUrl);
                                if (b64Res) {
                                    imagesForJob.push({
                                        title: j.title,
                                        size: b64Res.size,
                                        base64: b64Res.base64
                                    });
                                }
                            }
                            return imagesForJob;
                        } catch(e) {
                            return [];
                        }
                    }));

                    for (const r of batchResults) {
                        allImages.push(...r);
                    }
                }
                return allImages;
            }, targetJobs);

            for (const item of fetchedList) {
                if (item.base64 && item.base64.includes('base64,')) {
                    const buf = Buffer.from(item.base64.split('base64,')[1], 'base64');
                    if (buf.length > 5000 && isValidImage(buf)) {
                        pageBuffers.push(buf);
                        log(`Jobz.pk Daily Job Ads: [${pageBuffers.length}/${fetchedList.length}] Clipped Ad: ${item.title.slice(0, 36)} (${(buf.length / 1024).toFixed(0)} KB)`);
                    }
                }
            }
        }

        await browser.close();
        browser = null;
    } catch (err) {
        log(`Jobz.pk Daily Job Ads: Browser error - ${err.message}`);
    } finally {
        if (browser) try { await browser.close(); } catch (_) {}
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Jobz.pk Daily Job Ads: No job advert clippings found for ${formatted}.`);
    }

    const coverPath = path.join(__dirname, '..', 'assets', 'jobz_cover_page.png');
    if (fs.existsSync(coverPath)) {
        try {
            const coverBuf = fs.readFileSync(coverPath);
            pageBuffers.unshift(coverBuf);
            log(`Jobz.pk Daily Job Ads: Prepended cover page (jobz_cover_page.png) as Page 1`);
        } catch (cErr) {
            log(`Jobz.pk Daily Job Ads: Warning - Failed to read cover page: ${cErr.message}`);
        }
    }

    log(`Jobz.pk Daily Job Ads: Compiling all ${pageBuffers.length} advertisement clippings into comprehensive PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Jobz.pk',
        editionName: 'Daily Job Ads',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * Roznama 92 News (Islamabad, Lahore, Karachi)
 */
async function fetchRoznama92(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Islamabad';
    const outputFilename = `${dateObj.fileDate} Roznama 92 News ${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Roznama 92 News ${cleanCity}: Scraping broadsheet pages for ${formatted}...`);
    const pageBuffers = [];

    // Correct URL slug mapping matching Roznama 92 route encoding
    const stationSlugMap = {
        'islamabad': '%D8%A7%D8%B3%D9%84%D8%A7%D9%85-%D8%A7%D9%93%D8%A8%D8%A7%D8%AF',
        'lahore': '%D9%84%D8%A7%DB%81%D9%88%D8%B1',
        'karachi': '%DA%A9%D8%B1%D8%A7%DA%86%DB%8C'
    };
    const stationKeywords = {
        'islamabad': ['اسلام', 'islamabad'],
        'lahore': ['لاہور', 'lahore'],
        'karachi': ['کراچی', 'karachi']
    };

    let browser = null;
    try {
        const { connect } = require('puppeteer-real-browser');
        const connected = await connect({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            turnstile: true
        });
        browser = connected.browser;
        const page = connected.page;

        const slug = stationSlugMap[stationKey] || '%D8%A7%D8%B3%D9%84%D8%A7%D9%85-%D8%A7%D9%93%D8%A8%D8%A7%D8%AF';
        let targetUrl = `https://roznama92news.com/epaper/published/${year}-${month}-${day}/station/${slug}/page/%D9%BE%DB%81%D9%84%D8%A7-%D8%B5%D9%81%D8%AD%DB%81`;
        
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        for (let i = 0; i < 20; i++) {
            const title = await page.title();
            if (!title.includes('Just a moment')) break;
            await new Promise(r => setTimeout(r, 1000));
        }

        let pageLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .filter(a => a.href && a.href.includes('/page/'))
                .map(a => a.href);
        });
        pageLinks = Array.from(new Set(pageLinks));

        // Fallback: If direct date URL returned no pages, visit main epaper page to discover live edition link
        if (pageLinks.length === 0) {
            log(`Roznama 92 News ${cleanCity}: Direct URL had no pages, discovering live link from /epaper...`);
            await page.goto('https://roznama92news.com/epaper', { waitUntil: 'networkidle2', timeout: 35000 });
            for (let i = 0; i < 15; i++) {
                const title = await page.title();
                if (!title.includes('Just a moment')) break;
                await new Promise(r => setTimeout(r, 1000));
            }

            const kws = stationKeywords[stationKey] || ['اسلام'];
            const discoveredUrl = await page.evaluate((keywords) => {
                const anchors = Array.from(document.querySelectorAll('a'));
                const match = anchors.find(a => {
                    const href = a.href || '';
                    const text = (a.innerText || '').toLowerCase();
                    return href.includes('/published/') && keywords.some(k => text.includes(k) || decodeURIComponent(href).includes(k));
                });
                return match ? match.href : null;
            }, kws);

            if (discoveredUrl) {
                log(`Roznama 92 News ${cleanCity}: Found live edition URL: ${discoveredUrl}`);
                await page.goto(discoveredUrl, { waitUntil: 'networkidle2', timeout: 35000 });
                for (let i = 0; i < 15; i++) {
                    const title = await page.title();
                    if (!title.includes('Just a moment')) break;
                    await new Promise(r => setTimeout(r, 1000));
                }
                pageLinks = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('a'))
                        .filter(a => a.href && a.href.includes('/page/'))
                        .map(a => a.href);
                });
                pageLinks = Array.from(new Set(pageLinks));
            }
        }

        log(`Roznama 92 News ${cleanCity}: Found ${pageLinks.length} distinct page navigation links.`);

        const seenImageUrls = new Set();
        for (let i = 0; i < pageLinks.length; i++) {
            const pUrl = pageLinks[i];
            if (i > 0) {
                await page.goto(pUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            }

            // Wait for new broadsheet image to load and ensure it's not a duplicate
            let currentImgSrc = null;
            for (let attempt = 0; attempt < 20; attempt++) {
                currentImgSrc = await page.evaluate(() => {
                    const img = document.querySelector('.newspaper-image img, #newspaper_page img, .map-container img, img[src*="storage/newspaper"]');
                    if (img && img.src && img.complete && img.naturalWidth > 500) {
                        return img.src;
                    }
                    return null;
                });

                if (currentImgSrc && !seenImageUrls.has(currentImgSrc)) {
                    break;
                }
                await new Promise(r => setTimeout(r, 1000));
            }

            if (!currentImgSrc || seenImageUrls.has(currentImgSrc)) {
                log(`Roznama 92 News ${cleanCity}: Page ${i + 1} image not refreshed or duplicate (${currentImgSrc}), skipping duplicate.`);
                continue;
            }

            seenImageUrls.add(currentImgSrc);

            const b64 = await page.evaluate(async (src) => {
                try {
                    const res = await fetch(src);
                    const blob = await res.blob();
                    return await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    return null;
                }
            }, currentImgSrc);

            if (b64 && b64.includes('base64,')) {
                const buf = Buffer.from(b64.split('base64,')[1], 'base64');
                if (buf.length > 20000 && isValidImage(buf)) {
                    pageBuffers.push(buf);
                    log(`Roznama 92 News ${cleanCity}: [${pageBuffers.length}/${pageLinks.length}] Downloaded Page ${i + 1} (${(buf.length / 1024).toFixed(0)} KB)`);
                }
            }
        }
        await browser.close();
        browser = null;
    } catch (e) {
        log(`Roznama 92 News ${cleanCity}: Error - ${e.message}`);
    } finally {
        if (browser) try { await browser.close(); } catch(e) {}
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Roznama 92 News ${cleanCity}: No broadsheet pages found for ${formatted}.`);
    }

    log(`Roznama 92 News ${cleanCity}: Compiling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Roznama 92 News',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * Balochistan Times (Quetta, Islamabad, Karachi)
 */
async function fetchBalochistanTimes(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName ? cityName.replace(/[()]/g, '').trim() : 'Quetta';
    const outputFilename = `${dateObj.fileDate} Balochistan Times ${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Balochistan Times ${cleanCity}: Scraping broadsheet pages for ${formatted}...`);
    const pageBuffers = [];

    let browser = null;
    try {
        const { connect } = require('puppeteer-real-browser');
        const connected = await connect({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            turnstile: true
        });
        browser = connected.browser;
        const page = connected.page;

        let targetUrl = `https://www.balochistantimes.pk/epaper/published/${year}-${month}-${day}/station/${stationKey}/page/front-page`;
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });

        for (let i = 0; i < 15; i++) {
            const title = await page.title();
            if (!title.includes('Just a moment')) break;
            await new Promise(r => setTimeout(r, 1000));
        }

        let isServerError = await page.evaluate(() => document.title.includes('Server Error') || !!document.querySelector('.error-code'));
        let hasImg = await page.evaluate(() => !!document.querySelector('.newspaper-image img, #newspaper_page img, .map-container img, img[src*="storage/newspaper"]'));

        if (isServerError || !hasImg) {
            log(`Balochistan Times ${cleanCity}: Direct date URL not available for ${formatted}, checking station page for latest edition...`);
            const stationUrl = `https://www.balochistantimes.pk/epaper/station/${stationKey}`;
            await page.goto(stationUrl, { waitUntil: 'networkidle2', timeout: 35000 });
            await new Promise(r => setTimeout(r, 2000));

            const latestFrontPage = await page.evaluate(() => {
                const a = document.querySelector('a[href*="/epaper/published/"][href*="/page/front-page"]');
                return a ? a.href : null;
            });

            if (latestFrontPage) {
                log(`Balochistan Times ${cleanCity}: Found latest edition page: ${latestFrontPage}`);
                await page.goto(latestFrontPage, { waitUntil: 'networkidle2', timeout: 35000 });
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        let pageLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href*="/page/"]')).map(a => a.href);
        });
        pageLinks = Array.from(new Set(pageLinks));

        if (pageLinks.length === 0 && page.url().includes('/page/')) {
            pageLinks = [page.url()];
        }

        for (let i = 0; i < pageLinks.length; i++) {
            const pUrl = pageLinks[i];
            if (page.url() !== pUrl) {
                await page.goto(pUrl, { waitUntil: 'networkidle2', timeout: 25000 });
                await new Promise(r => setTimeout(r, 1500));
            }

            const b64 = await page.evaluate(async () => {
                const img = document.querySelector('.newspaper-image img, #newspaper_page img, .map-container img, img[src*="storage/newspaper"]');
                if (!img || !img.src) return null;
                try {
                    const res = await fetch(img.src);
                    if (!res.ok) return null;
                    const blob = await res.blob();
                    return await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    return null;
                }
            });

            if (b64 && b64.includes('base64,')) {
                const buf = Buffer.from(b64.split('base64,')[1], 'base64');
                if (buf.length > 20000 && isValidImage(buf)) {
                    pageBuffers.push(buf);
                    log(`Balochistan Times ${cleanCity}: [${pageBuffers.length}] Downloaded Page ${i + 1} (${(buf.length / 1024).toFixed(0)} KB)`);
                }
            }
        }
    } catch (e) {
        log(`Balochistan Times ${cleanCity}: Error - ${e.message}`);
    } finally {
        if (browser) try { await browser.close(); } catch(e) {}
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Balochistan Times ${cleanCity}: No broadsheet pages found for ${formatted}.`);
    }

    log(`Balochistan Times ${cleanCity}: Compiling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Balochistan Times',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * Daily Dak (Gujrat / National)
 * Direct PDF from https://dailydak.pk
 */
async function fetchDailyDak(dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Daily Dak Gujrat.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Dak Gujrat: Discovering direct PDF for ${formatted}...`);

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const dateFormattedParam = `${dStr}-${mStr}-${year}`;

    let pdfUrl = null;
    try {
        const targetUrl = `https://dailydak.pk/index.php?Date=${dateFormattedParam}`;
        const res = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(20000)
        });
        if (res.ok) {
            const html = await res.text();
            const match = html.match(/href=["'](getPDF\.php\?[^"']+)["']/i);
            if (match) {
                pdfUrl = `https://dailydak.pk/${match[1]}`;
            }
        }
    } catch (e) {
        log(`Daily Dak: Error finding PDF link on date page: ${e.message}`);
    }

    if (!pdfUrl) {
        try {
            const res = await fetch('https://dailydak.pk', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(20000)
            });
            if (res.ok) {
                const html = await res.text();
                const match = html.match(/href=["'](getPDF\.php\?[^"']+)["']/i);
                if (match) {
                    pdfUrl = `https://dailydak.pk/${match[1]}`;
                }
            }
        } catch (_) {}
    }

    if (!pdfUrl) {
        throw new Error(`Daily Dak: Could not find PDF download link for ${formatted}`);
    }

    log(`Daily Dak Gujrat: Downloading authentic complete broadsheet PDF from ${pdfUrl}...`);
    let pdfBuffer = null;
    try {
        const pdfRes = await fetch(pdfUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(120000)
        });
        if (pdfRes.ok) {
            pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
        }
    } catch (fErr) {
        log(`Daily Dak: Direct fetch slow or timed out (${fErr.message}), falling back to curl engine...`);
    }

    if (!pdfBuffer || pdfBuffer.length < 10000) {
        try {
            const { execSync } = require('child_process');
            pdfBuffer = execSync(`curl -s -L --max-time 120 -H "User-Agent: Mozilla/5.0" "${pdfUrl}"`, { maxBuffer: 50 * 1024 * 1024 });
        } catch (_) {}
    }

    if (!pdfBuffer || pdfBuffer.length < 10000) {
        throw new Error(`Daily Dak: Downloaded PDF is empty or invalid (${pdfBuffer ? pdfBuffer.length : 0} bytes)`);
    }

    log(`Daily Dak Gujrat: Successfully downloaded ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB PDF. Applying watermarks...`);
    return await assembleAndWatermarkPdf(pdfBuffer, {
        newspaperName: 'Daily Dak',
        editionName: 'Gujrat',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * Daily Ibrat (Hyderabad)
 * Multi-page broadsheet scraping & compilation from https://dailyibrat.com
 */
async function fetchDailyIbrat(dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Daily Ibrat Hyderabad.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Ibrat Hyderabad: Discovering direct broadsheet pages for ${formatted}...`);

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const searchDate = `${year}-${mStr}-${dStr}`;

    let html = null;
    const targetUrl = `https://dailyibrat.com/public/singlepaper?search_date=${searchDate}`;

    try {
        const res = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(25000)
        });
        if (res.ok) html = await res.text();
    } catch (_) {}

    if (!html) {
        try {
            const { execSync } = require('child_process');
            html = execSync(`curl -s -L --max-time 20 -H "User-Agent: Mozilla/5.0" "${targetUrl}"`, { encoding: 'utf8' });
        } catch (cErr) {
            log(`Daily Ibrat: Error fetching singlepaper via curl: ${cErr.message}`);
        }
    }

    let pageUrls = [];
    let pdfUrl = null;

    if (html) {
        const rawMatches = Array.from(html.matchAll(/storage\/images\/e-paper\/([a-zA-Z0-9_.-]+\.jpg)/gi)).map(m => m[1]);
        const uniqueFiles = [...new Set(rawMatches)];
        if (uniqueFiles.length > 0) {
            const sorted = uniqueFiles.sort((a, b) => {
                const numA = parseInt((a.split('_')[1] || '0').replace('.jpg', ''), 10);
                const numB = parseInt((b.split('_')[1] || '0').replace('.jpg', ''), 10);
                return numA - numB;
            });
            pageUrls = sorted.map(f => `https://dailyibrat.com/public/storage/images/e-paper/${f}`);
            log(`Daily Ibrat Hyderabad: Discovered ${pageUrls.length} broadsheet page images`);
        }

        const match = html.match(/generatepdf\/(\d+)/i);
        if (match) {
            pdfUrl = `https://dailyibrat.com/public/generatepdf/${match[1]}`;
        }
    }

    if (pdfUrl) {
        log(`Daily Ibrat Hyderabad: Downloading official high-definition vector PDF from ${pdfUrl}...`);
        try {
            const { execSync } = require('child_process');
            const pdfBuffer = execSync(`curl -s -L --max-time 90 -H "User-Agent: Mozilla/5.0" "${pdfUrl}"`, { maxBuffer: 100 * 1024 * 1024 });

            if (pdfBuffer && pdfBuffer.length > 50000) {
                log(`Daily Ibrat Hyderabad: Successfully downloaded ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB vector PDF. Applying watermarks...`);
                return await assembleAndWatermarkPdf(pdfBuffer, {
                    newspaperName: 'Daily Ibrat',
                    editionName: 'Hyderabad',
                    dateFormatted: formatted,
                    outputPath
                }, config);
            }
        } catch (eErr) {
            log(`Daily Ibrat Hyderabad: Vector PDF download note: ${eErr.message}. Falling back to image broadsheet pages.`);
        }
    }

    if (pageUrls.length > 0) {
        log(`Daily Ibrat Hyderabad: Downloading ${pageUrls.length} broadsheet page images in parallel...`);
        const browserHeader = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        };
        const pageBuffers = await Promise.all(pageUrls.map(async (u, idx) => {
            try {
                const pRes = await fetch(u, { headers: browserHeader, signal: AbortSignal.timeout(30000) });
                if (pRes.ok) {
                    const buf = Buffer.from(await pRes.arrayBuffer());
                    if (buf.length > 5000) {
                        log(`Daily Ibrat Hyderabad: [${idx + 1}/${pageUrls.length}] Page downloaded (${(buf.length / 1024).toFixed(0)} KB)`);
                        return buf;
                    }
                }
            } catch (_) {}

            const { execSync } = require('child_process');
            const cBuf = execSync(`curl -s -L --max-time 30 -H "User-Agent: Mozilla/5.0" "${u}"`, { maxBuffer: 10 * 1024 * 1024 });
            log(`Daily Ibrat Hyderabad: [${idx + 1}/${pageUrls.length}] Page downloaded via curl (${(cBuf.length / 1024).toFixed(0)} KB)`);
            return cBuf;
        }));

        log(`Daily Ibrat Hyderabad: Compiling all ${pageBuffers.length} pages into PDF...`);
        return await assembleAndWatermarkPdf(pageBuffers, {
            newspaperName: 'Daily Ibrat',
            editionName: 'Hyderabad',
            dateFormatted: formatted,
            outputPath
        }, config);
    }

    throw new Error(`Daily Ibrat: Could not find broadsheet pages or PDF download for ${formatted}`);
}

/**
 * The Frontier Post (Peshawar / National)
 */
async function fetchTheFrontierPost(dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} The Frontier Post Peshawar.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`The Frontier Post Peshawar: Discovering complete broadsheet PDF for ${formatted}...`);

    let pdfUrl = null;
    const dNum = parseInt(day, 10);
    const mNum = parseInt(month, 10);
    const y2 = String(year).slice(-2);
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');

    // 1. First try candidate direct upload URLs for exact date
    const candidates = [
        `https://thefrontierpost.com/wp-content/uploads/${year}/${mStr}/FP-Pages-${dNum}-${mNum}-${y2}-P.pdf`,
        `https://thefrontierpost.com/wp-content/uploads/${year}/${mStr}/FP-Pages-${dStr}-${mStr}-${y2}-P.pdf`,
        `https://thefrontierpost.com/wp-content/uploads/${year}/${mStr}/FP-Pages-${dNum}-${mNum}-${y2}.pdf`,
        `https://thefrontierpost.com/wp-content/uploads/${year}/${mStr}/FP-Pages-${dStr}-${mStr}-${y2}.pdf`,
        `https://thefrontierpost.com/wp-content/uploads/${year}/${mStr}/FP-${dNum}-${mNum}-${y2}-P.pdf`,
        `https://thefrontierpost.com/wp-content/uploads/${year}/${mStr}/FP-${dNum}-${mNum}-${y2}.pdf`,
        `https://thefrontierpost.com/wp-content/uploads/${year}/${mStr}/FP-${dStr}-${mStr}-${y2}.pdf`,
        `https://thefrontierpost.com/wp-content/uploads/${year}/${mStr}/Frontier-Post-${dNum}-${mNum}-${y2}.pdf`,
        `https://thefrontierpost.com/wp-content/uploads/${year}/${mStr}/Frontier-Post-${dStr}-${mStr}-${y2}.pdf`
    ];

    for (const c of candidates) {
        try {
            const headRes = await fetch(c, {
                method: 'HEAD',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(6000)
            });
            if (headRes.ok) {
                pdfUrl = c;
                log(`The Frontier Post Peshawar: Discovered candidate PDF URL: ${pdfUrl}`);
                break;
            }
        } catch (_) {}
    }

    // 2. Fallback: If not found in candidates, try scraping epaper-3 page (verifying date match)
    if (!pdfUrl) {
        try {
            const res = await fetch('https://thefrontierpost.com/epaper-3/', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(20000)
            });
            if (res.ok) {
                const html = await res.text();
                const unescaped = html.replace(/\\\//g, '/');
                const matches = unescaped.match(/https?:\/\/thefrontierpost\.com\/wp-content\/uploads\/[0-9]{4}\/[0-9]{2}\/[^"'\s<>]+\.pdf/gi);
                if (matches) {
                    for (const m of matches) {
                        if (m.includes(`${dNum}-${mNum}`) || m.includes(`${dStr}-${mStr}`) || m.includes(`${dNum}-${mStr}`)) {
                            pdfUrl = m;
                            log(`The Frontier Post Peshawar: Discovered live PDF URL matching date: ${pdfUrl}`);
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            log(`The Frontier Post: Error loading epaper-3 page: ${e.message}`);
        }
    }

    if (!pdfUrl) {
        throw new Error(`The Frontier Post: Could not find PDF download link for ${formatted}`);
    }

    log(`The Frontier Post Peshawar: Downloading complete broadsheet PDF from ${pdfUrl}...`);
    const pdfRes = await fetch(pdfUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(45000)
    });

    if (!pdfRes.ok) {
        throw new Error(`The Frontier Post: HTTP ${pdfRes.status} downloading PDF from ${pdfUrl}`);
    }

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    if (!pdfBuffer || pdfBuffer.length < 10000) {
        throw new Error(`The Frontier Post: Downloaded PDF is empty or invalid (${pdfBuffer ? pdfBuffer.length : 0} bytes)`);
    }

    log(`The Frontier Post Peshawar: Successfully downloaded ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB PDF. Applying watermarks...`);
    return await assembleAndWatermarkPdf(pdfBuffer, {
        newspaperName: 'The Frontier Post',
        editionName: 'Peshawar',
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * Pakistan Today (Islamabad, Lahore, Karachi)
 * High-resolution broadsheets from https://issuu.com/pakistantoday-paperazzi
 */
async function fetchPakistanToday(cityKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const cleanCity = cityName || (cityKey === 'isb' ? 'Islamabad' : (cityKey === 'khi' ? 'Karachi' : 'Lahore'));
    const outputFilename = `${dateObj.fileDate} Pakistan Today ${cleanCity}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Pakistan Today ${cleanCity}: Scraping high-resolution broadsheet pages for ${formatted}...`);

    const y2 = String(year).slice(-2);
    const mStr = String(month).padStart(2, '0');
    const dNum = parseInt(day, 10);
    const dStr = String(day).padStart(2, '0');
    const cKey = cityKey.toLowerCase();

    const candidateSlugs = [
        `epaper_${y2}-${mStr}-${dNum}_${cKey}`,
        `epaper_${y2}-${mStr}-${dStr}_${cKey}`,
        `epaper_${y2}-${parseInt(month, 10)}-${dNum}_${cKey}`
    ];

    let pubId = null;
    const browserHeader = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    };

    for (const slug of candidateSlugs) {
        try {
            const docUrl = `https://issuu.com/pakistantoday-paperazzi/docs/${slug}`;
            const res = await fetch(docUrl, { headers: browserHeader, signal: AbortSignal.timeout(10000) });
            if (res.ok) {
                const html = await res.text();
                const m = html.match(/https:\/\/image\.isu\.pub\/([a-zA-Z0-9_-]+)\/jpg\/page_1/i);
                if (m && m[1]) {
                    pubId = m[1];
                    log(`Pakistan Today ${cleanCity}: Found publication doc ID: ${pubId} (slug: ${slug})`);
                    break;
                }
            }
        } catch (_) {}
    }

    if (!pubId) {
        try {
            const profileUrl = 'https://issuu.com/pakistantoday-paperazzi';
            const res = await fetch(profileUrl, { headers: browserHeader, signal: AbortSignal.timeout(15000) });
            if (res.ok) {
                const html = await res.text();
                const regex = new RegExp(`/pakistantoday-paperazzi/docs/([a-zA-Z0-9_-]*${cKey}[a-zA-Z0-9_-]*)`, 'gi');
                const docMatches = Array.from(html.matchAll(regex)).map(m => m[1]);
                for (const dSlug of docMatches) {
                    if (dSlug.includes(String(dNum)) || dSlug.includes(dStr)) {
                        const dRes = await fetch(`https://issuu.com/pakistantoday-paperazzi/docs/${dSlug}`, { headers: browserHeader, signal: AbortSignal.timeout(10000) });
                        if (dRes.ok) {
                            const dHtml = await dRes.text();
                            const m = dHtml.match(/https:\/\/image\.isu\.pub\/([a-zA-Z0-9_-]+)\/jpg\/page_1/i);
                            if (m && m[1]) {
                                pubId = m[1];
                                log(`Pakistan Today ${cleanCity}: Discovered publication doc ID: ${pubId} from profile`);
                                break;
                            }
                        }
                    }
                }
            }
        } catch (pErr) {
            log(`Pakistan Today ${cleanCity}: Error scanning profile: ${pErr.message}`);
        }
    }

    if (!pubId) {
        throw new Error(`Pakistan Today ${cleanCity}: Could not find publication on Issuu for ${formatted}`);
    }

    const pageBuffers = [];
    const maxPages = 16;
    for (let p = 1; p <= maxPages; p++) {
        const pageUrl = `https://image.isu.pub/${pubId}/jpg/page_${p}.jpg`;
        try {
            const pRes = await fetch(pageUrl, { headers: browserHeader, signal: AbortSignal.timeout(15000) });
            if (!pRes.ok) {
                break;
            }
            const buf = Buffer.from(await pRes.arrayBuffer());
            if (buf && buf.length > 10000) {
                pageBuffers.push(buf);
                log(`Pakistan Today ${cleanCity}: [${p}] Downloaded broadsheet page (${(buf.length / 1024).toFixed(0)} KB)`);
            } else {
                break;
            }
        } catch (err) {
            log(`Pakistan Today ${cleanCity}: Finished downloading ${pageBuffers.length} pages (stopped on page ${p}: ${err.message})`);
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Pakistan Today ${cleanCity}: No pages could be retrieved for ${formatted}`);
    }

    log(`Pakistan Today ${cleanCity}: Compiling all ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Pakistan Today',
        editionName: cleanCity,
        dateFormatted: formatted,
        outputPath
    }, config);
}

/**
 * Nawa-i-Waqt (Islamabad, Lahore, Karachi, Multan)
 */
async function fetchNawaiwaqt(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Daily Nawa-i-Waqt ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`Daily Nawa-i-Waqt ${cityName}: Scraping broadsheet pages for ${formatted}...`);
    const pageBuffers = [];

    const dateStr = `${year}-${month}-${day}`;
    const stationSlug = stationKey.toLowerCase();

    for (let p = 1; p <= 30; p++) {
        const pageUrl = `https://www.nawaiwaqt.com.pk/E-Paper/${stationSlug}/${dateStr}/page-${p}`;
        try {
            const res = await fetch(pageUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) });
            if (!res.ok) break;
            const html = await res.text();
            if (!html || html.length < 500) break;

            const imgMatch = html.match(/https?:\/\/[^"'<>\s]+\/epaper_image\/large\/[^"'<>\s]+\.jpg/i) ||
                             html.match(/src=["']([^"']*epaper_image[^"']*\.jpg)["']/i);
            
            if (!imgMatch) {
                break;
            }

            let imgSrc = imgMatch[1] || imgMatch[0];
            if (!imgSrc.startsWith('http')) {
                imgSrc = `https://www.nawaiwaqt.com.pk${imgSrc.startsWith('/') ? '' : '/'}${imgSrc}`;
            }

            const buf = await fetchBufferDirect(imgSrc, pageUrl);
            if (isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`Daily Nawa-i-Waqt ${cityName}: [${pageBuffers.length}] Downloaded Page ${p} (${(buf.length / 1024).toFixed(0)} KB)`);
            } else {
                break;
            }
        } catch (e) {
            log(`Daily Nawa-i-Waqt ${cityName}: Stopped on page ${p}: ${e.message}`);
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`Daily Nawa-i-Waqt ${cityName}: No broadsheet pages found for ${formatted}.`);
    }

    log(`Daily Nawa-i-Waqt ${cityName}: Compiling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Nawa-i-Waqt',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

const NEWSPAPER_CATALOG = [
    // 1. English Broadsheets
    { id: 'brecorder', name: 'Business Recorder National', category: 'english', handler: (d, out, cfg, l) => fetchBusinessRecorder(d, out, cfg, l) },
    { id: 'dawn_khi', name: 'Dawn Karachi', category: 'english', handler: (d, out, cfg, l) => fetchDawn('dawn_khi', 'Karachi', d, out, cfg, l) },
    { id: 'dawn_editorials', name: 'Dawn Editorials', category: 'english', handler: (d, out, cfg, l) => fetchDawnEditorials(d, out, cfg, l) },
    { id: 'nation_lhr', name: 'The Nation Lahore', category: 'english', handler: (d, out, cfg, l) => fetchTheNation('nation_lhr', 'Lahore', d, out, cfg, l) },
    { id: 'nation_isb', name: 'The Nation Islamabad', category: 'english', handler: (d, out, cfg, l) => fetchTheNation('nation_isb', 'Islamabad', d, out, cfg, l) },
    { id: 'nation_khi', name: 'The Nation Karachi', category: 'english', handler: (d, out, cfg, l) => fetchTheNation('nation_khi', 'Karachi', d, out, cfg, l) },
    { id: 'nation_qta', name: 'The Nation Quetta', category: 'english', handler: (d, out, cfg, l) => fetchTheNation('nation_qta', 'Quetta', d, out, cfg, l) },
    { id: 'thenews_khi', name: 'The News Karachi', category: 'english', handler: (d, out, cfg, l) => fetchTheNews('thenews_khi', 'Karachi', d, out, cfg, l) },
    { id: 'thenews_lhr', name: 'The News Lahore', category: 'english', handler: (d, out, cfg, l) => fetchTheNews('thenews_lhr', 'Lahore', d, out, cfg, l) },
    { id: 'thenews_isb', name: 'The News Islamabad / Rawalpindi', category: 'english', handler: (d, out, cfg, l) => fetchTheNews('thenews_isb', 'Islamabad', d, out, cfg, l) },
    { id: 'leadpakistan_nat', name: 'Daily Lead Pakistan National', category: 'english', handler: (d, out, cfg, l) => fetchDailyLeadPakistan(d, out, cfg, l) },
    { id: 'pak_observer_isb', name: 'Pakistan Observer Islamabad', category: 'english', handler: (d, out, cfg, l) => fetchPakistanObserver('pak_observer_isb', 'Islamabad', d, out, cfg, l) },
    { id: 'pak_observer_lhr', name: 'Pakistan Observer Lahore', category: 'english', handler: (d, out, cfg, l) => fetchPakistanObserver('pak_observer_lhr', 'Lahore', d, out, cfg, l) },
    { id: 'pak_observer_khi', name: 'Pakistan Observer Karachi', category: 'english', handler: (d, out, cfg, l) => fetchPakistanObserver('pak_observer_khi', 'Karachi', d, out, cfg, l) },
    { id: 'balochistan_qta', name: 'Balochistan Times Quetta', category: 'english', handler: (d, out, cfg, l) => fetchBalochistanTimes('quetta', 'Quetta', d, out, cfg, l) },
    { id: 'balochistan_isb', name: 'Balochistan Times Islamabad', category: 'english', handler: (d, out, cfg, l) => fetchBalochistanTimes('islamabad', 'Islamabad', d, out, cfg, l) },
    { id: 'balochistan_khi', name: 'Balochistan Times Karachi', category: 'english', handler: (d, out, cfg, l) => fetchBalochistanTimes('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'express_tribune', name: 'The Express Tribune National', category: 'english', handler: (d, out, cfg, l) => fetchExpressTribune('National', d, out, cfg, l) },
    { id: 'frontierpost_pesh', name: 'The Frontier Post Peshawar', category: 'english', handler: (d, out, cfg, l) => fetchTheFrontierPost(d, out, cfg, l) },
    { id: 'pktoday_isb', name: 'Pakistan Today Islamabad', category: 'english', handler: (d, out, cfg, l) => fetchPakistanToday('isb', 'Islamabad', d, out, cfg, l) },
    { id: 'pktoday_lhr', name: 'Pakistan Today Lahore', category: 'english', handler: (d, out, cfg, l) => fetchPakistanToday('lhr', 'Lahore', d, out, cfg, l) },
    { id: 'pktoday_khi', name: 'Pakistan Today Karachi', category: 'english', handler: (d, out, cfg, l) => fetchPakistanToday('khi', 'Karachi', d, out, cfg, l) },
    { id: 'dailytimes_nat', name: 'Daily Times National', category: 'english', handler: (d, out, cfg, l) => fetchDailyTimes('lahore', 'Lahore', d, out, cfg, l) },

    // 2. Urdu Broadsheets
    { id: 'nawaiwaqt_lhr', name: 'Daily Nawa-i-Waqt Lahore', category: 'urdu', handler: (d, out, cfg, l) => fetchNawaiwaqt('lahore', 'Lahore', d, out, cfg, l) },
    { id: 'nawaiwaqt_isb', name: 'Daily Nawa-i-Waqt Islamabad', category: 'urdu', handler: (d, out, cfg, l) => fetchNawaiwaqt('islamabad', 'Islamabad', d, out, cfg, l) },
    { id: 'nawaiwaqt_khi', name: 'Daily Nawa-i-Waqt Karachi', category: 'urdu', handler: (d, out, cfg, l) => fetchNawaiwaqt('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'nawaiwaqt_mux', name: 'Daily Nawa-i-Waqt Multan', category: 'urdu', handler: (d, out, cfg, l) => fetchNawaiwaqt('multan', 'Multan', d, out, cfg, l) },
    { id: '92news_isb', name: 'Roznama 92 News Islamabad', category: 'urdu', handler: (d, out, cfg, l) => fetchRoznama92('islamabad', 'Islamabad', d, out, cfg, l) },
    { id: '92news_lhr', name: 'Roznama 92 News Lahore', category: 'urdu', handler: (d, out, cfg, l) => fetchRoznama92('lahore', 'Lahore', d, out, cfg, l) },
    { id: '92news_khi', name: 'Roznama 92 News Karachi', category: 'urdu', handler: (d, out, cfg, l) => fetchRoznama92('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'juraat_khi', name: 'Daily Juraat Karachi', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyJuraat('juraat_khi', 'Karachi', d, out, cfg, l) },
    { id: 'ausaf_isb', name: 'Daily Ausaf Islamabad', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('islamabad', 'Islamabad', d, out, cfg, l) },
    { id: 'ausaf_lhr', name: 'Daily Ausaf Lahore', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('lahore', 'Lahore', d, out, cfg, l) },
    { id: 'ausaf_khi', name: 'Daily Ausaf Karachi', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'ausaf_mzd', name: 'Daily Ausaf Muzaffarabad / Kashmir', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('muzaffarabad', 'Muzaffarabad', d, out, cfg, l) },
    { id: 'ausaf_pesh', name: 'Daily Ausaf Peshawar', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('peshawar', 'Peshawar', d, out, cfg, l) },
    { id: 'ausaf_glt', name: 'Daily Ausaf Gilgit Baltistan', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('gilgit', 'Gilgit', d, out, cfg, l) },
    { id: 'ausaf_eur', name: 'Daily Ausaf Europe', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyAusaf('europe', 'Europe', d, out, cfg, l) },
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
    { id: 'dailydak_gujrat', name: 'Daily Dak Gujrat', category: 'urdu', handler: (d, out, cfg, l) => fetchDailyDak(d, out, cfg, l) },
    { id: 'ibrat_hyd', name: 'Daily Ibrat Hyderabad', category: 'regional', handler: (d, out, cfg, l) => fetchDailyIbrat(d, out, cfg, l) },

    // 3. Classified Ads
    { id: 'jobz_pk', name: 'Jobz.pk - Daily Job Ads', category: 'jobs', handler: (d, out, cfg, l) => fetchJobAds(d, out, cfg, l) }
];

module.exports = {
    NEWSPAPER_CATALOG,
    fetchBusinessRecorder,
    fetchDawn,
    fetchDawnEditorials,
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
    fetchRoznama92,
    fetchBalochistanTimes,
    fetchJobAds,
    fetchDailyDak,
    fetchDailyIbrat,
    fetchTheFrontierPost,
    fetchPakistanToday,
    fetchNawaiwaqt
};

