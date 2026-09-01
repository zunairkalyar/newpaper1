const fs = require('fs');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
};

async function inspect(name, url) {
    try {
        console.log(`\n=== Inspecting: ${name} (${url}) ===`);
        const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) });
        console.log('Status:', res.status, 'Content-Type:', res.headers.get('content-type'));
        if (res.ok) {
            const html = await res.text();
            console.log('HTML Length:', html.length);
            const mediaLinks = html.match(/https?:\/\/[^"'<>\s]+\.(?:jpg|jpeg|png|pdf)/gi) || [];
            console.log('Found media links:', mediaLinks.slice(0, 5));
        }
    } catch (e) {
        console.log(`${name} Error:`, e.message);
    }
}

async function run() {
    await inspect('Daily Express ISB', 'https://www.express.com.pk/epaper/Index.aspx?Issue=NP_ISB&Date=20260831&Pageno=1');
    await inspect('Lead Pakistan', 'https://leadpakistan.com.pk/ep/202608/31/');
    await inspect('Daily Dak', 'https://dailydak.pk/index.php?Page=1&ePaper=3165&Date=31-08-2026');
    await inspect('Daily Ibrat', 'https://dailyibrat.com/news/');
    await inspect('Pak Observer', 'https://epaper.pakobserver.net/');
}

run();
