import sys, urllib.request, re, json

def get_slots(date_str):
    url = f'https://epaper.dawn.com/?page={date_str}_001'
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            matches = re.findall(r'href=[\"\']([^\"\']*page=[0-9]{2}_[0-9]{2}_[0-9]{4}_([0-9]{3}))[\"\'][^>]*>(.*?)</a>', html, re.DOTALL)
            slots = []
            seen = set()
            for full_href, slot_str, text in matches:
                clean_text = re.sub(r'<[^>]+>', '', text).strip()
                slot_num = int(slot_str)
                if slot_num not in seen:
                    seen.add(slot_num)
                    slots.append({'slot': slot_num, 'slotStr': slot_str, 'title': clean_text})
            return slots
    except Exception as e:
        sys.stderr.write(f"Error fetching slots: {e}\n")
        return []

if __name__ == '__main__':
    date_arg = sys.argv[1] if len(sys.argv) > 1 else '06_09_2026'
    slots = get_slots(date_arg)
    print(json.dumps(slots))
