/**
 * scrapers/foreignpaper.js
 * High-Performance Scraper & PDF Engine for Foreign Newspapers (Mobilism f=123)
 * 
 * Performance Optimizations:
 * 1. Persistent Disk & RAM Cache: Loads catalog in 0ms (instant!).
 * 2. Pre-fetched Host Links: Eliminates extra browser launches during issue download.
 * 3. Fixed Cloudflare Turnstile: Removed image-blocking flags that caused 30s hangs on Turnstile.
 * 4. Apply Newspaper Hub golden bottom banner watermark: 'Social Media Pakistan 0342-4938217'
 * 5. Automatically append 2 promo/rules pages (last_page_1_rules.jpg, last_page_2_services.jpg)
 */

const fs = require('fs');
const path = require('path');
const { connect } = require('puppeteer-real-browser');
const { assembleAndWatermarkPdf } = require('../services/pdfAssembler');
const { setFileCategory } = require('../services/categoryManager');

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'foreign_catalog_cache.json');

// In-memory cache for scraped forum catalog
let catalogCache = {
    dateStr: '',
    timestamp: 0,
    papers: []
};

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (_) {}
}

// Load disk cache on initial module import
try {
    if (fs.existsSync(CACHE_FILE)) {
        const diskData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (diskData && Array.isArray(diskData.papers) && diskData.papers.length > 0) {
            catalogCache = diskData;
            console.log(`[ForeignPaper] Initialized disk cache with ${catalogCache.papers.length} issues (${catalogCache.dateStr})`);
        }
    }
} catch (err) {
    console.warn('[ForeignPaper] Disk cache read warning:', err.message);
}

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
 * Parses date from newspaper title or string, returns YYYY-MM-DD
 */
function parseIssueDate(text, fallbackDate) {
    if (!text) return fallbackDate;
    const m = text.match(/([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i) || text.match(/(\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/i);
    if (m) {
        const d = new Date(m[1] + ' UTC');
        if (!isNaN(d.getTime())) {
            return d.toISOString().slice(0, 10);
        }
    }
    return fallbackDate;
}

/**
 * Formats date string as DD MMM without year (e.g. 21 Sep)
 */
function formatDateForFilename(dateInput) {
    if (!dateInput) dateInput = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (typeof dateInput === 'string') {
        const str = dateInput.trim();
        let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (m) {
            const monthIdx = parseInt(m[2], 10) - 1;
            const day = parseInt(m[3], 10);
            if (monthIdx >= 0 && monthIdx < 12) {
                return `${day} ${months[monthIdx]}`;
            }
        }
        m = str.match(/^(\d{1,2})[-_\s]+([A-Za-z]{3})/);
        if (m) {
            const day = parseInt(m[1], 10);
            const monStr = m[2].charAt(0).toUpperCase() + m[2].slice(1, 3).toLowerCase();
            return `${day} ${monStr}`;
        }
    }

    const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    if (!isNaN(d.getTime())) {
        const day = d.getUTCDate ? d.getUTCDate() : d.getDate();
        const monthIdx = d.getUTCMonth ? d.getUTCMonth() : d.getMonth();
        return `${day} ${months[monthIdx]}`;
    }

    return String(dateInput);
}

/**
 * Save catalog cache to persistent disk storage
 */
function saveCatalogDiskCache(targetDate, newPapers) {
    const existingMap = new Map();
    if (Array.isArray(catalogCache.papers)) {
        catalogCache.papers.forEach(p => { if (p && p.id) existingMap.set(p.id, p); });
    }
    if (Array.isArray(newPapers)) {
        newPapers.forEach(p => { if (p && p.id) existingMap.set(p.id, p); });
    }
    const mergedPapers = Array.from(existingMap.values());
    mergedPapers.sort((a, b) => (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0));

    catalogCache = {
        dateStr: targetDate,
        timestamp: Date.now(),
        papers: mergedPapers
    };
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(catalogCache, null, 2), 'utf8');
        console.log(`[ForeignPaper] Saved ${mergedPapers.length} total catalog items to disk cache (newest first).`);
    } catch (err) {
        console.error('[ForeignPaper] Failed to write catalog disk cache:', err.message);
    }
}

function getYmdComponents(dateInput) {
    if (!dateInput) return null;
    if (typeof dateInput === 'string') {
        const m = dateInput.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (m) {
            return {
                YYYY: m[1],
                MM: String(m[2]).padStart(2, '0'),
                DD: String(m[3]).padStart(2, '0')
            };
        }
    }
    const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    if (!isNaN(d.getTime())) {
        return {
            YYYY: String(d.getUTCFullYear ? d.getUTCFullYear() : d.getFullYear()),
            MM: String((d.getUTCMonth ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0'),
            DD: String(d.getUTCDate ? d.getUTCDate() : d.getDate()).padStart(2, '0')
        };
    }
    return null;
}

/**
 * Fetch foreign newspapers for a specific date (YYYY-MM-DD).
 * Filters catalog cache strictly for the requested date.
 */
function filterPapersByRequestedDate(papers, targetDateStr) {
    if (!targetDateStr || !Array.isArray(papers) || papers.length === 0) return [];
    const targetComp = getYmdComponents(targetDateStr);
    if (!targetComp) return papers;
    const targetYmd = `${targetComp.YYYY}-${targetComp.MM}-${targetComp.DD}`;

    const filtered = papers.filter(p => {
        if (!p.date) return false;
        if (p.date === targetYmd) return true;
        const pComp = getYmdComponents(p.date);
        if (!pComp) return false;
        return pComp.YYYY === targetComp.YYYY && pComp.MM === targetComp.MM && pComp.DD === targetComp.DD;
    });

    return filtered.sort((a, b) => (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0));
}

/**
 * Background catalog scraper that pre-fetches catalog and host links
 */
async function fetchCatalogFromForum(targetDate) {
    console.log(`[ForeignPaper] Scraper starting for ${targetDate}...`);
    let browser = null;
    let papers = [];

    try {
        const connected = await connect({
            headless: 'auto',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            turnstile: true
        });
        browser = connected.browser;
        const page = connected.page;

        await page.goto('https://forum.mobilism.me/viewforum.php?f=123', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Wait for Turnstile auto-solve and topic list to load
        let rawTopics = [];
        for (let i = 1; i <= 8; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const count = await page.evaluate(() => document.querySelectorAll('a.topictitle').length);
            if (count > 0) {
                rawTopics = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('a.topictitle'))
                        .map(a => ({ title: a.innerText.trim(), href: a.href }))
                        .filter(t => t.title && !t.title.includes('Ukrainian') && !t.title.includes('Mobilism Premium') && !t.title.includes('Mobilism v2'));
                });
                break;
            }
        }

        console.log(`[ForeignPaper] Scraped ${rawTopics.length} topics from forum index page.`);

        const targetCount = Math.min(25, rawTopics.length);
        for (let i = 0; i < targetCount; i++) {
            const topic = rawTopics[i];
            const titleClean = topic.title.replace(/\(\.PDF\)/i, '').replace(/\.pdf$/i, '').trim();
            const issueDate = parseIssueDate(topic.title, targetDate);

            const idMatch = topic.href.match(/t=(\d+)/);
            const id = idMatch ? idMatch[1] : String(i + 1);

            let links = [];
            // Pre-fetch host links for all topics in same browser session for instant download capability
            try {
                await page.goto(topic.href, { waitUntil: 'domcontentloaded', timeout: 12000 });
                await new Promise(r => setTimeout(r, 600));
                links = await page.evaluate(() => {
                    const post = document.querySelector('.postbody') || document.querySelector('.content');
                    if (!post) return [];
                    return Array.from(post.querySelectorAll('a'))
                        .map(a => a.href)
                        .filter(h => h.startsWith('http') && !h.includes('mobilism.me') && !h.includes('mobilism.org'));
                });
            } catch (tErr) {
                console.warn(`[ForeignPaper] Could not pre-fetch topic links for ${topic.title}:`, tErr.message);
            }

            papers.push({
                id,
                title: titleClean,
                rawTitle: topic.title,
                date: issueDate,
                coverImage: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80',
                downloadUrl: links[0] || '',
                allDownloadUrls: links,
                category: 'Foreign Paper',
                size: 'PDF',
                postUrl: topic.href
            });
        }

        if (papers.length > 0) {
            saveCatalogDiskCache(targetDate, papers);
        }

    } catch (err) {
        console.error('[ForeignPaper] Error fetching forum catalog:', err.message);
    } finally {
        if (browser) {
            try { await browser.close(); } catch (_) {}
        }
    }

    return papers;
}

async function getForeignPapersByDate(dateStr) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const targetDate = dateStr || todayStr;

    const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
    const isCacheFresh = catalogCache.papers.length > 0 && (Date.now() - catalogCache.timestamp) < CACHE_TTL_MS;

    if (isCacheFresh) {
        const filtered = filterPapersByRequestedDate(catalogCache.papers, targetDate);
        console.log(`[ForeignPaper] Returning ${filtered.length} cached papers for ${targetDate}`);
        return filtered;
    }

    if (catalogCache.papers.length > 0) {
        const filtered = filterPapersByRequestedDate(catalogCache.papers, targetDate);
        console.log(`[ForeignPaper] Returning ${filtered.length} cached papers instantly and starting background refresh...`);
        fetchCatalogFromForum(targetDate).catch(e => console.error('[ForeignPaper] Background refresh error:', e.message));
        return filtered;
    }

    // First time load: fetch catalog synchronously
    console.log(`[ForeignPaper] Initial synchronous fetch for ${targetDate}...`);
    const papers = await fetchCatalogFromForum(targetDate);
    return filterPapersByRequestedDate(papers, targetDate);
}

/**
 * Fetches host download links from a specific topic post on demand.
 */
async function fetchTopicDownloadLinks(postUrl) {
    let browser = null;
    let links = [];

    try {
        const connected = await connect({
            headless: 'auto',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            turnstile: true
        });
        browser = connected.browser;
        const page = connected.page;

        await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        for (let w = 0; w < 6; w++) {
            const hasPost = await page.evaluate(() => !!(document.querySelector('.postbody') || document.querySelector('.content')));
            if (hasPost) break;
            await new Promise(r => setTimeout(r, 800));
        }

        links = await page.evaluate(() => {
            const post = document.querySelector('.postbody') || document.querySelector('.content');
            if (!post) return [];
            return Array.from(post.querySelectorAll('a'))
                .map(a => a.href)
                .filter(h => h.startsWith('http') && !h.includes('mobilism.me') && !h.includes('mobilism.org'));
        });

    } catch (err) {
        console.warn(`[ForeignPaper] Could not fetch topic links for ${postUrl}:`, err.message);
    } finally {
        if (browser) {
            try { await browser.close(); } catch (_) {}
        }
    }

    return links;
}

/**
 * Downloads PDF from a host URL (e.g. UsersDrive, UserDriver, UserUpload, etc.)
 * High-speed form submission & direct PDF stream extraction
 */
async function downloadBufferFromHost(downloadUrl, tempDlDir) {
    let rawPdfBuffer = null;

    // Direct PDF link handling
    if (downloadUrl.toLowerCase().endsWith('.pdf')) {
        console.log(`[ForeignPaper] Fetching direct PDF URL: ${downloadUrl}`);
        try {
            const res = await fetch(downloadUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(60000)
            });
            if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                if (buf.length > 5000 && buf.toString('latin1', 0, 5).includes('%PDF')) {
                    return buf;
                }
            }
        } catch (_) {}
    }

    console.log(`[ForeignPaper] Automated browser download for host: ${downloadUrl}`);
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
        await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: tempDlDir });

        await page.goto(downloadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000));

        // Wait up to 6 seconds for Cloudflare Turnstile token to auto-solve if present on form
        try {
            for (let t = 0; t < 6; t++) {
                const hasToken = await page.evaluate(() => {
                    const inp = document.querySelector('input[name="cf-turnstile-response"]');
                    return inp && inp.value && inp.value.length > 10;
                });
                if (hasToken) break;
                await new Promise(r => setTimeout(r, 800));
            }
        } catch (_) {}

        // Submit download form (FREE1 / op=download2 / UsersDrive / UserUpload / DropAPK / frdl.io)
        const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
        const formSubmitted = await page.evaluate(() => {
            // 1. Check for free download form (FREE1, op=download2 with download_free or downloadbtnfree)
            const freeForm = Array.from(document.querySelectorAll('form')).find(f => 
                f.name === 'FREE1' || 
                f.querySelector('input[name="download_free"]') ||
                f.querySelector('#downloadbtnfree, .downloadbtnfree')
            );
            if (freeForm) {
                const btn = freeForm.querySelector('#downloadbtnfree, .downloadbtnfree, input[type="submit"], button[type="submit"]');
                if (btn) btn.disabled = false;
                try {
                    HTMLFormElement.prototype.submit.call(freeForm);
                    return 'submitted_freeForm';
                } catch (_) {
                    if (btn) { btn.click(); return 'clicked_freeBtn'; }
                }
            }

            // 2. Fallback to standard download form (op=download2 / op=download)
            const form = Array.from(document.querySelectorAll('form')).find(f => {
                const opInput = f.querySelector('input[name="op"]');
                return opInput && (opInput.value === 'download2' || opInput.value === 'download');
            }) || Array.from(document.querySelectorAll('form')).find(f => f.querySelector('#downloadbtn, .downloadbtn'));

            if (form) {
                const btn = form.querySelector('#downloadbtn, .downloadbtn, input[type="submit"], button[type="submit"]');
                if (btn) btn.disabled = false;
                try {
                    HTMLFormElement.prototype.submit.call(form);
                    return 'submitted_form';
                } catch (err) {
                    if (btn) { btn.click(); return 'clicked_btn'; }
                }
            }

            // 3. Fallback to any free download button
            const anyBtn = document.getElementById('downloadbtnfree') || 
                           document.getElementById('downloadbtn') || 
                           Array.from(document.querySelectorAll('button, a, input')).find(el => {
                               const txt = (el.innerText || el.value || '').toLowerCase().trim();
                               return txt.includes('normal download') || txt.includes('free download') || txt.includes('slow download') || txt.includes('create download link') || txt === 'download';
                           });
            if (anyBtn) {
                if (anyBtn.disabled) anyBtn.disabled = false;
                anyBtn.click();
                return 'clicked_anyBtn';
            }
            return false;
        });

        if (formSubmitted) {
            await navPromise;
            await new Promise(r => setTimeout(r, 1500));
        }

        // Extract direct PDF download link from Page 2 without pre-clicking
        const currentUrl = page.url();
        const directPdfUrl = await page.evaluate(() => {
            const dLink = document.querySelector('#download_link, a[href*="/d/"], a[href$=".pdf"], .btn-download, .downloadbtn');
            if (dLink && dLink.href && dLink.href.startsWith('http') && !dLink.href.includes('rapidgator') && !dLink.href.includes('nitroflare')) {
                return dLink.href;
            }
            const aList = Array.from(document.querySelectorAll('a'));
            const pdfA = aList.find(a => {
                const h = (a.href || '').toLowerCase();
                const txt = (a.innerText || '').toLowerCase();
                if (h.includes('rapidgator') || h.includes('nitroflare') || h.includes('turbobit') || h.includes('katfile')) return false;
                return h.includes('.pdf') || h.includes('/d/') || txt.includes('click here to download') || txt.includes('direct download');
            });
            if (pdfA) {
                return pdfA.href;
            }
            return null;
        });

        if (directPdfUrl) {
            console.log(`[ForeignPaper] Direct PDF URL acquired: ${directPdfUrl}`);
            const tempPdfFile = path.join(tempDlDir, `direct_${Date.now()}.pdf`);
            try {
                const { execSync } = require('child_process');
                execSync(`curl -k -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -e "${currentUrl}" --max-time 120 "${directPdfUrl}" -o "${tempPdfFile}"`);
                if (fs.existsSync(tempPdfFile)) {
                    const buf = fs.readFileSync(tempPdfFile);
                    if (buf.length > 5000 && buf.toString('latin1', 0, 5).includes('%PDF')) {
                        rawPdfBuffer = buf;
                        console.log(`[ForeignPaper] Direct curl acquired PDF: ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
                    }
                }
            } catch (fErr) {
                console.warn('[ForeignPaper] Direct link curl warning:', fErr.message);
            }
        }

        // Fallback: Click link in browser to trigger CDP download into tempDlDir
        if (!rawPdfBuffer) {
            console.log('[ForeignPaper] Triggering CDP download fallback in browser...');
            await page.evaluate(() => {
                const dLink = document.querySelector('#download_link, a[href*="/d/"], a[href$=".pdf"], .btn-download, .downloadbtn');
                if (dLink) {
                    if (dLink.disabled) dLink.disabled = false;
                    try { dLink.click(); } catch (_) {}
                }
            });

            if (fs.existsSync(tempDlDir)) {
                for (let waitSec = 0; waitSec < 10; waitSec++) {
                    const files = fs.readdirSync(tempDlDir);
                    const pdf = files.find(f => f.toLowerCase().endsWith('.pdf') && !f.toLowerCase().endsWith('.crdownload'));
                    if (pdf) {
                        rawPdfBuffer = fs.readFileSync(path.join(tempDlDir, pdf));
                        break;
                    }
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

    } catch (err) {
        console.error(`[ForeignPaper] Host download error (${downloadUrl}):`, err.message);
    } finally {
        if (browser) {
            try { await browser.close(); } catch (_) {}
        }
    }

    return rawPdfBuffer;
}

/**
 * Downloads a Foreign Paper issue PDF into outputDir,
 * applies Newspaper Hub golden watermark banner: 'Social Media Pakistan 0342-4938217',
 * appends the 2 promo pages, and linearizes for instant WhatsApp preview.
 */
async function downloadForeignPaperIssue({ title, postUrl, downloadUrl, coverImage, date, allDownloadUrls }, outputDir) {
    const urlsToTry = [];
    if (downloadUrl) urlsToTry.push(downloadUrl);
    if (Array.isArray(allDownloadUrls)) {
        allDownloadUrls.forEach(u => {
            if (u && !urlsToTry.includes(u)) urlsToTry.push(u);
        });
    }

    if (urlsToTry.length === 0 && postUrl) {
        console.log(`[ForeignPaper] Fetching host download links on-demand for: ${title}...`);
        const extractedLinks = await fetchTopicDownloadLinks(postUrl);
        extractedLinks.forEach(u => {
            if (u && !urlsToTry.includes(u)) urlsToTry.push(u);
        });
    }

    // Sort links by host priority (UsersDrive, UserDriver, UserUpload first)
    urlsToTry.sort((a, b) => {
        const score = (url) => {
            const u = url.toLowerCase();
            if (u.includes('usersdrive') || u.includes('userdriver') || u.includes('userupload')) return 10;
            if (u.includes('dropapk') || u.includes('uploady') || u.includes('file-upload')) return 8;
            if (u.endsWith('.pdf')) return 9;
            if (u.includes('rapidgator')) return 1;
            return 5;
        };
        return score(b) - score(a);
    });

    if (urlsToTry.length === 0) {
        throw new Error(`No download URLs available for foreign paper issue: ${title}`);
    }

    // Clean title and filename (Format: DD MMM PaperName.pdf, e.g. "21 Sep USA Today.pdf")
    const datePrefix = formatDateForFilename(date);
    const safeTitle = (title || 'Foreign Paper')
        .replace(/[()[\]{}]/g, '')
        .replace(/[/\\?%*:|"<>]/g, '')
        .trim();
    const finalFilename = `${datePrefix} ${safeTitle}.pdf`;
    const finalFilePath = path.join(outputDir, finalFilename);

    const tempDlDir = path.join(outputDir, `tmp_fp_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(tempDlDir, { recursive: true });

    let rawPdfBuffer = null;
    let lastError = null;

    try {
        for (const targetUrl of urlsToTry) {
            console.log(`[ForeignPaper] Trying download link for ${safeTitle}: ${targetUrl}`);
            try {
                rawPdfBuffer = await downloadBufferFromHost(targetUrl, tempDlDir);
                if (rawPdfBuffer && rawPdfBuffer.length > 5000) {
                    console.log(`[ForeignPaper] Successfully acquired raw PDF for ${safeTitle} (${(rawPdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
                    break;
                }
            } catch (err) {
                lastError = err;
                console.warn(`[ForeignPaper] Link failed (${targetUrl}):`, err.message);
            }
        }

        if (!rawPdfBuffer || rawPdfBuffer.length < 5000) {
            throw new Error(lastError ? lastError.message : `Failed to acquire valid PDF file for ${title}`);
        }

        // Apply Newspaper Hub watermark ('Social Media Pakistan 0342-4938217') & append promo pages
        console.log(`[ForeignPaper] Watermarking & assembling PDF for ${safeTitle}...`);
        const processed = await assembleAndWatermarkPdf(rawPdfBuffer, {
            newspaperName: safeTitle,
            editionName: '',
            dateFormatted: datePrefix,
            outputPath: finalFilePath
        }, {
            watermarkText: 'Social Media Pakistan 0342-4938217',
            enableBottomBanner: true,
            enableTopBanner: false
        });

        console.log(`[ForeignPaper] Finished processing ${finalFilename}: ${processed.sizeMb} MB, ${processed.pages} pages.`);
        setFileCategory(finalFilename, 'foreignpaper');

        return {
            filename: finalFilename,
            sizeMb: processed.sizeMb,
            pages: processed.pages,
            url: `/output/${encodeURIComponent(finalFilename)}`
        };

    } finally {
        try {
            if (fs.existsSync(tempDlDir)) {
                fs.rmSync(tempDlDir, { recursive: true, force: true });
            }
        } catch (_) {}
    }
}

module.exports = {
    getForeignPapersByDate,
    downloadForeignPaperIssue
};

