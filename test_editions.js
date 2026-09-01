async function test() {
    for (const ed of ['karachi', 'lahore', 'pindi']) {
        try {
            const res = await fetch(`https://e.thenews.pk/${ed}/31-08-2026/page1`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const text = await res.text();
            const m = text.match(/downloadFile\('([^']+)'/);
            console.log(`\n=== ${ed} ===`);
            console.log('Download link in HTML:', m ? m[1] : 'Not found');
            
            // Check all page links
            const pageLinks = [];
            const regex = new RegExp(`href="([^"]*${ed}[^"]*page\\d+)"`, 'g');
            let p;
            while ((p = regex.exec(text)) !== null) {
                pageLinks.push(p[1]);
            }
            console.log('Pages found:', [...new Set(pageLinks)]);
            
            // Check images
            const imgRegex = /src="([^"]+static_pages[^"]+)"/g;
            let img;
            while ((img = imgRegex.exec(text)) !== null) {
                console.log('Main image:', img[1]);
            }
        } catch (e) {
            console.error(ed, 'Error:', e.message);
        }
    }
}

test();
