const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
};

async function test() {
    const res = await fetch('https://dailyaaj.com.pk/', { headers: BROWSER_HEADERS });
    const html = await res.text();
    const imgs = html.match(/src="([^"]+\.jpg)"/gi) || [];
    console.log('All JPGs with Browser Headers:', imgs);
}
test();
