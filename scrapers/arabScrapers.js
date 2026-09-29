const fs = require('fs');
const path = require('path');
const { assembleAndWatermarkPdf } = require('../services/pdfAssembler');
const { setFileCategory } = require('../services/categoryManager');

const HTTP_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,application/pdf,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function fetchPdfBuffer(url) {
    const res = await fetch(url, {
        headers: HTTP_HEADERS,
        signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} fetching PDF from ${url}`);
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
}

async function fetchHtmlText(url) {
    const res = await fetch(url, {
        headers: HTTP_HEADERS,
        signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} fetching HTML from ${url}`);
    }
    return await res.text();
}

function extractPdfLinks(htmlText, baseUrl) {
    const pdfLinks = [];
    const regex = /[\"']([^\"']*\.pdf[^\"']*)[\"']/gi;
    let match;
    while ((match = regex.exec(htmlText)) !== null) {
        let raw = match[1].trim();
        let parts = raw.split(',');
        for (let link of parts) {
            link = link.trim().replace(/^href=["']/, '').replace(/["']$/, '');
            if (link && !link.includes('<style') && !link.includes('font-family')) {
                if (!link.startsWith('http')) {
                    try {
                        link = new URL(link, baseUrl).href;
                    } catch (_) {
                        continue;
                    }
                }
                if (!pdfLinks.includes(link)) pdfLinks.push(link);
            }
        }
    }
    return pdfLinks;
}

function getDateFormats(targetDateStr) {
    let d = targetDateStr ? new Date(targetDateStr) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    
    const YYYY = d.getFullYear().toString();
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const DD = String(d.getDate()).padStart(2, '0');
    const monthShort = MONTHS_SHORT[d.getMonth()];
    const dateFormatted = `${DD} ${monthShort} ${YYYY}`;
    const dateFormattedHyphen = `${DD}-${MM}-${YYYY}`;
    
    return { d, YYYY, MM, DD, monthShort, dateFormatted, dateFormattedHyphen };
}

/**
 * ARAB NEWSPAPER CATALOG (22 Editions)
 */
const ARAB_NEWSPAPER_CATALOG = [
    // Gulf Times (Qatar)
    { id: 'arab_gulf_times_main', code: 'GT-MAIN', name: 'Gulf Times Main Edition', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapeGulfTimesMain },
    { id: 'arab_gulf_times_biz', code: 'GT-BIZ', name: 'Gulf Times Business', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapeGulfTimesBiz },
    { id: 'arab_gulf_times_sport', code: 'GT-SPORT', name: 'Gulf Times Sport', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapeGulfTimesSport },

    // Qatar Tribune (Qatar)
    { id: 'arab_qatar_tribune_main', code: 'QT-MAIN', name: 'Qatar Tribune Main', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapeQatarTribuneMain },
    { id: 'arab_qatar_tribune_biz', code: 'QT-BIZ', name: 'Qatar Tribune Business', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapeQatarTribuneBiz },
    { id: 'arab_qatar_tribune_sport', code: 'QT-SPORT', name: 'Qatar Tribune Sport', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapeQatarTribuneSport },

    // The Peninsula (Qatar)
    { id: 'arab_peninsula_main', code: 'PEN-MAIN', name: 'The Peninsula Main Edition', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapePeninsulaMain },
    { id: 'arab_peninsula_biz', code: 'PEN-BIZ', name: 'The Peninsula Business', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapePeninsulaBiz },
    { id: 'arab_peninsula_sport', code: 'PEN-SPORT', name: 'The Peninsula Sport', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapePeninsulaSport },

    // Al Sharq (Qatar)
    { id: 'arab_al_sharq', code: 'SHARQ', name: 'Al Sharq', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapeAlSharq },

    // Al Watan (Qatar)
    { id: 'arab_al_watan_main', code: 'WATAN-MAIN', name: 'Al Watan Main Edition', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapeAlWatanMain },
    { id: 'arab_al_watan_sport', code: 'WATAN-SPORT', name: 'Al Watan Sport', city: 'Doha, Qatar', country: 'Qatar', scraper: scrapeAlWatanSport },

    // Akhbar Al Khaleej (Bahrain)
    { id: 'arab_akhbar_alkhaleej', code: 'KHALEJ', name: 'Akhbar Al Khaleej', city: 'Manama, Bahrain', country: 'Bahrain', scraper: scrapeAkhbarAlKhaleej },

    // Arab Times Online (Kuwait)
    { id: 'arab_arab_times', code: 'AT-ONLINE', name: 'Arab Times Online', city: 'Kuwait City, Kuwait', country: 'Kuwait', scraper: scrapeArabTimes },

    // Kuwait Times (Kuwait)
    { id: 'arab_kuwait_times', code: 'KT-KW', name: 'Kuwait Times', city: 'Kuwait City, Kuwait', country: 'Kuwait', scraper: scrapeKuwaitTimes },

    // Al Qabas (Kuwait)
    { id: 'arab_al_qabas', code: 'QABAS', name: 'Al Qabas', city: 'Kuwait City, Kuwait', country: 'Kuwait', scraper: scrapeAlQabas },

    // Tehran Times (Iran)
    { id: 'arab_tehran_times', code: 'TEHRAN', name: 'Tehran Times', city: 'Tehran, Iran', country: 'Iran', scraper: scrapeTehranTimes },

    // Oman Daily (Oman)
    { id: 'arab_oman_daily', code: 'OMAN', name: 'Oman Daily', city: 'Muscat, Oman', country: 'Oman', scraper: scrapeOmanDaily },

    // Arab News (Saudi Arabia)
    { id: 'arab_arab_news', code: 'AN-SA', name: 'Arab News', city: 'Riyadh, Saudi Arabia', country: 'Saudi Arabia', scraper: scrapeArabNews },

    // Al Madina (Saudi Arabia)
    { id: 'arab_al_madina', code: 'MADINA', name: 'Al Madina', city: 'Jeddah, Saudi Arabia', country: 'Saudi Arabia', scraper: scrapeAlMadina },

    // Al Quds Al Arabi (London/Middle East)
    { id: 'arab_al_quds', code: 'QUDS', name: 'Al Quds Al Arabi', city: 'London / Middle East', country: 'International', scraper: scrapeAlQuds }
];

/* ==========================================================================
   SCRAPER IMPLEMENTATIONS
   ========================================================================== */

// 1. Gulf Times Main
async function scrapeGulfTimesMain(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText('https://www.gulf-times.com/pdfs');
        const links = extractPdfLinks(html, 'https://www.gulf-times.com');
        const match = links.find(l => l.includes(`${YYYY}/${MM}/${DD}`) && l.includes('main'));
        if (match) return await fetchPdfBuffer(match);
    } catch (_) {}
    const fallbacks = [
        `https://www.gulf-times.com/gulftimes/uploads/pdf/${YYYY}/${MM}/${DD}/main-${YYYY}${MM}${DD}-1.pdf`,
        `https://www.gulf-times.com/uploads/pdf/${YYYY}/${MM}/${DD}/${YYYY}${MM}${DD}_1.pdf`
    ];
    for (const f of fallbacks) {
        try { return await fetchPdfBuffer(f); } catch (_) {}
    }
    throw new Error(`Gulf Times Main PDF not available for ${YYYY}-${MM}-${DD}`);
}

// 2. Gulf Times Business
async function scrapeGulfTimesBiz(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText('https://www.gulf-times.com/pdfs');
        const links = extractPdfLinks(html, 'https://www.gulf-times.com');
        const match = links.find(l => l.includes(`${YYYY}/${MM}/${DD}`) && l.includes('business'));
        if (match) return await fetchPdfBuffer(match);
    } catch (_) {}
    const fallbacks = [
        `https://www.gulf-times.com/gulftimes/uploads/pdf/${YYYY}/${MM}/${DD}/business-${YYYY}${MM}${DD}-1.pdf`,
        `https://www.gulf-times.com/uploads/pdf/${YYYY}/${MM}/${DD}/${YYYY}${MM}${DD}_2.pdf`
    ];
    for (const f of fallbacks) {
        try { return await fetchPdfBuffer(f); } catch (_) {}
    }
    throw new Error(`Gulf Times Business PDF not available for ${YYYY}-${MM}-${DD}`);
}

// 3. Gulf Times Sport
async function scrapeGulfTimesSport(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText('https://www.gulf-times.com/pdfs');
        const links = extractPdfLinks(html, 'https://www.gulf-times.com');
        const match = links.find(l => l.includes(`${YYYY}/${MM}/${DD}`) && l.includes('sport'));
        if (match) return await fetchPdfBuffer(match);
    } catch (_) {}
    const fallbacks = [
        `https://www.gulf-times.com/gulftimes/uploads/pdf/${YYYY}/${MM}/${DD}/sport-${YYYY}${MM}${DD}-1.pdf`,
        `https://www.gulf-times.com/uploads/pdf/${YYYY}/${MM}/${DD}/${YYYY}${MM}${DD}_3.pdf`
    ];
    for (const f of fallbacks) {
        try { return await fetchPdfBuffer(f); } catch (_) {}
    }
    throw new Error(`Gulf Times Sport PDF not available for ${YYYY}-${MM}-${DD}`);
}

// 4. Qatar Tribune Main
async function scrapeQatarTribuneMain(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText('https://www.qatar-tribune.com/pdf');
        const links = extractPdfLinks(html, 'https://www.qatar-tribune.com');
        const match = links.find(l => l.includes(`${YYYY}/${MM}/${DD}`) && !l.includes('business') && !l.includes('sport') && (l.includes('qatartribune') || l.includes('main')));
        if (match) return await fetchPdfBuffer(match);
    } catch (_) {}
    const fallbacks = [
        `https://www.qatar-tribune.com/uploads/pdf/${YYYY}/${MM}/${DD}/qatartribune-${YYYY}${MM}${DD}-1.pdf`,
        `https://www.qatar-tribune.com/uploads/pdf/${YYYY}/${MM}/${DD}/${YYYY}${MM}${DD}_1.pdf`
    ];
    for (const f of fallbacks) {
        try { return await fetchPdfBuffer(f); } catch (_) {}
    }
    throw new Error(`Qatar Tribune Main PDF not available for ${YYYY}-${MM}-${DD}`);
}

// 5. Qatar Tribune Business
async function scrapeQatarTribuneBiz(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText('https://www.qatar-tribune.com/pdf');
        const links = extractPdfLinks(html, 'https://www.qatar-tribune.com');
        const match = links.find(l => l.includes(`${YYYY}/${MM}/${DD}`) && l.includes('business'));
        if (match) return await fetchPdfBuffer(match);
    } catch (_) {}
    const fallbacks = [
        `https://www.qatar-tribune.com/uploads/pdf/${YYYY}/${MM}/${DD}/qatartribune-business-${YYYY}${MM}${DD}-1.pdf`,
        `https://www.qatar-tribune.com/uploads/pdf/${YYYY}/${MM}/${DD}/${YYYY}${MM}${DD}_2.pdf`
    ];
    for (const f of fallbacks) {
        try { return await fetchPdfBuffer(f); } catch (_) {}
    }
    throw new Error(`Qatar Tribune Business PDF not available for ${YYYY}-${MM}-${DD}`);
}

// 6. Qatar Tribune Sport
async function scrapeQatarTribuneSport(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText('https://www.qatar-tribune.com/pdf');
        const links = extractPdfLinks(html, 'https://www.qatar-tribune.com');
        const match = links.find(l => l.includes(`${YYYY}/${MM}/${DD}`) && l.includes('sport'));
        if (match) return await fetchPdfBuffer(match);
    } catch (_) {}
    const fallbacks = [
        `https://www.qatar-tribune.com/uploads/pdf/${YYYY}/${MM}/${DD}/qatartribune-sport-${YYYY}${MM}${DD}-1.pdf`,
        `https://www.qatar-tribune.com/uploads/pdf/${YYYY}/${MM}/${DD}/${YYYY}${MM}${DD}_3.pdf`
    ];
    for (const f of fallbacks) {
        try { return await fetchPdfBuffer(f); } catch (_) {}
    }
    throw new Error(`Qatar Tribune Sport PDF not available for ${YYYY}-${MM}-${DD}`);
}

// 7. The Peninsula Main, Business, Sport
async function scrapePeninsulaEdition(targetDateStr, editionType) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText(`https://thepeninsulaqatar.com/issuesCategories?date=${YYYY}-${MM}-${DD}`);
        const itemRegex = /<div[^>]*class=[\"'][^\"']*itpdf[^\"']*[\"'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
        let match;
        while ((match = itemRegex.exec(html)) !== null) {
            const block = match[1];
            const viewM = block.match(/\/pdf-view\/[^\"]+/);
            const titleM = block.match(/class=[\"']title[^\"']*[\"'][^>]*>([^<]+)/i);
            if (viewM && titleM) {
                const title = titleM[1].trim().toLowerCase();
                const pdfUrl = 'https://thepeninsulaqatar.com' + viewM[0].replace('/pdf-view/', '/pdf-file/');
                if (editionType === 'biz' && title.includes('business')) {
                    return await fetchPdfBuffer(pdfUrl);
                }
                if (editionType === 'sport' && (title.includes('sport') || title.includes('sports'))) {
                    return await fetchPdfBuffer(pdfUrl);
                }
                if (editionType === 'main' && (title.includes('peninsula') || title.includes('main') || (!title.includes('business') && !title.includes('sport')))) {
                    return await fetchPdfBuffer(pdfUrl);
                }
            }
        }
    } catch (_) {}
    const fallbackSuffix = editionType === 'biz' ? 'business' : editionType === 'sport' ? 'sport' : 'main';
    const pdfUrl = `https://thepeninsulaqatar.com/pdf-file/${YYYY}${MM}${DD}_${fallbackSuffix}.pdf`;
    return await fetchPdfBuffer(pdfUrl);
}

async function scrapePeninsulaMain(targetDateStr) { return scrapePeninsulaEdition(targetDateStr, 'main'); }
async function scrapePeninsulaBiz(targetDateStr) { return scrapePeninsulaEdition(targetDateStr, 'biz'); }
async function scrapePeninsulaSport(targetDateStr) { return scrapePeninsulaEdition(targetDateStr, 'sport'); }

// 10. Al Sharq
async function scrapeAlSharq(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText(`https://m.al-sharq.com/issues`);
        const links = extractPdfLinks(html, 'https://m.al-sharq.com');
        if (links.length > 0) return await fetchPdfBuffer(links[0]);
    } catch (_) {}
    const pdfUrl = `https://al-sharq.com/pdf/sharq_${YYYY}${MM}${DD}.pdf`;
    return await fetchPdfBuffer(pdfUrl);
}

// 11. Al Watan Qatar Main
async function scrapeAlWatanMain(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText('https://www.al-watan.com/pdf');
        const links = extractPdfLinks(html, 'https://www.al-watan.com');
        const match = links.find(l => l.includes(`${YYYY}/${MM}/${DD}`) && !l.includes('sport') && (l.includes('watan-') || l.includes('watan_')));
        if (match) return await fetchPdfBuffer(match);
    } catch (_) {}
    const fallbacks = [
        `https://www.al-watan.com/uploads/pdf/${YYYY}/${MM}/${DD}/watan-${YYYY}${MM}${DD}-1.pdf`,
        `https://www.al-watan.com/uploads/pdf/${YYYY}/${MM}/${DD}/${YYYY}${MM}${DD}_1.pdf`
    ];
    for (const f of fallbacks) {
        try { return await fetchPdfBuffer(f); } catch (_) {}
    }
    throw new Error(`Al Watan Main PDF not available for ${YYYY}-${MM}-${DD}`);
}

// 12. Al Watan Qatar Sport
async function scrapeAlWatanSport(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText('https://www.al-watan.com/pdf');
        const links = extractPdfLinks(html, 'https://www.al-watan.com');
        const match = links.find(l => l.includes(`${YYYY}/${MM}/${DD}`) && l.includes('sport'));
        if (match) return await fetchPdfBuffer(match);
    } catch (_) {}
    const fallbacks = [
        `https://www.al-watan.com/uploads/pdf/${YYYY}/${MM}/${DD}/sport-${YYYY}${MM}${DD}-1.pdf`,
        `https://www.al-watan.com/uploads/pdf/${YYYY}/${MM}/${DD}/${YYYY}${MM}${DD}_2.pdf`
    ];
    for (const f of fallbacks) {
        try { return await fetchPdfBuffer(f); } catch (_) {}
    }
    throw new Error(`Al Watan Sport PDF not available for ${YYYY}-${MM}-${DD}`);
}

// 13. Al Ayam (Bahrain)
async function scrapeAlAyam(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText(`https://www.alayam.com/epaper`);
        const pdfMatches = html.match(/https:\/\/i\.alayam\.com\/[^\"]+\.pdf/g);
        if (pdfMatches && pdfMatches.length > 0) {
            const mainPdf = pdfMatches.find(p => p.includes('INAF_')) || pdfMatches[0];
            return await fetchPdfBuffer(mainPdf);
        }
    } catch (_) {}
    const pdfUrl = `https://www.alayam.com/pdf/${YYYY}/${MM}/${DD}/issue.pdf`;
    return await fetchPdfBuffer(pdfUrl);
}

// 14. Akhbar Al Khaleej (Bahrain)
async function scrapeAkhbarAlKhaleej(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText(`https://www.akhbar-alkhaleej.com/`);
        const pdfMatches = html.match(/https:\/\/media\.akhbar-alkhaleej\.com\/source\/[^\"]+\.pdf[^\"]*/g);
        if (pdfMatches && pdfMatches.length > 0) {
            const cleanUrl = pdfMatches[0].split('?')[0];
            return await fetchPdfBuffer(cleanUrl);
        }
    } catch (_) {}
    const pdfUrl = `https://media.akhbar-alkhaleej.com/source/17713/pdf/1-Supplime/17713.pdf`;
    return await fetchPdfBuffer(pdfUrl);
}

// 15. Arab Times Online (Kuwait)
async function scrapeArabTimes(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText(`https://www.arabtimesonline.com/news/category/e-paper/`);
        const postMatches = html.match(/https:\/\/www\.arabtimesonline\.com\/news\/[^\"]*epaper[^\"]*/g);
        if (postMatches && postMatches.length > 0) {
            const postHtml = await fetchHtmlText(postMatches[0]);
            const pdfMatches = postHtml.match(/https:\/\/www\.arabtimesonline\.com\/arabtimes\/uploads\/[^\"]+\.pdf/g);
            if (pdfMatches && pdfMatches.length > 0) {
                return await fetchPdfBuffer(pdfMatches[0]);
            }
        }
    } catch (_) {}
    const pdfUrl = `http://www.arabtimesonline.com/news/wp-content/uploads/${YYYY}/${MM}/ArabTimes_${YYYY}${MM}${DD}.pdf`;
    return await fetchPdfBuffer(pdfUrl);
}

// 16. Kuwait Times
async function scrapeKuwaitTimes(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText(`https://www.kuwaittimes.com/category/e-paper/`);
        const links = extractPdfLinks(html, 'https://www.kuwaittimes.com');
        if (links.length > 0) return await fetchPdfBuffer(links[0]);
    } catch (_) {}
    const pdfUrl = `https://www.kuwaittimes.com/wp-content/uploads/${YYYY}/${MM}/KuwaitTimes_${YYYY}${MM}${DD}.pdf`;
    return await fetchPdfBuffer(pdfUrl);
}

// 17. Al Qabas
async function scrapeAlQabas(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText(`https://alqabas.com/`);
        const links = extractPdfLinks(html, 'https://alqabas.com');
        if (links.length > 0) return await fetchPdfBuffer(links[0]);
    } catch (_) {}
    const pdfUrl = `https://alqabas.com/pdf/${YYYY}/${MM}/${DD}/alqabas.pdf`;
    return await fetchPdfBuffer(pdfUrl);
}

// 18. Tehran Times
async function scrapeTehranTimes(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText(`https://www.tehrantimes.com/service/newspaper`);
        const pdfMatches = html.match(/https:\/\/media\.(mehrnews|tehrantimes)\.com\/[^\"]+\.pdf[^\"]*/gi);
        if (pdfMatches && pdfMatches.length > 0) {
            let firstMatch = pdfMatches[0].split(',')[0].replace(/&amp;/g, '&');
            return await fetchPdfBuffer(firstMatch);
        }
    } catch (err) {
        console.error('[scrapeTehranTimes error]:', err.message);
    }
    const pdfUrl = `https://media.tehrantimes.com/d/${YYYY}/${MM}/${DD}/4.pdf`;
    return await fetchPdfBuffer(pdfUrl);
}

// 19. Oman Daily
async function scrapeOmanDaily(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    const directPdfUrl = `https://www.omandaily.om/pdf/${YYYY}/${MM}/${DD}/oman-${YYYY}${MM}${DD}-1.pdf`;
    try {
        return await fetchPdfBuffer(directPdfUrl);
    } catch (_) {}
    try {
        const html = await fetchHtmlText(`https://www.omandaily.om/الصفحات-الكاملة`);
        const links = extractPdfLinks(html, 'https://www.omandaily.om');
        if (links.length > 0) return await fetchPdfBuffer(links[0]);
    } catch (_) {}
    throw new Error(`Oman Daily PDF not available for ${YYYY}-${MM}-${DD}`);
}

// 20. Arab News (Saudi Arabia)
async function scrapeArabNews(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const html = await fetchHtmlText(`https://www.arabnews.com/pdfissues.php`);
        const issueMatch = html.match(/Digital Newspaper (\d+)/);
        if (issueMatch) {
            const issueId = issueMatch[1];
            const pdfUrl = `https://www.arabnews.com/sites/default/files/pdf/${issueId}/files/assets/common/downloads/publication.pdf`;
            return await fetchPdfBuffer(pdfUrl);
        }
    } catch (_) {}
    const fallbackUrl = `https://www.arabnews.com/sites/default/files/pdf/51289/files/assets/common/downloads/publication.pdf`;
    return await fetchPdfBuffer(fallbackUrl);
}

// 21. Al Madina (Saudi Arabia)
async function scrapeAlMadina(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const pdfUrl = `https://www.al-madina.com/pdf/${YYYY}/${MM}/${DD}/madina-${YYYY}${MM}${DD}.pdf`;
        return await fetchPdfBuffer(pdfUrl);
    } catch (_) {}
    const html = await fetchHtmlText(`https://www.al-madina.com/archivepdf`);
    const links = extractPdfLinks(html, 'https://www.al-madina.com');
    if (links.length > 0) return await fetchPdfBuffer(links[0]);
    throw new Error(`Al Madina PDF not available for ${YYYY}-${MM}-${DD}`);
}

// 22. Al Quds Al Arabi
async function scrapeAlQuds(targetDateStr) {
    const { YYYY, MM, DD } = getDateFormats(targetDateStr);
    try {
        const pdfUrl = `https://pdf.alquds.co.uk/wp-content/uploads/${YYYY}/${MM}/Alquds-${YYYY}-${MM}-${DD}.pdf`;
        return await fetchPdfBuffer(pdfUrl);
    } catch (_) {}
    const html = await fetchHtmlText(`https://www.alquds.co.uk/`);
    const links = extractPdfLinks(html, 'https://pdf.alquds.co.uk');
    const match = links.find(l => l.includes('Alquds-20') || l.includes('pdf'));
    if (match) return await fetchPdfBuffer(match);
    throw new Error(`Al Quds PDF not available for ${YYYY}-${MM}-${DD}`);
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
        m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (m) {
            const monthIdx = parseInt(m[2], 10) - 1;
            const day = parseInt(m[1], 10);
            if (monthIdx >= 0 && monthIdx < 12) {
                return `${day} ${months[monthIdx]}`;
            }
        }
        m = str.match(/^(\d{1,2})[-_\s]+([A-Za-z]{3})/);
        if (m) {
            const day = parseInt(m[1], 10);
            const monStr = m[2];
            const monFormatted = monStr.charAt(0).toUpperCase() + monStr.slice(1, 3).toLowerCase();
            return `${day} ${monFormatted}`;
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
 * Process single Arab News edition: scrape raw PDF, apply assembleAndWatermarkPdf
 * Output Filename Format: "DD MMM YYYY Paper Name.pdf" (e.g. "21 Sep 2026 Gulf Times Main Edition.pdf")
 */
async function processArabEdition(editionId, targetDateStr) {
    const item = ARAB_NEWSPAPER_CATALOG.find(e => e.id === editionId);
    if (!item) throw new Error(`Unknown edition ID: ${editionId}`);

    const { YYYY, MM, DD, dateFormatted } = getDateFormats(targetDateStr);
    const datePrefix = formatDateForFilename(targetDateStr);
    
    // Output directory & clean descriptive filename matching Newspaper Hub / Khaliq pattern
    const outputDir = '/www/wwwroot/newspaper.kalyartraders.com/output';
    const cleanFileName = `${datePrefix} ${item.name}.pdf`;
    const outputPath = path.join(outputDir, cleanFileName);

    // Download raw PDF buffer
    const rawBuffer = await item.scraper(targetDateStr);
    if (!rawBuffer || rawBuffer.length < 5000) {
        throw new Error(`Failed to retrieve valid PDF for ${item.name} (${dateFormatted})`);
    }

    // Assemble and Watermark PDF (100% original quality, zero loss compression)
    const result = await assembleAndWatermarkPdf(rawBuffer, {
        newspaperName: item.name,
        editionName: item.city,
        dateFormatted: dateFormatted,
        outputPath: outputPath
    });

    setFileCategory(cleanFileName, 'arabnews');
    const webUrl = `/output/${encodeURIComponent(cleanFileName)}`;
    return {
        ...result,
        filename: cleanFileName,
        webUrl,
        editionId: item.id,
        name: item.name,
        city: item.city,
        country: item.country
    };
}

module.exports = {
    ARAB_NEWSPAPER_CATALOG,
    processArabEdition
};
