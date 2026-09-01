const fs = require('fs');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/'
};

async function checkSite(name, url, customFn) {
    try {
        console.log(`\n========================================`);
        console.log(`🔍 Inspecting: ${name}`);
        console.log(`URL: ${url}`);
        const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) });
        console.log('Status:', res.status, 'Type:', res.headers.get('content-type'));
        if (res.ok) {
            const html = await res.text();
            if (customFn) {
                await customFn(html, url);
            } else {
                console.log('HTML Length:', html.length);
            }
        }
    } catch (e) {
        console.log(`❌ ${name} Error:`, e.message);
    }
}

async function run() {
    // 1. Business Recorder
    await checkSite('Business Recorder', 'https://epaper.brecorder.com/', async (html) => {
        const matches = html.match(/src=["']([^"']+(?:page|thumb|full)[^"']*\.jpg)["']/gi) || [];
        console.log('BRecorder image matches:', matches.slice(0, 5));
    });

    // 2. Daily Dak
    await checkSite('Daily Dak', 'https://dailydak.pk/index.php?Page=7&ePaper=3165&Date=31-08-2026', async (html) => {
        const imgs = html.match(/src=["']([^"']+\.jpg)["']/gi) || [];
        console.log('Daily Dak images:', imgs);
        const iframes = html.match(/<iframe[^>]+src=["']([^"']+)["']/gi) || [];
        console.log('Daily Dak iframes:', iframes);
    });

    // 3. Daily Ibrat
    await checkSite('Daily Ibrat', 'https://dailyibrat.com/news/', async (html) => {
        const pdfMatches = html.match(/href=["']([^"']+\.pdf)["']/gi) || [];
        console.log('Ibrat PDF links:', pdfMatches);
        const imgMatches = html.match(/src=["']([^"']+\.jpg)["']/gi) || [];
        console.log('Ibrat JPG links:', imgMatches.slice(0, 5));
    });

    // 4. Balochistan Times
    await checkSite('Balochistan Times', 'https://www.balochistantimes.pk/web/public/epaper', async (html) => {
        const pdfMatches = html.match(/href=["']([^"']+\.pdf)["']/gi) || [];
        console.log('Balochistan Times PDF links:', pdfMatches);
        const imgMatches = html.match(/src=["']([^"']+\.jpg)["']/gi) || [];
        console.log('Balochistan Times JPG links:', imgMatches.slice(0, 5));
    });

    // 5. Nai Baat
    await checkSite('Nai Baat', 'https://www.naibaat.pk/E-Paper', async (html) => {
        const imgMatches = html.match(/src=["']([^"']+\.jpg)["']/gi) || [];
        console.log('Nai Baat JPG links:', imgMatches.slice(0, 5));
    });

    // 6. Daily Aaj
    await checkSite('Daily Aaj', 'https://dailyaaj.com.pk', async (html) => {
        const imgMatches = html.match(/src=["']([^"']+\.jpg)["']/gi) || [];
        console.log('Daily Aaj JPG links:', imgMatches.slice(0, 5));
    });

    // 7. Roznama 92 News
    await checkSite('Roznama 92 News', 'https://roznama92news.com/epaper', async (html) => {
        const imgMatches = html.match(/src=["']([^"']+\.jpg)["']/gi) || [];
        console.log('92 News JPG links:', imgMatches.slice(0, 5));
    });

    // 8. Jobz.pk
    await checkSite('Jobz.pk Classifieds', 'https://www.jobz.pk/newspaper_jobs/', async (html) => {
        const links = html.match(/href=["']([^"']+(?:job|paper|ad)[^"']*)["']/gi) || [];
        console.log('Jobz.pk links:', links.slice(0, 5));
    });

    // 9. Free Magazines Top
    await checkSite('Free Magazines Top', 'https://freemagazines.top/', async (html) => {
        const links = html.match(/href=["']([^"']+\.pdf)["']/gi) || [];
        console.log('Free Magazines PDF links:', links.slice(0, 5));
    });
}

run();
