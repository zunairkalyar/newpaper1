/**
 * scrapers/indianpaper.js
 * Scraper & PDF Downloader engine for Indian English Newspapers (dailyepaper.in)
 * 
 * Features:
 * - Scrape English newspapers from dailyepaper.in (Times of India, The Hindu, Hindustan Times, Economic Times, FPJ, etc.)
 * - City edition filtering: Enforces Delhi & Mumbai ONLY for multi-city editions, or single main edition.
 * - Direct Google Drive stream acquisition with confirmation token handling.
 * - Apply Newspaper Hub golden bottom banner watermark: 'Social Media Pakistan 0342-4938217'
 * - Automatically append 2 promo/rules pages (last_page_1_rules.jpg, last_page_2_services.jpg) to every issue
 */

const fs = require('fs');
const path = require('path');
const { assembleAndWatermarkPdf } = require('../services/pdfAssembler');
const { setFileCategory } = require('../services/categoryManager');

const englishPaperConfigs = [
    { name: 'The Hindu', url: 'https://dailyepaper.in/the-hindu-epaper-free-download-feb-2026/', multiCity: true },
    { name: 'Hindu Analysis', url: 'https://dailyepaper.in/the-hindu-analysis-free-download-in-pdf-2026/', multiCity: false },
    { name: 'Times of India', url: 'https://dailyepaper.in/times-of-india-epaper-pdf-free-download-2026/', multiCity: true },
    { name: 'Economic Times', url: 'https://dailyepaper.in/economic-times-newspaper-today-2026/', multiCity: true },
    { name: 'Financial Express', url: 'https://dailyepaper.in/financial-express-newspaper-free-download-2026/', multiCity: true },
    { name: 'The Telegraph', url: 'https://dailyepaper.in/the-telegraph-newspaper-free-download-2026/', isTelegraph: true },
    { name: 'Deccan Chronicle', url: 'https://dailyepaper.in/deccan-chronicle-epaper-download-2026/', multiCity: false },
    { name: 'Statesman', url: 'https://dailyepaper.in/statesman-newspaper-today-free-download-2026/', multiCity: false },
    { name: 'The Tribune', url: 'https://dailyepaper.in/the-tribune-epaper-free-download-2026/', multiCity: false },
    { name: 'The Asian Age', url: 'https://dailyepaper.in/the-asian-age-epaper-free-download-2026/', multiCity: false },
    { name: 'The Pioneer', url: 'https://dailyepaper.in/the-pioneer-epaper-free-download-2026/', multiCity: false },
    { name: 'Free Press Journal', url: 'https://dailyepaper.in/the-free-press-journal-epaper-download/', multiCity: true },
    { name: 'Business Standard', url: 'https://dailyepaper.in/business-standard-epaper-feb-2026/', multiCity: true },
    { name: 'Live Mint', url: 'https://dailyepaper.in/live-mint-epaper-feb-2026/', multiCity: false },
    { name: 'Hans India', url: 'https://dailyepaper.in/hans-india-epaper-today-pdf-download-feb-2026/', multiCity: false },
    { name: 'Deccan Herald', url: 'https://dailyepaper.in/deccan-herald-epaper-feb-2026/', multiCity: false },
    { name: 'Hindustan Times', url: 'https://dailyepaper.in/hindustan-times-epaper-download-2026/', multiCity: true },
    { name: 'Lokmat Times', url: 'https://dailyepaper.in/lokmat-times-epaper-download-2026/', multiCity: false },
    { name: 'Ahmedabad Mirror', url: 'https://dailyepaper.in/ahmedabad-mirror-epaper-download-2026/', multiCity: false },
    { name: 'Telangana Today', url: 'https://dailyepaper.in/telangana-today-epaper-download-2026/', multiCity: false }
];

let catalogCache = {
    dateStr: '',
    timestamp: 0,
    papers: []
};

function extractGdriveId(url) {
    if (!url) return null;
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
}

/**
 * Scrapes English Indian Newspapers for a specific date (YYYY-MM-DD).
 * City edition rule: ONLY Delhi and Mumbai editions are kept if multi-city, or single main edition.
 */
async function getIndianPapersByDate(dateStr) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const targetDate = dateStr || todayStr;

    if (catalogCache.dateStr === targetDate && (Date.now() - catalogCache.timestamp) < 600000 && catalogCache.papers.length > 0) {
        console.log(`[IndianPaper] Serving ${catalogCache.papers.length} cached papers for ${targetDate}`);
        return catalogCache.papers;
    }

    console.log(`[IndianPaper] Scraping English Indian newspapers for target date: ${targetDate}...`);
    const papers = [];

    for (const paperConfig of englishPaperConfigs) {
        try {
            let html = '';
            let coverImage = '';
            try {
                const res = await fetch(paperConfig.url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    signal: AbortSignal.timeout(15000)
                });
                if (res.ok) {
                    html = await res.text();
                    const imgMatch = html.match(/<img[^>]+src="([^"]+\.(avif|jpg|jpeg|png|webp))"[^>]*class="[^"]*wp-post-image[^"]*"[^>]*>/i) ||
                                     html.match(/<img[^>]+src="([^"]+\.(avif|jpg|jpeg|png|webp))"[^>]*>/i);
                    coverImage = imgMatch ? imgMatch[1] : '';
                }
            } catch (errFetch) {
                console.warn(`[IndianPaper] Network fetch notice for ${paperConfig.name}:`, errFetch.message);
            }

            // Extract table rows containing date, city, and download links
            const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
            let editionsFound = [];

            for (const tr of trMatches) {
                const trHtml = tr[1];
                const trText = trHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

                const gdriveLink = [...trHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
                    .map(m => ({ href: m[1], text: m[2].replace(/<[^>]+>/g, '').trim() }))
                    .find(l => l.href.includes('drive.google') || l.href.includes('docs.google'));

                if (gdriveLink) {
                    let city = 'Main';
                    const lowerText = trText.toLowerCase();
                    if (lowerText.includes('delhi')) city = 'Delhi';
                    else if (lowerText.includes('mumbai')) city = 'Mumbai';
                    else if (lowerText.includes('bangalore') || lowerText.includes('bengaluru')) city = 'Bengaluru';
                    else if (lowerText.includes('kolkata')) city = 'Kolkata';
                    else if (lowerText.includes('chennai')) city = 'Chennai';

                    editionsFound.push({
                        date: targetDate,
                        city,
                        rawText: trText,
                        downloadUrl: gdriveLink.href,
                        fileId: extractGdriveId(gdriveLink.href)
                    });
                }
            }

            if (editionsFound.length === 0) {
                const allGLinks = [...html.matchAll(/<a[^>]+href="([^"]*drive\.google[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)]
                    .map(m => ({ href: m[1], text: m[2].replace(/<[^>]+>/g, '').trim() }));

                const mainLink = allGLinks.length > 0 ? allGLinks[0].href : 'https://drive.google.com/file/d/1CPtteqRRx4f4XBtUniGE9yFgBUXkdpLC/view';

                if (paperConfig.isTelegraph) {
                    editionsFound.push({ date: targetDate, city: 'T1', downloadUrl: mainLink, fileId: extractGdriveId(mainLink) });
                    editionsFound.push({ date: targetDate, city: 'T2', downloadUrl: mainLink, fileId: extractGdriveId(mainLink) });
                } else if (paperConfig.multiCity) {
                    editionsFound.push({ date: targetDate, city: 'Delhi', downloadUrl: mainLink, fileId: extractGdriveId(mainLink) });
                    editionsFound.push({ date: targetDate, city: 'Mumbai', downloadUrl: mainLink, fileId: extractGdriveId(mainLink) });
                } else {
                    editionsFound.push({ date: targetDate, city: 'Main', downloadUrl: mainLink, fileId: extractGdriveId(mainLink) });
                }
            } else if (paperConfig.isTelegraph) {
                const mainLink = editionsFound[0].downloadUrl;
                editionsFound = [
                    { date: targetDate, city: 'T1', downloadUrl: mainLink, fileId: extractGdriveId(mainLink) },
                    { date: targetDate, city: 'T2', downloadUrl: mainLink, fileId: extractGdriveId(mainLink) }
                ];
            } else if (paperConfig.multiCity) {
                const delhiEd = editionsFound.find(e => e.city === 'Delhi');
                const mumbaiEd = editionsFound.find(e => e.city === 'Mumbai');
                const defaultLink = editionsFound[0].downloadUrl;

                editionsFound = [
                    delhiEd || { date: targetDate, city: 'Delhi', downloadUrl: defaultLink, fileId: extractGdriveId(defaultLink) },
                    mumbaiEd || { date: targetDate, city: 'Mumbai', downloadUrl: defaultLink, fileId: extractGdriveId(defaultLink) }
                ];
            } else {
                editionsFound = [editionsFound[0]];
            }

            const seen = new Set();
            for (const ed of editionsFound) {
                const key = `${ed.city}_${ed.date}`;
                if (!seen.has(key)) {
                    seen.add(key);

                    const editionName = ed.city !== 'Main' ? ed.city : '';
                    const titleFull = editionName ? `${paperConfig.name} (${editionName})` : paperConfig.name;

                    papers.push({
                        id: `ind_${paperConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${ed.city.toLowerCase()}`,
                        name: paperConfig.name,
                        editionName,
                        title: titleFull,
                        date: targetDate,
                        city: ed.city,
                        coverImage: coverImage || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=500&q=80',
                        downloadUrl: ed.downloadUrl,
                        fileId: ed.fileId,
                        category: 'Indian Newspaper',
                        size: '25 MB',
                        postUrl: paperConfig.url
                    });
                }
            }

        } catch (err) {
            console.warn(`[IndianPaper] Error processing ${paperConfig.name}:`, err.message);
        }
    }

    if (papers.length > 0) {
        catalogCache = {
            dateStr: targetDate,
            timestamp: Date.now(),
            papers
        };
    }

    return papers;
}

/**
 * Downloads PDF stream from Google Drive or direct URL
 */
async function downloadGdrivePdf(fileId, directDownloadUrl) {
    if (directDownloadUrl && directDownloadUrl.toLowerCase().endsWith('.pdf')) {
        const res = await fetch(directDownloadUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(60000)
        });
        if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length > 5000 && buf.toString('latin1', 0, 5).includes('%PDF')) {
                return buf;
            }
        }
    }

    const gId = fileId || extractGdriveId(directDownloadUrl);
    if (!gId) {
        throw new Error('No valid Google Drive File ID available for this Indian newspaper issue.');
    }

    const directUrl = `https://drive.google.com/uc?export=download&id=${gId}`;
    console.log(`[IndianPaper] Fetching Google Drive file: ${directUrl}`);

    const res = await fetch(directUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(90000)
    });

    if (!res.ok) throw new Error(`Google Drive download failed: HTTP ${res.status}`);

    let buf = Buffer.from(await res.arrayBuffer());

    // Confirmation handling for large Google Drive files
    if (res.headers.get('content-type')?.includes('text/html')) {
        const html = buf.toString('utf8');
        const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/) || html.match(/name="confirm"\s+value="([^"]+)"/);
        if (confirmMatch) {
            const confirmToken = confirmMatch[1];
            const confirmUrl = `https://drive.google.com/uc?export=download&id=${gId}&confirm=${confirmToken}`;
            console.log(`[IndianPaper] Fetching Google Drive confirm link: ${confirmUrl}`);
            const res2 = await fetch(confirmUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(90000)
            });
            buf = Buffer.from(await res2.arrayBuffer());
        }
    }

    if (!buf || buf.length < 5000 || !buf.toString('latin1', 0, 5).includes('%PDF')) {
        throw new Error('Downloaded Google Drive file buffer is not a valid PDF.');
    }

    return buf;
}

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
 * Downloads an Indian Newspaper issue PDF into outputDir,
 * applies Newspaper Hub golden watermark banner: 'Social Media Pakistan 0342-4938217',
 * appends the 2 promo pages, and linearizes for instant WhatsApp preview.
 */
async function downloadIndianPaperIssue({ title, name, editionName, downloadUrl, fileId, date }, outputDir) {
    const datePrefix = formatDateForFilename(date);
    const safeTitle = (title || name || 'Indian Newspaper')
        .replace(/[()[\]{}]/g, '')
        .replace(/[/\\?%*:|"<>]/g, '')
        .trim();
    
    const finalFilename = `${datePrefix} ${safeTitle}.pdf`;
    const finalFilePath = path.join(outputDir, finalFilename);

    console.log(`[IndianPaper] Downloading issue for ${safeTitle}...`);
    const rawPdfBuffer = await downloadGdrivePdf(fileId, downloadUrl);

    console.log(`[IndianPaper] Watermarking & assembling PDF for ${safeTitle}...`);
    const processed = await assembleAndWatermarkPdf(rawPdfBuffer, {
        newspaperName: safeTitle,
        editionName: editionName || '',
        dateFormatted: datePrefix,
        outputPath: finalFilePath
    }, {
        watermarkText: 'Social Media Pakistan 0342-4938217',
        enableBottomBanner: true,
        enableTopBanner: false
    });

    console.log(`[IndianPaper] Finished processing ${finalFilename}: ${processed.sizeMb} MB, ${processed.pages} pages.`);
    setFileCategory(finalFilename, 'indianpaper');

    return {
        filename: finalFilename,
        sizeMb: processed.sizeMb,
        pages: processed.pages,
        url: `/output/${encodeURIComponent(finalFilename)}`
    };
}

module.exports = {
    getIndianPapersByDate,
    downloadIndianPaperIssue
};
