/**
 * scrapers/khalikScrapers.js
 * Dedicated Scraper Engine & Catalog for "Khalik" Section Newspapers.
 * Total 55 Editions across 9 major publication networks.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { assembleAndWatermarkPdf } = require('../services/pdfAssembler');

let connectRealBrowser = null;
try {
    const { connect } = require('puppeteer-real-browser');
    connectRealBrowser = connect;
} catch (_) {}

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
};

function isValidImage(buf) {
    if (!buf || buf.length < 3000) return false;
    const isJpg = buf[0] === 0xFF && buf[1] === 0xD8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
    const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
    return isJpg || isPng || isGif || isWebp;
}

function fetchBufferDirect(urlStr, referer = '', timeoutMs = 8000) {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(urlStr);
            const mod = parsed.protocol === 'https:' ? https : http;
            const headers = { ...BROWSER_HEADERS };
            if (referer) headers['Referer'] = referer;

            const req = mod.get(urlStr, { headers, rejectUnauthorized: false }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    let loc = res.headers.location;
                    if (!loc.startsWith('http')) {
                        loc = new URL(loc, urlStr).href;
                    }
                    return resolve(fetchBufferDirect(loc, referer, timeoutMs));
                }
                if (res.statusCode !== 200) return resolve(null);
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            });
            req.on('error', () => resolve(null));
            req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
        } catch (_) {
            resolve(null);
        }
    });
}

function fetchTextDirect(urlStr, referer = '', timeoutMs = 8000) {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(urlStr);
            const mod = parsed.protocol === 'https:' ? https : http;
            const headers = { ...BROWSER_HEADERS };
            if (referer) headers['Referer'] = referer;

            const req = mod.get(urlStr, { headers, rejectUnauthorized: false }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    let loc = res.headers.location;
                    if (!loc.startsWith('http')) loc = new URL(loc, urlStr).href;
                    return resolve(fetchTextDirect(loc, referer, timeoutMs));
                }
                if (res.statusCode !== 200) return resolve(null);
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', () => resolve(null));
            req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
        } catch (_) { resolve(null); }
    });
}

// ── 1. DAILY JANG (5 Editions) ─────────────────────────────────────────────
async function fetchKhalikJang(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Daily Jang ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`[Khalik] Daily Jang ${cityName}: Scraping epaper for ${formatted}...`);
    const pageBuffers = [];

    const mStr = parseInt(month, 10);
    const dStr = parseInt(day, 10);
    const yStr = year;

    for (let p = 1; p <= 30; p++) {
        const urls = [
            `https://e.jang.com.pk/static_pages/${mStr}-${dStr}-${yStr}/${stationKey}/mainpage/page${p}.jpg`,
            `https://wsrv.nl/?url=e.jang.com.pk/static_pages/${mStr}-${dStr}-${yStr}/${stationKey}/mainpage/page${p}.jpg`,
            `https://images.weserv.nl/?url=e.jang.com.pk/static_pages/${mStr}-${dStr}-${yStr}/${stationKey}/mainpage/page${p}.jpg`
        ];

        let buf = null;
        for (const u of urls) {
            buf = await fetchBufferDirect(u, 'https://e.jang.com.pk/', 6000);
            if (buf && isValidImage(buf)) break;
        }

        if (buf && isValidImage(buf)) {
            pageBuffers.push(buf);
            log(`[Khalik] Daily Jang ${cityName}: Page ${p} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
        } else if (p > 4) {
            break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`[Khalik] Daily Jang ${cityName}: No pages found for ${formatted}.`);
    }

    log(`[Khalik] Daily Jang ${cityName}: Assembling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Jang',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

// ── 2. ROZNAMA DUNYA (6 Editions) ───────────────────────────────────────────
async function fetchKhalikDunya(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Roznama Dunya ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`[Khalik] Roznama Dunya ${cityName}: Scraping epaper for ${formatted}...`);
    const pageBuffers = [];

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yymmdd = `${year}-${mStr}-${dStr}`;

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = MONTHS[parseInt(month, 10) - 1];

    const indexUrl = `https://e.dunya.com.pk/index.php?e_name=${stationKey}&edate=${yymmdd}`;
    const rawHtml = await fetchTextDirect(indexUrl, 'https://e.dunya.com.pk/');

    if (rawHtml) {
        // Match broadsheet full page images (e.g. news/.../LHR/x364125_34496906.jpg.pagespeed.ic....jpg)
        const regex = new RegExp(`news/[^\\s"'<>]+/${stationKey}/x\\d+_[^\\s"'<>]+`, 'gi');
        const matches = Array.from(rawHtml.matchAll(regex)).map(m => m[0]);
        const uniqueMatches = Array.from(new Set(matches)).filter(m => !m.includes('detail_img') && !m.includes('colum_img'));

        for (let relUrl of uniqueMatches) {
            if (relUrl.startsWith('/')) relUrl = relUrl.slice(1);
            const fullUrl = `https://e.dunya.com.pk/${relUrl}`;
            const buf = await fetchBufferDirect(fullUrl, indexUrl, 15000);
            if (buf && isValidImage(buf) && buf.length >= 100000) {
                pageBuffers.push(buf);
                log(`[Khalik] Roznama Dunya ${cityName}: Page ${pageBuffers.length} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
            }
        }
    }

    // Fallback direct loop if regex yields 0
    if (pageBuffers.length === 0) {
        for (let p = 1; p <= 24; p++) {
            const urls = [
                `https://e.dunya.com.pk/detail_img.php?e_name=${stationKey}&edate=${yymmdd}&page=${p}`,
                `https://wsrv.nl/?url=e.dunya.com.pk/pages/${yymmdd}/${stationKey}/page${p}.jpg`
            ];
            let buf = null;
            for (const u of urls) {
                buf = await fetchBufferDirect(u, 'https://e.dunya.com.pk/', 6000);
                if (buf && isValidImage(buf)) break;
            }
            if (buf && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`[Khalik] Roznama Dunya ${cityName}: Page ${p} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
            } else if (p > 4) break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`[Khalik] Roznama Dunya ${cityName}: No pages found for ${formatted}.`);
    }

    log(`[Khalik] Roznama Dunya ${cityName}: Assembling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Roznama Dunya',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

// ── 3. DAILY EXPRESS (11 Editions) ─────────────────────────────────────────
async function fetchKhalikExpress(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Daily Express ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`[Khalik] Daily Express ${cityName}: Scraping epaper for ${formatted}...`);
    const pageBuffers = [];

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yyyymmdd = `${year}${mStr}${dStr}`;

    const indexUrl = `https://www.express.com.pk/epaper/Index.aspx?Issue=${stationKey}&Date=${yyyymmdd}`;
    const html = await fetchTextDirect(indexUrl, 'https://www.express.com.pk/');

    if (html) {
        const regex = new RegExp(`/images/${stationKey}/${yyyymmdd}/${yyyymmdd}-${stationKey}-[a-zA-Z0-9_-]+\\.jpg`, 'gi');
        const matches = Array.from(html.matchAll(regex)).map(m => m[0]);
        const uniqueFulls = Array.from(new Set(matches.map(s => s.replace('-thumb', ''))));

        for (const relUrl of uniqueFulls) {
            const fullUrl = `https://www.express.com.pk${relUrl}`;
            const buf = await fetchBufferDirect(fullUrl, indexUrl, 8000);
            if (buf && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`[Khalik] Daily Express ${cityName}: Page ${pageBuffers.length} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
            }
        }
    }

    // Fallback static pointer loop
    if (pageBuffers.length === 0) {
        for (let p = 1; p <= 24; p++) {
            const pNum = String(p).padStart(3, '0');
            const u = `https://www.express.com.pk/epaper/images/Pointers/${yyyymmdd}/${stationKey}_${pNum}_${yyyymmdd}_0.jpg`;
            const buf = await fetchBufferDirect(u, 'https://www.express.com.pk/', 6000);
            if (buf && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`[Khalik] Daily Express ${cityName}: Page ${p} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
            } else if (p > 4) break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`[Khalik] Daily Express ${cityName}: No pages found for ${formatted}.`);
    }

    log(`[Khalik] Daily Express ${cityName}: Assembling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Express',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

// ── 4. DAILY K2 (4 Editions) ────────────────────────────────────────────────
async function fetchKhalikDailyK2(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Daily K2 ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`[Khalik] Daily K2 ${cityName}: Scraping epaper for ${formatted}...`);
    const pageBuffers = [];

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const dateFormattedYMD = `${year}-${mStr}-${dStr}`;

    const pageUrl = `https://epaper.dailyk2.com/${stationKey}/${dateFormattedYMD}/page1`;
    const html = await fetchTextDirect(pageUrl, 'https://epaper.dailyk2.com/');

    if (html) {
        const matches = Array.from(html.matchAll(/src=["'](https:\/\/epaper\.dailyk2\.com\/uploads\/[^"']+\.jpg)["']/gi)).map(m => m[1]);
        const uniqueImgs = Array.from(new Set(matches));

        for (const imgUrl of uniqueImgs) {
            const buf = await fetchBufferDirect(imgUrl, pageUrl, 8000);
            if (buf && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`[Khalik] Daily K2 ${cityName}: Page ${pageBuffers.length} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
            }
        }
    }

    if (pageBuffers.length === 0) {
        for (let p = 1; p <= 12; p++) {
            const u = `https://epaper.dailyk2.com/uploads/${stationKey}/${year}/${dateFormattedYMD}/${dateFormattedYMD}-page${p}.jpg`;
            const buf = await fetchBufferDirect(u, pageUrl, 6000);
            if (buf && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`[Khalik] Daily K2 ${cityName}: Page ${p} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
            } else if (p > 4) break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`[Khalik] Daily K2 ${cityName}: No pages found for ${formatted}.`);
    }

    log(`[Khalik] Daily K2 ${cityName}: Assembling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily K2',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

// ── 5. JEHAN PAKISTAN (5 Editions) ─────────────────────────────────────────
async function fetchKhalikJehanPakistan(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Jehan Pakistan ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`[Khalik] Jehan Pakistan ${cityName}: Scraping epaper for ${formatted}...`);
    const pageBuffers = [];

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yShort = String(year).slice(-2);
    const ddmmyy = `${dStr}${mStr}${yShort}`;

    const editionUrl = `https://jehanpakistan.com/epaper/epaper.php?edition=${stationKey}&date=${ddmmyy}`;
    const html = await fetchTextDirect(editionUrl, 'https://jehanpakistan.com/epaper/');

    if (html) {
        const matches = Array.from(html.matchAll(/[\"']([^\"']*thumb_[^\"']+\.jpg)[\"']/gi)).map(m => m[1]);
        const uniqueFulls = Array.from(new Set(matches.map(m => {
            let clean = m.replace(/^https?:\/\/jehanpakistan\.com/i, '');
            if (!clean.startsWith('/')) clean = '/' + clean;
            return clean.replace('thumb_', '');
        })));

        for (const relUrl of uniqueFulls) {
            const fullUrl = `https://jehanpakistan.com${relUrl}`;
            const buf = await fetchBufferDirect(fullUrl, editionUrl, 8000);
            if (buf && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`[Khalik] Jehan Pakistan ${cityName}: Page ${pageBuffers.length} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
            }
        }
    }

    // Direct loop fallback if HTML extraction yields 0
    if (pageBuffers.length === 0) {
        for (let p = 1; p <= 16; p++) {
            const urls = [
                `https://jehanpakistan.com/epaper/epaper/${stationKey}/${yymmdd}/main_p${p}.jpg`,
                `https://jehanpakistan.com/epaper/epaper/${stationKey}/${yymmdd}/p${p}.jpg`
            ];

            let buf = null;
            for (const u of urls) {
                buf = await fetchBufferDirect(u, 'https://jehanpakistan.com/epaper/', 6000);
                if (buf && isValidImage(buf)) break;
            }

            if (buf && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`[Khalik] Jehan Pakistan ${cityName}: Page ${p} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
            } else if (p > 4) break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`[Khalik] Jehan Pakistan ${cityName}: No pages found for ${formatted}.`);
    }

    log(`[Khalik] Jehan Pakistan ${cityName}: Assembling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Jehan Pakistan',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

// ── 6. DAILY JINNAH (5 Editions) ────────────────────────────────────────────
async function fetchKhalikDailyJinnah(stationKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Daily Jinnah ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`[Khalik] Daily Jinnah ${cityName}: Scraping epaper for ${formatted}...`);
    const pageBuffers = [];

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const dateFormattedDMY = `${dStr}-${mStr}-${year}`;

    for (let p = 1; p <= 16; p++) {
        const u = `http://dailyjinnah.com/assets/${stationKey}/${dateFormattedDMY}/${p}.jpg`;
        const buf = await fetchBufferDirect(u, 'http://dailyjinnah.com/epaper/', 6000);

        if (buf && isValidImage(buf)) {
            pageBuffers.push(buf);
            log(`[Khalik] Daily Jinnah ${cityName}: Page ${p} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
        } else if (p > 4) break;
    }

    if (pageBuffers.length === 0) {
        throw new Error(`[Khalik] Daily Jinnah ${cityName}: No pages found for ${formatted}.`);
    }

    log(`[Khalik] Daily Jinnah ${cityName}: Assembling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Jinnah',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

// ── 7. ROZNAMA SAHAFAT (5 Editions) ────────────────────────────────────────
async function fetchKhalikSahafat(cityKey, prefixKey, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Roznama Sahafat ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`[Khalik] Roznama Sahafat ${cityName}: Scraping epaper for ${formatted}...`);
    const pageBuffers = [];

    const MONTHS_SHORT_LOWER = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const dStr = String(day).padStart(2, '0');
    const mStr = MONTHS_SHORT_LOWER[parseInt(month, 10) - 1];

    for (let p = 1; p <= 16; p++) {
        const u = `https://sahafat.com.pk/epaper ${cityKey}/${year}/${mStr}/${dStr}/${prefixKey}${p}.jpg`;
        const encodedUrl = encodeURI(u);
        const buf = await fetchBufferDirect(encodedUrl, 'https://sahafat.com.pk/', 6000);

        if (buf && isValidImage(buf)) {
            pageBuffers.push(buf);
            log(`[Khalik] Roznama Sahafat ${cityName}: Page ${p} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
        } else if (p > 4) break;
    }

    if (pageBuffers.length === 0) {
        throw new Error(`[Khalik] Roznama Sahafat ${cityName}: No pages found for ${formatted}.`);
    }

    log(`[Khalik] Roznama Sahafat ${cityName}: Assembling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Roznama Sahafat',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

// ── 8 & 9. DAILY PAKISTAN (.com.pk & .pk - 14 Editions) ──────────────────────
async function fetchKhalikDailyPakistan(stationSlug, cityName, dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Daily Pakistan ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`[Khalik] Daily Pakistan ${cityName}: Scraping epaper for ${formatted}...`);
    const pageBuffers = [];

    const targetUrl = `https://dailypakistan.pk/epaper/latest-edition-${stationSlug}`;
    const html = await fetchTextDirect(targetUrl, 'https://dailypakistan.pk/epaper/') || await fetchTextDirect('https://dailypakistan.pk/epaper/', 'https://google.com');

    if (html) {
        const matches = Array.from(html.matchAll(/https:\/\/dailypakistan\.pk\/epaper\/wp-content\/uploads\/[^\s"'<>]+\.jpg/gi)).map(m => m[0]);
        const validMatches = matches.filter(u => {
            const lower = u.toLowerCase();
            if (lower.includes('logo') || lower.includes('cropped') || lower.includes('icon') || lower.includes('banner')) return false;
            return true;
        });

        const fullImgs = Array.from(new Set(validMatches.map(u => u.replace(/-\d+x\d+\.jpg$/i, '.jpg'))));

        for (const imgUrl of fullImgs) {
            const buf = await fetchBufferDirect(imgUrl, targetUrl, 8000);
            // Require buffer size >= 250 KB (broadsheet pages are > 400 KB) to exclude cover icons/small thumbnails
            if (buf && isValidImage(buf) && buf.length >= 250000) {
                pageBuffers.push(buf);
                log(`[Khalik] Daily Pakistan ${cityName}: Page ${pageBuffers.length} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
            }
        }
    }

    // Direct fallback loop if regex yielded 0
    if (pageBuffers.length === 0) {
        const mStr = String(month).padStart(2, '0');
        for (let p = 1; p <= 16; p++) {
            const urls = [
                `https://dailypakistan.pk/epaper/wp-content/uploads/${year}/${mStr}/${p}-${stationSlug}.jpg`,
                `https://dailypakistan.pk/epaper/wp-content/uploads/${year}/${mStr}/${stationSlug}-${p}.jpg`
            ];
            let buf = null;
            for (const u of urls) {
                buf = await fetchBufferDirect(u, targetUrl, 6000);
                if (buf && isValidImage(buf)) break;
            }
            if (buf && isValidImage(buf)) {
                pageBuffers.push(buf);
                log(`[Khalik] Daily Pakistan ${cityName}: Page ${p} downloaded (${(buf.length / 1024).toFixed(0)} KB).`);
            } else if (p > 4) break;
        }
    }

    if (pageBuffers.length === 0) {
        throw new Error(`[Khalik] Daily Pakistan ${cityName}: No pages found for ${formatted}.`);
    }

    log(`[Khalik] Daily Pakistan ${cityName}: Assembling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Daily Pakistan',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

// ── 10. ROZNAMA 92 NEWS COLUMNS / EDITORIAL ───────────────────────────────
async function fetchKhalik92NewsColumns(dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Roznama 92 Columns.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`[Khalik] Roznama 92 Columns: Scraping editorial columns for ${formatted}...`);
    const pageBuffers = [];

    // 1. Add Cover Page
    const coverPath = path.join(__dirname, 'assets', '92_news_columns_cover.jpg');
    if (fs.existsSync(coverPath)) {
        try {
            const coverBuf = fs.readFileSync(coverPath);
            pageBuffers.push(coverBuf);
            log(`[Khalik] Roznama 92 Columns: Added cover page (Page 1).`);
        } catch (cErr) {
            log(`[Khalik] Roznama 92 Columns: Warning loading cover page: ${cErr.message}`);
        }
    }

    if (!connectRealBrowser) {
        throw new Error(`[Khalik] Roznama 92 Columns: puppeteer-real-browser is required to bypass Cloudflare.`);
    }

    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const datePath = `${year}-${mStr}-${dStr}`;

    const targetUrl = encodeURI(`https://roznama92news.com/epaper/published/${datePath}/station/لاہور/page/ایڈیٹوریل`);

    log(`[Khalik] Roznama 92 Columns: Launching browser for Cloudflare bypass...`);
    const { page, browser } = await connectRealBrowser({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        turnstile: true,
        connectOption: { defaultViewport: null }
    });

    try {
        log(`[Khalik] Roznama 92 Columns: Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 4000));

        let html = await page.content();
        let matches = [...new Set(html.match(/https?:\/\/[^\s"'"'"']+\/storage\/cutting\/image\/[^\s"'"'"']+/gi) || [])];

        if (matches.length === 0) {
            const fallbackUrl = `https://roznama92news.com/epaper/d/${datePath}/lahore/4`;
            log(`[Khalik] Roznama 92 Columns: Primary page yield 0 cuttings. Trying fallback ${fallbackUrl}...`);
            await page.goto(fallbackUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            await new Promise(r => setTimeout(r, 4000));
            html = await page.content();
            matches = [...new Set(html.match(/https?:\/\/[^\s"'"'"']+\/storage\/cutting\/image\/[^\s"'"'"']+/gi) || [])];
        }

        log(`[Khalik] Roznama 92 Columns: Discovered ${matches.length} candidate cutting image URLs.`);

        const cuttingBuffers = [];
        for (let i = 0; i < matches.length; i++) {
            const imgUrl = matches[i];
            try {
                const b64 = await page.evaluate(async (url) => {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(blob);
                    });
                }, imgUrl);

                const buf = Buffer.from(b64, 'base64');
                if (isValidImage(buf) && buf.length >= 30000) {
                    cuttingBuffers.push(buf);
                    log(`[Khalik] Roznama 92 Columns: [${cuttingBuffers.length}] Captured Column Clipping (${(buf.length / 1024).toFixed(0)} KB)`);
                }
            } catch (err) {
                log(`[Khalik] Roznama 92 Columns: Error downloading clipping ${i+1}: ${err.message}`);
            }
        }

        pageBuffers.push(...cuttingBuffers);
    } finally {
        try { await browser.close(); } catch (_) {}
    }

    if (pageBuffers.length <= 1) {
        throw new Error(`[Khalik] Roznama 92 Columns: No column clipping images found for ${formatted}.`);
    }

    log(`[Khalik] Roznama 92 Columns: Assembling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Roznama 92 Columns',
        editionName: 'Lahore',
        dateFormatted: formatted,
        outputPath
    }, config);
}

// ── 11. DAILY EXPRESS COLUMNS / EDITORIAL ───────────────────────────────
async function fetchKhalikExpressColumns(stationKey = 'NP_ISB', cityName = 'Islamabad', dateObj, outputDir, config, log) {
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Express Columns ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`[Khalik] Express Columns ${cityName}: Scraping editorial columns for ${formatted}...`);
    const pageBuffers = [];

    // 1. Add Cover Page
    const coverPath = path.join(__dirname, 'assets', 'express_columns_cover.jpg');
    if (fs.existsSync(coverPath)) {
        try {
            const coverBuf = fs.readFileSync(coverPath);
            pageBuffers.push(coverBuf);
            log(`[Khalik] Express Columns ${cityName}: Added cover page (Page 1).`);
        } catch (cErr) {
            log(`[Khalik] Express Columns ${cityName}: Warning loading cover page: ${cErr.message}`);
        }
    }

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yyyymmdd = `${year}${mStr}${dStr}`;

    const indexUrl = `https://www.express.com.pk/epaper/Index.aspx?Issue=${stationKey}&Page=Editorial_PageC006&Date=${yyyymmdd}&Pageno=6`;
    let html = await fetchTextDirect(indexUrl, 'https://www.express.com.pk/');
    if (!html || !html.includes('newsID=')) {
        const thumbUrl = `https://www.express.com.pk/epaper/thumbnails.aspx?Issue=${stationKey}&Page=Editorial_PageC006&Date=${yyyymmdd}&Pageno=6`;
        html = await fetchTextDirect(thumbUrl, 'https://www.express.com.pk/');
    }

    if (html) {
        const newsIdMatches = Array.from(html.matchAll(/newsID=(\d+)/gi)).map(m => m[1]);
        const uniqueNewsIds = [...new Set(newsIdMatches)];
        log(`[Khalik] Express Columns ${cityName}: Found ${uniqueNewsIds.length} candidate column newsIDs.`);

        for (const id of uniqueNewsIds) {
            const popupUrl = `https://www.express.com.pk/epaper/PoPupwindow.aspx?newsID=${id}&Issue=${stationKey}&Date=${yyyymmdd}`;
            const popupHtml = await fetchTextDirect(popupUrl, indexUrl);
            const subImageMatches = Array.from((popupHtml || '').matchAll(/Sub_Images\/[^"'\s>]+/gi)).map(m => m[0]);
            
            let capturedForThisId = 0;
            const fetchedUrls = new Set();

            for (const subRel of subImageMatches) {
                const imgUrl = subRel.startsWith('http') ? subRel : `https://www.express.com.pk/images/${stationKey}/${yyyymmdd}/${subRel}`;
                if (fetchedUrls.has(imgUrl)) continue;
                fetchedUrls.add(imgUrl);

                const buf = await fetchBufferDirect(imgUrl, popupUrl, 8000);
                if (buf && isValidImage(buf)) {
                    pageBuffers.push(buf);
                    capturedForThisId++;
                    log(`[Khalik] Express Columns ${cityName}: Captured column clipping (${(buf.length / 1024).toFixed(0)} KB) -> ${imgUrl.split('/').pop()}`);
                }
            }

            // Fallback for sub-images if popup HTML did not return them
            if (capturedForThisId === 0) {
                for (let sub = 1; sub <= 4; sub++) {
                    for (const ext of ['jpg', 'gif', 'png']) {
                        const fallbackUrl = `https://www.express.com.pk/images/${stationKey}/${yyyymmdd}/Sub_Images/${id}-${sub}.${ext}`;
                        if (fetchedUrls.has(fallbackUrl)) continue;
                        fetchedUrls.add(fallbackUrl);

                        const buf = await fetchBufferDirect(fallbackUrl, indexUrl, 8000);
                        if (buf && isValidImage(buf)) {
                            pageBuffers.push(buf);
                            capturedForThisId++;
                            log(`[Khalik] Express Columns ${cityName}: Captured column clipping ${id}-${sub}.${ext} (${(buf.length / 1024).toFixed(0)} KB)`);
                        }
                    }
                }
            }
        }
    }

    // Fallback: If no column clippings found, try full page Editorial image
    if (pageBuffers.length <= 1) {
        const fullPageUrl = `https://www.express.com.pk/epaper/images/${stationKey}/${yyyymmdd}/${yyyymmdd}-${stationKey}-Editorial_PageC006_6.jpg`;
        log(`[Khalik] Express Columns ${cityName}: 0 clippings captured. Trying full page Editorial ${fullPageUrl}...`);
        const buf = await fetchBufferDirect(fullPageUrl, 'https://www.express.com.pk/', 8000);
        if (buf && isValidImage(buf)) {
            pageBuffers.push(buf);
            log(`[Khalik] Express Columns ${cityName}: Captured full Editorial page (${(buf.length / 1024).toFixed(0)} KB)`);
        }
    }

    if (pageBuffers.length <= 1) {
        throw new Error(`[Khalik] Express Columns ${cityName}: No column clippings or editorial page found for ${formatted}.`);
    }

    log(`[Khalik] Express Columns ${cityName}: Assembling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Express Columns',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

// ── 12. ROZNAMA DUNYA COLUMNS / EDITORIAL ───────────────────────────────
async function fetchKhalikDunyaColumns(stationKey = 'LHR', cityName = 'Lahore', dateObj, outputDir, config, log) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const { day, month, year, formatted } = dateObj;
    const outputFilename = `${dateObj.fileDate} Roznama Dunya Columns ${cityName}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    log(`[Khalik] Roznama Dunya Columns ${cityName}: Scraping editorial columns for ${formatted}...`);
    const pageBuffers = [];

    // 1. Add Cover Page
    const coverPath = path.join(__dirname, 'assets', 'dunya_columns_cover.jpg');
    if (fs.existsSync(coverPath)) {
        try {
            const coverBuf = fs.readFileSync(coverPath);
            pageBuffers.push(coverBuf);
            log(`[Khalik] Roznama Dunya Columns ${cityName}: Added cover page (Page 1).`);
        } catch (cErr) {
            log(`[Khalik] Roznama Dunya Columns ${cityName}: Warning loading cover page: ${cErr.message}`);
        }
    }

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const yyyyMmDd = `${year}-${mStr}-${dStr}`;

    // Scan candidate pages to find the editorial columns page
    let targetPageHtml = '';
    let foundPageNum = 0;

    for (const pNum of [25, 4, 5, 2, 3, 1, 6, 7, 8, 9, 10]) {
        const url = `https://e.dunya.com.pk/index.php?e_name=${stationKey}&edate=${yyyyMmDd}&page=${pNum}`;
        try {
            const html = await fetchTextDirect(url, 'https://e.dunya.com.pk/');
            if (html) {
                const detailMatches = Array.from(html.matchAll(/detail\.php\?[^"'\\s>]+/gi)).map(m => m[0]);
                if (detailMatches.length >= 4) {
                    targetPageHtml = html;
                    foundPageNum = pNum;
                    break;
                }
            }
        } catch (_) {}
    }

    if (!targetPageHtml) {
        throw new Error(`[Khalik] Roznama Dunya Columns ${cityName}: Editorial columns page not found for ${formatted}.`);
    }

    const detailMatches = Array.from(targetPageHtml.matchAll(/detail\.php\?[^"'\\s>]+/gi)).map(m => m[0]);
    const uniqueLinks = Array.from(new Set(detailMatches));
    log(`[Khalik] Roznama Dunya Columns ${cityName}: Found ${uniqueLinks.length} column links on page ${foundPageNum}.`);

    for (let i = 0; i < uniqueLinks.length; i++) {
        let dUrl = uniqueLinks[i];
        if (!dUrl.startsWith('http')) {
            dUrl = 'https://e.dunya.com.pk/' + dUrl.replace(/^\.\//, '');
        }

        try {
            const dHtml = await fetchTextDirect(dUrl, 'https://e.dunya.com.pk/');
            if (dHtml) {
                const imgMatch = dHtml.match(/(?:src|href)=["']([^"']*(?:detail_img|colum_img|news)[^"']*\.(?:jpg|png|jpeg)[^"']*)["']/i);
                if (imgMatch) {
                    let imgUrl = imgMatch[1];
                    if (!imgUrl.startsWith('http')) {
                        imgUrl = 'https://e.dunya.com.pk/' + imgUrl.replace(/^\.\//, '');
                    }

                    const buf = await fetchBufferDirect(imgUrl, 'https://e.dunya.com.pk/', 10000);
                    if (buf && buf.length > 5000 && isValidImage(buf)) {
                        pageBuffers.push(buf);
                        log(`[Khalik] Roznama Dunya Columns ${cityName}: Captured column clipping ${i + 1}/${uniqueLinks.length} (${(buf.length / 1024).toFixed(0)} KB)`);
                    }
                }
            }
        } catch (err) {
            log(`[Khalik] Roznama Dunya Columns ${cityName}: Warning on detail link ${i + 1}: ${err.message}`);
        }
    }

    if (pageBuffers.length <= 1) {
        throw new Error(`[Khalik] Roznama Dunya Columns ${cityName}: No column clippings found for ${formatted}.`);
    }

    log(`[Khalik] Roznama Dunya Columns ${cityName}: Assembling ${pageBuffers.length} pages into PDF...`);
    return await assembleAndWatermarkPdf(pageBuffers, {
        newspaperName: 'Roznama Dunya Columns',
        editionName: cityName,
        dateFormatted: formatted,
        outputPath
    }, config);
}

// ── COMPLETE KHALIK CATALOG ─────────────────────────────────────
const KHALIK_NEWSPAPER_CATALOG = [
    // 0a. Roznama 92 Columns (Editorial)
    { id: 'khalik_92_columns', name: 'Roznama 92 Columns (Editorial)', category: 'khalik', network: 'Roznama 92', station: 'Lahore', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalik92NewsColumns(d, out, cfg, l) },

    // 0b. Express Columns (Editorial)
    { id: 'khalik_express_columns', name: 'Express Columns (Editorial)', category: 'khalik', network: 'Express Columns', station: 'Islamabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpressColumns('NP_ISB', 'Islamabad', d, out, cfg, l) },

    // 0c. Roznama Dunya Columns (Editorial)
    { id: 'khalik_dunya_columns', name: 'Roznama Dunya Columns (Editorial)', category: 'khalik', network: 'Roznama Dunya', station: 'Lahore', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDunyaColumns('LHR', 'Lahore', d, out, cfg, l) },

    // 1. Daily Express (11 Editions)
    { id: 'khalik_express_lhr', name: 'Daily Express Lahore', category: 'khalik', network: 'Express', station: 'Lahore', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpress('NP_LHE', 'Lahore', d, out, cfg, l) },
    { id: 'khalik_express_khi', name: 'Daily Express Karachi', category: 'khalik', network: 'Express', station: 'Karachi', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpress('NP_KHI', 'Karachi', d, out, cfg, l) },
    { id: 'khalik_express_isb', name: 'Daily Express Islamabad / Rawalpindi', category: 'khalik', network: 'Express', station: 'Islamabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpress('NP_ISB', 'Islamabad', d, out, cfg, l) },
    { id: 'khalik_express_fsb', name: 'Daily Express Faisalabad', category: 'khalik', network: 'Express', station: 'Faisalabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpress('NP_FSB', 'Faisalabad', d, out, cfg, l) },
    { id: 'khalik_express_grw', name: 'Daily Express Gujranwala', category: 'khalik', network: 'Express', station: 'Gujranwala', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpress('NP_GRW', 'Gujranwala', d, out, cfg, l) },
    { id: 'khalik_express_mux', name: 'Daily Express Multan', category: 'khalik', network: 'Express', station: 'Multan', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpress('NP_MUX', 'Multan', d, out, cfg, l) },
    { id: 'khalik_express_pew', name: 'Daily Express Peshawar', category: 'khalik', network: 'Express', station: 'Peshawar', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpress('NP_PEW', 'Peshawar', d, out, cfg, l) },
    { id: 'khalik_express_ryk', name: 'Daily Express Rahim Yar Khan', category: 'khalik', network: 'Express', station: 'Rahim Yar Khan', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpress('NP_RYK', 'Rahim Yar Khan', d, out, cfg, l) },
    { id: 'khalik_express_sgd', name: 'Daily Express Sargodha', category: 'khalik', network: 'Express', station: 'Sargodha', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpress('NP_SGD', 'Sargodha', d, out, cfg, l) },
    { id: 'khalik_express_suk', name: 'Daily Express Sukkur', category: 'khalik', network: 'Express', station: 'Sukkur', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpress('NP_SUK', 'Sukkur', d, out, cfg, l) },
    { id: 'khalik_express_qta', name: 'Daily Express Quetta', category: 'khalik', network: 'Express', station: 'Quetta', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikExpress('NP_QTA', 'Quetta', d, out, cfg, l) },

    // 2. Jehan Pakistan (5 Editions)
    { id: 'khalik_jehan_lhr', name: 'Jehan Pakistan Lahore', category: 'khalik', network: 'Jehan Pakistan', station: 'Lahore', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikJehanPakistan('lahore', 'Lahore', d, out, cfg, l) },
    { id: 'khalik_jehan_khi', name: 'Jehan Pakistan Karachi', category: 'khalik', network: 'Jehan Pakistan', station: 'Karachi', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikJehanPakistan('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'khalik_jehan_isb', name: 'Jehan Pakistan Islamabad', category: 'khalik', network: 'Jehan Pakistan', station: 'Islamabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikJehanPakistan('islamabad', 'Islamabad', d, out, cfg, l) },
    { id: 'khalik_jehan_mux', name: 'Jehan Pakistan Multan', category: 'khalik', network: 'Jehan Pakistan', station: 'Multan', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikJehanPakistan('multan', 'Multan', d, out, cfg, l) },
    { id: 'khalik_jehan_grw', name: 'Jehan Pakistan Gujranwala', category: 'khalik', network: 'Jehan Pakistan', station: 'Gujranwala', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikJehanPakistan('gujranwala', 'Gujranwala', d, out, cfg, l) },

    // 3. Daily Pakistan (.com.pk - 5 Editions)
    { id: 'khalik_dpcom_lhr', name: 'Daily Pakistan Lahore (.com.pk)', category: 'khalik', network: 'Daily Pakistan (com.pk)', station: 'Lahore', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('lahore', 'Lahore', d, out, cfg, l) },
    { id: 'khalik_dpcom_rwp', name: 'Daily Pakistan Rawalpindi (.com.pk)', category: 'khalik', network: 'Daily Pakistan (com.pk)', station: 'Rawalpindi', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('rawalpindi', 'Rawalpindi', d, out, cfg, l) },
    { id: 'khalik_dpcom_khi', name: 'Daily Pakistan Karachi (.com.pk)', category: 'khalik', network: 'Daily Pakistan (com.pk)', station: 'Karachi', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'khalik_dpcom_pew', name: 'Daily Pakistan Peshawar (.com.pk)', category: 'khalik', network: 'Daily Pakistan (com.pk)', station: 'Peshawar', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('peshawar', 'Peshawar', d, out, cfg, l) },
    { id: 'khalik_dpcom_mux', name: 'Daily Pakistan Multan (.com.pk)', category: 'khalik', network: 'Daily Pakistan (com.pk)', station: 'Multan', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('multan', 'Multan', d, out, cfg, l) },

    // 4. Daily Pakistan (.pk - 9 Editions)
    { id: 'khalik_dppk_isb', name: 'Daily Pakistan Islamabad (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Islamabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('islamabad', 'Islamabad', d, out, cfg, l) },
    { id: 'khalik_dppk_rwp', name: 'Daily Pakistan Rawalpindi (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Rawalpindi', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('rawalpindi', 'Rawalpindi', d, out, cfg, l) },
    { id: 'khalik_dppk_lhr', name: 'Daily Pakistan Lahore (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Lahore', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('lahore', 'Lahore', d, out, cfg, l) },
    { id: 'khalik_dppk_mux', name: 'Daily Pakistan Multan (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Multan', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('multan', 'Multan', d, out, cfg, l) },
    { id: 'khalik_dppk_mzd', name: 'Daily Pakistan Muzaffarabad (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Muzaffarabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('muzaffarabad', 'Muzaffarabad', d, out, cfg, l) },
    { id: 'khalik_dppk_qta', name: 'Daily Pakistan Quetta (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Quetta', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('quetta', 'Quetta', d, out, cfg, l) },
    { id: 'khalik_dppk_pew', name: 'Daily Pakistan Peshawar (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Peshawar', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('peshawar', 'Peshawar', d, out, cfg, l) },
    { id: 'khalik_dppk_fsd', name: 'Daily Pakistan Faisalabad (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Faisalabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('faisalabad', 'Faisalabad', d, out, cfg, l) },
    { id: 'khalik_dppk_grw', name: 'Daily Pakistan Gujranwala (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Gujranwala', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyPakistan('gujranwala', 'Gujranwala', d, out, cfg, l) },

    // 5. Daily Jinnah (5 Editions)
    { id: 'khalik_jinnah_lhr', name: 'Daily Jinnah Lahore', category: 'khalik', network: 'Daily Jinnah', station: 'Lahore', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyJinnah('lahore', 'Lahore', d, out, cfg, l) },
    { id: 'khalik_jinnah_isb', name: 'Daily Jinnah Islamabad', category: 'khalik', network: 'Daily Jinnah', station: 'Islamabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyJinnah('islamabad', 'Islamabad', d, out, cfg, l) },
    { id: 'khalik_jinnah_khi', name: 'Daily Jinnah Karachi', category: 'khalik', network: 'Daily Jinnah', station: 'Karachi', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyJinnah('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'khalik_jinnah_kpk', name: 'Daily Jinnah KPK / Peshawar', category: 'khalik', network: 'Daily Jinnah', station: 'Peshawar', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyJinnah('kpk', 'Peshawar', d, out, cfg, l) },
    { id: 'khalik_jinnah_mzd', name: 'Daily Jinnah Kashmir / Muzaffarabad', category: 'khalik', network: 'Daily Jinnah', station: 'Muzaffarabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyJinnah('kashmir', 'Muzaffarabad', d, out, cfg, l) },

    // 6. Roznama Sahafat (5 Editions)
    { id: 'khalik_sahafat_isb', name: 'Roznama Sahafat Islamabad', category: 'khalik', network: 'Sahafat', station: 'Islamabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikSahafat('isb', 'i', 'Islamabad', d, out, cfg, l) },
    { id: 'khalik_sahafat_lhr', name: 'Roznama Sahafat Lahore', category: 'khalik', network: 'Sahafat', station: 'Lahore', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikSahafat('lahore', 'l', 'Lahore', d, out, cfg, l) },
    { id: 'khalik_sahafat_khi', name: 'Roznama Sahafat Karachi', category: 'khalik', network: 'Sahafat', station: 'Karachi', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikSahafat('karachi', 'k', 'Karachi', d, out, cfg, l) },
    { id: 'khalik_sahafat_pew', name: 'Roznama Sahafat Peshawar', category: 'khalik', network: 'Sahafat', station: 'Peshawar', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikSahafat('pew', 'p', 'Peshawar', d, out, cfg, l) },
    { id: 'khalik_sahafat_mzd', name: 'Roznama Sahafat Muzaffarabad', category: 'khalik', network: 'Sahafat', station: 'Muzaffarabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikSahafat('muz', 'm', 'Muzaffarabad', d, out, cfg, l) },

    // 7. Daily K2 (4 Editions)
    { id: 'khalik_k2_gb', name: 'Daily K2 Gilgit-Baltistan', category: 'khalik', network: 'Daily K2', station: 'Gilgit-Baltistan', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyK2('gb', 'Gilgit-Baltistan', d, out, cfg, l) },
    { id: 'khalik_k2_isb', name: 'Daily K2 Islamabad', category: 'khalik', network: 'Daily K2', station: 'Islamabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyK2('isl', 'Islamabad', d, out, cfg, l) },
    { id: 'khalik_k2_khi', name: 'Daily K2 Karachi', category: 'khalik', network: 'Daily K2', station: 'Karachi', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyK2('khi', 'Karachi', d, out, cfg, l) },
    { id: 'khalik_k2_lhr', name: 'Daily K2 Lahore', category: 'khalik', network: 'Daily K2', station: 'Lahore', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDailyK2('lhr', 'Lahore', d, out, cfg, l) },

    // 8. Daily Jang (5 Editions)
    { id: 'khalik_jang_khi', name: 'Daily Jang Karachi', category: 'khalik', network: 'Daily Jang', station: 'Karachi', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikJang('karachi', 'Karachi', d, out, cfg, l) },
    { id: 'khalik_jang_lhr', name: 'Daily Jang Lahore', category: 'khalik', network: 'Daily Jang', station: 'Lahore', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikJang('lahore', 'Lahore', d, out, cfg, l) },
    { id: 'khalik_jang_isb', name: 'Daily Jang Rawalpindi / Islamabad', category: 'khalik', network: 'Daily Jang', station: 'pindi', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikJang('pindi', 'Islamabad', d, out, cfg, l) },
    { id: 'khalik_jang_qta', name: 'Daily Jang Quetta', category: 'khalik', network: 'Daily Jang', station: 'quetta', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikJang('quetta', 'Quetta', d, out, cfg, l) },
    { id: 'khalik_jang_mux', name: 'Daily Jang Multan', category: 'khalik', network: 'Daily Jang', station: 'multan', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikJang('multan', 'Multan', d, out, cfg, l) },

    // 9. Roznama Dunya (6 Editions)
    { id: 'khalik_dunya_lhr', name: 'Roznama Dunya Lahore', category: 'khalik', network: 'Roznama Dunya', station: 'Lahore', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDunya('LHR', 'Lahore', d, out, cfg, l) },
    { id: 'khalik_dunya_khi', name: 'Roznama Dunya Karachi', category: 'khalik', network: 'Roznama Dunya', station: 'Karachi', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDunya('KCH', 'Karachi', d, out, cfg, l) },
    { id: 'khalik_dunya_isb', name: 'Roznama Dunya Islamabad', category: 'khalik', network: 'Roznama Dunya', station: 'Islamabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDunya('ISL', 'Islamabad', d, out, cfg, l) },
    { id: 'khalik_dunya_fsd', name: 'Roznama Dunya Faisalabad', category: 'khalik', network: 'Roznama Dunya', station: 'Faisalabad', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDunya('FAB', 'Faisalabad', d, out, cfg, l) },
    { id: 'khalik_dunya_grw', name: 'Roznama Dunya Gujranwala', category: 'khalik', network: 'Roznama Dunya', station: 'Gujranwala', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDunya('GUJ', 'Gujranwala', d, out, cfg, l) },
    { id: 'khalik_dunya_mux', name: 'Roznama Dunya Multan', category: 'khalik', network: 'Roznama Dunya', station: 'Multan', language: 'URDU', handler: (d, out, cfg, l) => fetchKhalikDunya('MUL', 'Multan', d, out, cfg, l) }
];

module.exports = {
    KHALIK_NEWSPAPER_CATALOG,
    fetchKhalikExpressColumns,
    fetchKhalik92NewsColumns,
    fetchKhalikJang,
    fetchKhalikDunya,
    fetchKhalikExpress,
    fetchKhalikDailyK2,
    fetchKhalikJehanPakistan,
    fetchKhalikDailyJinnah,
    fetchKhalikSahafat,
    fetchKhalikDailyPakistan,
    fetchKhalikDunyaColumns
};
