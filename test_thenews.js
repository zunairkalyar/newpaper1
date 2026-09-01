async function test() {
    const res = await fetch('https://e.thenews.pk/lahore/31-08-2026/page1', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const imgs = html.match(/src="([^"]+)"/gi) || [];
    console.log('All src attributes on Lahore page 1:', imgs.slice(0, 15));
}
test();
