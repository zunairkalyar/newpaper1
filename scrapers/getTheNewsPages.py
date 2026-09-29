import sys, urllib.request, re, json

def get_thenews_pages(city_slug, d_str, m_str, year):
    m_int = int(m_str)
    d_int = int(d_str)
    url = f'https://e.thenews.pk/{city_slug}/{d_str}-{m_str}-{year}/page1'
    pages = []
    seen_images = set()

    def add_page(slug, title, img_name, sort_key):
        if img_name not in seen_images:
            seen_images.add(img_name)
            img_url = f'https://e.thenews.pk/static_pages/{m_int}-{d_int}-{year}/{city_slug}/mainpage/{img_name}'
            pages.append({
                'slug': slug,
                'title': title,
                'imgName': img_name,
                'imgUrl': img_url,
                'sortKey': sort_key
            })

    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://e.thenews.pk/'
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            html = r.read().decode('utf-8', errors='ignore')
            pattern = rf'<a[^>]+href=[\"\']https://e\.thenews\.pk/{city_slug}/{d_str}-{m_str}-{year}/([^\"\']+)[\"\'][^>]*>(.*?)</a>'
            matches = re.findall(pattern, html, re.DOTALL)
            for slug, raw_title in matches:
                clean_title = re.sub(r'<[^>]+>', '', raw_title).strip()
                if slug.startswith('page'):
                    m = re.search(r'page(\d+)', slug)
                    if m:
                        num = int(m.group(1))
                        add_page(slug, clean_title or f'Page {num}', f'page{num}.jpg', num)
                elif slug.startswith('money-matters'):
                    m = re.search(r'money-matters-page(\d+)', slug)
                    if m:
                        num = int(m.group(1))
                        add_page(slug, clean_title or f'Money Matters {num}', f'money-matters-page{num}.jpg', 500 + num)
                elif slug.startswith('you-page'):
                    m = re.search(r'you-page(\d+)', slug)
                    if m:
                        num = int(m.group(1))
                        add_page(slug, clean_title or f'You Magazine {num}', f'you{num}.jpg', 600 + num)
                elif slug.startswith('instep-page'):
                    m = re.search(r'instep-page(\d+)', slug)
                    if m:
                        num = int(m.group(1))
                        add_page(slug, clean_title or f'Instep {num}', f'instep{num}.jpg', 700 + num)
                elif slug.startswith('us-page'):
                    m = re.search(r'us-page(\d+)', slug)
                    if m:
                        num = int(m.group(1))
                        add_page(slug, clean_title or f'US Magazine {num}', f'us{num}.jpg', 800 + num)
                elif slug.startswith('tns-page'):
                    m = re.search(r'tns-page(\d+)', slug)
                    if m:
                        num = int(m.group(1))
                        add_page(slug, clean_title or f'The News on Sunday {num}', f'nos{num}.jpg', 900 + num)
                elif 'supp' in slug or 'supplement' in slug:
                    m = re.search(r'(\d+)', slug)
                    if m:
                        num = int(m.group(1))
                        add_page(slug, clean_title or f'Supplement {num}', f'supp{num}.jpg', 1000 + num)
                else:
                    m = re.search(r'page(\d+)', slug) or re.search(r'(\d+)', slug)
                    if m:
                        num = int(m.group(1))
                        add_page(slug, clean_title or slug, f'{slug}.jpg', 1100 + num)

    except Exception as e:
        sys.stderr.write(f'Error fetching index: {e}\n')

    # Candidate range complements to guarantee 100% zero missed pages
    for p in range(1, 35):
        add_page(f'page{p}', f'Main Page {p}', f'page{p}.jpg', p)
    for p in range(1, 20):
        add_page(f'money-matters-page{p}', f'Money Matters {p}', f'money-matters-page{p}.jpg', 500 + p)
        add_page(f'money-matters-page{p}', f'Money Matters {p}', f'mm{p}.jpg', 550 + p)
    for p in range(1, 20):
        add_page(f'you-page{p}', f'You Magazine {p}', f'you{p}.jpg', 600 + p)
    for p in range(1, 20):
        add_page(f'instep-page{p}', f'Instep {p}', f'instep{p}.jpg', 700 + p)
        add_page(f'instep-page{p}', f'Instep {p}', f'instep-page{p}.jpg', 750 + p)
    for p in range(1, 30):
        add_page(f'us-page{p}', f'US Magazine {p}', f'us{p}.jpg', 800 + p)
    for p in range(1, 50):
        add_page(f'tns-page{p}', f'The News on Sunday {p}', f'nos{p}.jpg', 900 + p)
    for p in range(1, 50):
        add_page(f'supp-page{p}', f'Supplement {p}', f'supp{p}.jpg', 1000 + p)

    pages.sort(key=lambda x: x['sortKey'])
    return pages

if __name__ == '__main__':
    city = sys.argv[1] if len(sys.argv) > 1 else 'karachi'
    d = sys.argv[2] if len(sys.argv) > 2 else '14'
    m = sys.argv[3] if len(sys.argv) > 3 else '09'
    y = sys.argv[4] if len(sys.argv) > 4 else '2026'
    pages = get_thenews_pages(city, d, m, y)
    print(json.dumps(pages))
