const fs = require('fs');

async function testLead() {
    const res = await fetch('https://leadpakistan.com.pk/ep/202608/31/index.php');
    const html = await res.text();
    const map = html.match(/<map[\s\S]*?<\/map>/i);
    const imgMatches = html.match(/src="([^"]+)"/gi) || [];
    console.log('\n=== Lead Pakistan index.php ===');
    console.log('All src images:', imgMatches);
}

async function testPakObserver() {
    const res = await fetch('https://epaper.pakobserver.net/');
    const html = await res.text();
    const imgs = html.match(/src="([^"]+)"/gi) || [];
    console.log('\n=== Pak Observer ===');
    console.log('Images:', imgs);
}

async function testDailyDak() {
    const res = await fetch('https://dailydak.pk/index.php?Page=1&ePaper=3165&Date=31-08-2026');
    const html = await res.text();
    const imgs = html.match(/src="([^"]+)"/gi) || [];
    console.log('\n=== Daily Dak ===');
    console.log('Images:', imgs);
}

async function testDailyIbrat() {
    const res = await fetch('https://dailyibrat.com/news/');
    const html = await res.text();
    const imgs = html.match(/src="([^"]+)"/gi) || [];
    console.log('\n=== Daily Ibrat ===');
    console.log('Images:', imgs.slice(0, 10));
}

async function testAusaf() {
    const res = await fetch('https://epaper.dailyausaf.com/');
    const html = await res.text();
    const imgs = html.match(/src="([^"]+)"/gi) || [];
    console.log('\n=== Daily Ausaf ===');
    console.log('Images:', imgs.slice(0, 10));
}

async function test92News() {
    try {
        const res = await fetch('https://roznama92news.com/epaper/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://roznama92news.com/'
            }
        });
        console.log('\n=== 92 News ===', res.status);
        if (res.ok) {
            const html = await res.text();
            console.log('92 News HTML length:', html.length);
        }
    } catch (e) {
        console.log('92 News error:', e.message);
    }
}

async function run() {
    await testLead();
    await testPakObserver();
    await testDailyDak();
    await testDailyIbrat();
    await testAusaf();
    await test92News();
}

run();
