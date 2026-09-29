/**
 * scrapers/freemagazines.js
 * Scraper & PDF Downloader engine for FreeMagazines.top
 * 
 * Features:
 * - Query date-wise issues from FreeMagazines.top via proxy reader
 * - Bypass Cloudflare on LimeWire downloads using puppeteer-real-browser with CDP download automation
 * - Automatically strip 'freemagazines.top' watermark badge and link from the cover page (Page 0)
 * - Apply Newspaper Hub golden watermark banner: 'Social Media Pakistan 0342-4938217'
 * - Automatically append 2 promo/rules pages (last_page_1_rules.jpg, last_page_2_services.jpg) to every issue
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PDFDocument } = require('pdf-lib');
const { assembleAndWatermarkPdf } = require('../services/pdfAssembler');
const { setFileCategory } = require('../services/categoryManager');

function cleanHtmlText(str) {
    if (!str) return '';
    return str
        .replace(/&#8211;/g, '–')
        .replace(/&#8212;/g, '—')
        .replace(/&#8216;/g, "'")
        .replace(/&#8217;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/<[^>]+>/g, '')
        .trim();
}

/**
 * Strips the 'https://freemagazines.top' watermark box, text stream, and URI annotation
 * from the cover page (and early pages) of the PDF, restoring the pristine original cover.
 */
async function stripFreemagazinesWatermark(pdfBytes) {
    try {
        const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const count = doc.getPageCount();

        for (let p = 0; p < Math.min(count, 3); p++) {
            const page = doc.getPage(p);
            const node = page.node;

            // 1. Remove link annotations containing freemagazines.top
            const annots = node.Annots();
            if (annots && typeof annots.size === 'function') {
                for (let i = annots.size() - 1; i >= 0; i--) {
                    const a = annots.lookup(i);
                    const aStr = a ? (a.toString ? a.toString() : '') : '';
                    const dictStr = (a && a.dict) ? a.dict.toString() : '';
                    if (aStr.includes('freemagazines') || dictStr.includes('freemagazines')) {
                        annots.remove(i);
                        console.log(`[FreeMagazines] Removed freemagazines link annotation on page ${p}`);
                    }
                }
            }

            // 2. Remove freemagazines badge streams from page Contents
            const contents = node.Contents();
            if (contents && typeof contents.size === 'function') {
                const keepIndices = [];
                for (let i = 0; i < contents.size(); i++) {
                    const stream = contents.lookup(i);
                    const raw = stream.getContents();
                    let uncompressed = '';
                    try {
                        uncompressed = zlib.inflateSync(raw).toString('utf8');
                    } catch (_) {
                        uncompressed = raw.toString('utf8');
                    }

                    const isWm = uncompressed.includes('freemagazines') ||
                        uncompressed.includes('68747470733a2f2f667265656d6167617a696e6573') ||
                        (uncompressed.includes('rg B') && (uncompressed.includes('0.05 0.08 0.15') || uncompressed.includes('0.2 0.5 0.9'))) ||
                        (uncompressed.includes('RG S') && uncompressed.includes('0.35 0.7 1')) ||
                        uncompressed.includes('/hebo 9.5 Tf');

                    if (isWm) {
                        console.log(`[FreeMagazines] Filtered out freemagazines watermark stream on page ${p}, index ${i}`);
                    } else {
                        keepIndices.push(i);
                    }
                }

                if (keepIndices.length < contents.size()) {
                    for (let i = contents.size() - 1; i >= 0; i--) {
                        if (!keepIndices.includes(i)) {
                            contents.remove(i);
                        }
                    }
                }
            }
        }

        return await doc.save();
    } catch (err) {
        console.error('[FreeMagazines] Error stripping watermark, falling back to original PDF:', err.message);
        return pdfBytes;
    }
}

/**
 * Fetch magazine issues for a specific date (YYYY-MM-DD) from FreeMagazines.top
 */
async function getMagazinesByDate(dateStr) {
    const targetDate = new Date(dateStr + 'T00:00:00Z');
    const nextDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
    const afterIso = targetDate.toISOString().slice(0, 10) + 'T00:00:00';
    const beforeIso = nextDate.toISOString().slice(0, 10) + 'T00:00:00';

    const directWpUrl = `https://freemagazines.top/wp-json/wp/v2/posts?after=${afterIso}&before=${beforeIso}&per_page=50&_embed=1`;
    const apiUrl = `https://r.jina.ai/${directWpUrl}`;

    console.log(`[FreeMagazines] Fetching issues for date ${dateStr} via reader...`);
    
    let magazines = [];
    try {
        const res = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(20000)
        });

        if (res.ok) {
            const rawText = await res.text();
            let json = null;
            try {
                json = JSON.parse(rawText);
            } catch (_) {
                const match = rawText.match(/\[[\s\S]*\]/);
                if (match) {
                    try { json = JSON.parse(match[0]); } catch (e) {}
                }
            }

            if (Array.isArray(json)) {
                for (const post of json) {
                    const title = cleanHtmlText(post.title?.rendered || 'Untitled Magazine');
                    const content = post.content?.rendered || '';
                    
                    // Extract download link (VK, EasyUpload, LimeWire, direct PDF, or download button href)
                    let downloadUrl = '';
                    const vkMatch = content.match(/https?:\/\/(?:www\.)?vk\.(?:ru|com)\/s\/v1\/doc\/[a-zA-Z0-9_-]+/i)
                        || content.match(/https?:\/\/(?:www\.)?vk\.(?:ru|com)\/[^\s"']+/i);
                    const easyMatch = content.match(/https?:\/\/(?:www\.)?easyupload\.(?:us|io|com)\/[^\s"']+/i);
                    const limeMatch = content.match(/https:\/\/limewire\.com\/d\/[a-zA-Z0-9#_-]+/i);
                    const pdfMatch = content.match(/href="([^"]+\.pdf)"/i);
                    const dlBtnMatch = content.match(/href="([^"]+)"[^>]*>[^<]*download[^<]*<\/a>/i)
                        || content.match(/<a[^>]+href="([^"]+)"[^>]*>[^<]*download[^<]*<\/a>/i);

                    if (vkMatch) {
                        downloadUrl = vkMatch[0];
                    } else if (easyMatch) {
                        downloadUrl = easyMatch[0];
                    } else if (limeMatch) {
                        downloadUrl = limeMatch[0];
                    } else if (pdfMatch) {
                        downloadUrl = pdfMatch[1];
                    } else if (dlBtnMatch) {
                        downloadUrl = dlBtnMatch[1];
                    }


                    
                    // Extract cover image
                    let coverImage = '';
                    if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
                        coverImage = post._embedded['wp:featuredmedia'][0].source_url || '';
                    }

                    // Extract metadata from content: pages, size
                    let pages = null;
                    let size = null;
                    const pageMatch = content.match(/(\d+)\s+pages/i);
                    if (pageMatch) pages = parseInt(pageMatch[1], 10);
                    const sizeMatch = content.match(/(\d+(?:\.\d+)?)\s*(MB|GB)/i);
                    if (sizeMatch) size = `${sizeMatch[1]} ${sizeMatch[2]}`;

                    // Categories
                    let category = 'General';
                    if (post._embedded && post._embedded['wp:term'] && post._embedded['wp:term'][0] && post._embedded['wp:term'][0][0]) {
                        category = cleanHtmlText(post._embedded['wp:term'][0][0].name);
                    }

                    magazines.push({
                        id: String(post.id),
                        title,
                        slug: post.slug,
                        date: post.date ? post.date.slice(0, 10) : dateStr,
                        coverImage,
                        downloadUrl,
                        category,
                        pages,
                        size,
                        postUrl: post.link || ''
                    });
                }
            }
        }
    } catch (err) {
        console.error('[FreeMagazines] Error fetching date posts:', err.message);
    }

    return magazines;
}

/**
 * Download a magazine issue PDF via LimeWire / direct URL into outputDir,
 * strip the 'freemagazines.top' watermark on the cover page,
 * apply the Newspaper Hub watermark ('Social Media Pakistan 0342-4938217'),
 * and append the 2 promo pages at the end.
 */
async function downloadMagazineIssue({ title, downloadUrl, coverImage, date }, outputDir) {
    if (!downloadUrl) {
        throw new Error('No download URL available for this magazine issue.');
    }

    const { connect } = require('puppeteer-real-browser');
    
    // Clean filename for Free Magazines: remove auto-generated starting date prefix & hyphens/dashes, preserve date/month/year in title
    const datePrefix = date ? date.replace(/-/g, '-') : new Date().toISOString().slice(0, 10);
    let rawTitle = (title || 'Magazine').trim();
    // Remove leading date prefix if present at start of title string
    rawTitle = rawTitle.replace(/^(?:\d{4}[-._/]\d{2}[-._/]\d{2}|\d{2}[-._/]\d{2}[-._/]\d{4})\s*/i, '');
    // Clean brackets, invalid filename characters, and dashes/hyphens
    const safeTitle = rawTitle
        .replace(/[()[\]{}]/g, '')
        .replace(/[/\\?%*:|"<>]/g, '')
        .replace(/[-–—−]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'Magazine';

    const finalFilename = `${safeTitle}.pdf`;
    const finalFilePath = path.join(outputDir, finalFilename);

    let rawPdfBuffer = null;

    // Direct PDF link handling
    if (downloadUrl.toLowerCase().endsWith('.pdf')) {
        console.log(`[FreeMagazines] Fetching direct PDF: ${downloadUrl}`);
        const res = await fetch(downloadUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(60000)
        });
        if (!res.ok) throw new Error(`Failed to download PDF: HTTP ${res.status}`);
        rawPdfBuffer = Buffer.from(await res.arrayBuffer());
    }

    // VK document handling
    if (!rawPdfBuffer && (downloadUrl.includes('vk.ru') || downloadUrl.includes('vk.com'))) {
        console.log(`[FreeMagazines] Resolving VK document link via Puppeteer: ${downloadUrl}`);
        let browser = null;
        try {
            const connected = await connect({
                headless: 'auto',
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                turnstile: true
            });
            browser = connected.browser;
            const page = connected.page;

            let pdfTargetUrl = null;

            page.on('response', (res) => {
                const u = res.url();
                const ct = res.headers()['content-type'] || '';
                if ((u.includes('vkuserphoto.ru') || ct === 'application/pdf') && u.includes('.pdf') && !u.includes('mail.ru')) {
                    pdfTargetUrl = u;
                    console.log(`[FreeMagazines] Intercepted VK PDF CDN URL: ${pdfTargetUrl}`);
                }
            });

            await page.goto(downloadUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            await new Promise(r => setTimeout(r, 4000));

            if (!pdfTargetUrl) {
                console.log('[FreeMagazines] Triggering Download button click on VK page...');
                await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button, a')).find(el => {
                        const txt = (el.innerText || '').trim().toLowerCase();
                        return txt.includes('download');
                    });
                    if (btn) btn.click();
                });
                await new Promise(r => setTimeout(r, 5000));
            }

            if (pdfTargetUrl) {
                console.log(`[FreeMagazines] Fetching intercepted PDF buffer from VK CDN...`);
                const pdfRes = await fetch(pdfTargetUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    signal: AbortSignal.timeout(120000)
                });
                if (pdfRes.ok) {
                    rawPdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
                }
            }
        } catch (vkErr) {
            console.error('[FreeMagazines] VK download error:', vkErr.message);
        } finally {
            if (browser) {
                try { await browser.close(); } catch (_) {}
            }
        }
    }

    // EasyUpload handling
    if (!rawPdfBuffer && (downloadUrl.includes('easyupload.us') || downloadUrl.includes('easyupload.io') || downloadUrl.includes('easyupload.com'))) {
        console.log(`[FreeMagazines] Downloading via EasyUpload CDP: ${downloadUrl}`);
        const tempDlDir = path.join(outputDir, `tmp_dl_easy_${Date.now()}`);
        fs.mkdirSync(tempDlDir, { recursive: true });

        let browser = null;
        try {
            const connected = await connect({
                headless: 'auto',
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                turnstile: true
            });
            browser = connected.browser;
            const page = connected.page;

            const client = await page.target().createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: tempDlDir
            });

            await page.goto(downloadUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await new Promise(r => setTimeout(r, 4000));

            await page.evaluate(() => {
                const btn = document.getElementById('downloadBtn') || Array.from(document.querySelectorAll('button, a')).find(b => (b.innerText || '').toLowerCase().includes('download'));
                if (btn) btn.click();
            });

            let downloadedFile = null;
            for (let i = 0; i < 25; i++) {
                await new Promise(r => setTimeout(r, 2000));
                const files = fs.readdirSync(tempDlDir);
                const pdf = files.find(f => f.toLowerCase().endsWith('.pdf') && !f.toLowerCase().endsWith('.crdownload'));
                if (pdf) {
                    downloadedFile = pdf;
                    break;
                }
            }

            if (!downloadedFile) {
                throw new Error('EasyUpload download timed out or failed to save file.');
            }

            const srcPath = path.join(tempDlDir, downloadedFile);
            rawPdfBuffer = fs.readFileSync(srcPath);
        } catch (easyErr) {
            console.error('[FreeMagazines] EasyUpload error:', easyErr.message);
        } finally {
            if (browser) {
                try { await browser.close(); } catch (_) {}
            }
            try {
                if (fs.existsSync(tempDlDir)) {
                    fs.rmSync(tempDlDir, { recursive: true, force: true });
                }
            } catch (_) {}
        }
    }

    // LimeWire handling
    if (!rawPdfBuffer && downloadUrl.includes('limewire.com')) {
        const tempDlDir = path.join(outputDir, `tmp_dl_${Date.now()}`);
        fs.mkdirSync(tempDlDir, { recursive: true });

        let browser = null;
        try {
            const connected = await connect({
                headless: 'auto',
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                turnstile: true
            });
            browser = connected.browser;
            const page = connected.page;

            // Enable file download into temp directory
            const client = await page.target().createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: tempDlDir
            });

            await page.goto(downloadUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
            await new Promise(r => setTimeout(r, 3000));

            // Click the Download button with retries
            let clicked = false;
            for (let retry = 0; retry < 3; retry++) {
                clicked = await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button, a')).find(el => {
                        const txt = (el.innerText || '').trim().toLowerCase();
                        return txt === 'download' || (txt.includes('download') && !txt.includes('report') && !txt.includes('app'));
                    });
                    if (btn) {
                        btn.click();
                        return true;
                    }
                    return false;
                });
                if (clicked) break;
                await new Promise(r => setTimeout(r, 2500));
            }

            if (!clicked) {
                // Check if page redirected or has direct PDF link
                const directPdfLink = await page.evaluate(() => {
                    const a = Array.from(document.querySelectorAll('a')).find(el => el.href && el.href.toLowerCase().includes('.pdf'));
                    return a ? a.href : null;
                });
                if (directPdfLink) {
                    await page.goto(directPdfLink, { waitUntil: 'domcontentloaded', timeout: 90000 });
                } else {
                    throw new Error('Could not find download button on LimeWire page.');
                }
            }

            // Wait for download to finish (max 60s)
            let downloadedFile = null;
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 2000));
                const files = fs.readdirSync(tempDlDir);
                const pdf = files.find(f => f.toLowerCase().endsWith('.pdf') && !f.toLowerCase().endsWith('.crdownload'));
                if (pdf) {
                    downloadedFile = pdf;
                    break;
                }
            }

            if (!downloadedFile) {
                throw new Error('Download timed out or failed to save PDF from LimeWire.');
            }

            const srcPath = path.join(tempDlDir, downloadedFile);
            rawPdfBuffer = fs.readFileSync(srcPath);
        } finally {
            if (browser) {
                try { await browser.close(); } catch (_) {}
            }
            try {
                if (fs.existsSync(tempDlDir)) {
                    fs.rmSync(tempDlDir, { recursive: true, force: true });
                }
            } catch (_) {}
        }
    }

    if (!rawPdfBuffer || rawPdfBuffer.length < 5000) {
        throw new Error(`Failed to acquire valid PDF file for ${title}`);
    }

    // ── 1. STRIP FREEMAGAZINES.TOP WATERMARK & LINK FROM COVER PAGE ──────────
    console.log(`[FreeMagazines] Stripping freemagazines.top watermark badge from ${safeTitle}...`);
    const cleanedPdfBuffer = await stripFreemagazinesWatermark(rawPdfBuffer);

    // ── 2. APPLY WATERMARK & APPEND 2 PROMO PAGES ────────────────────────────
    console.log(`[FreeMagazines] Applying Newspaper Hub watermark & appending promo pages...`);
    const processed = await assembleAndWatermarkPdf(cleanedPdfBuffer, {
        newspaperName: safeTitle,
        editionName: '',
        dateFormatted: datePrefix,
        outputPath: finalFilePath
    }, {
        watermarkText: 'Social Media Pakistan 0342-4938217',
        enableBottomBanner: true,
        enableTopBanner: false
    });

    console.log(`[FreeMagazines] Finished processing ${finalFilename}: ${processed.sizeMb} MB, ${processed.pages} pages.`);
    setFileCategory(finalFilename, 'magazines');

    return {
        filename: finalFilename,
        sizeMb: processed.sizeMb,
        pages: processed.pages,
        url: `/output/${encodeURIComponent(finalFilename)}`
    };
}

module.exports = {
    getMagazinesByDate,
    downloadMagazineIssue
};
