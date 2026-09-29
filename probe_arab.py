import urllib.request
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

papers = [
  ("Gulf Times", "https://www.gulf-times.com/pdfs"),
  ("Al Ayam", "https://www.alayam.com/epaper"),
  ("Al Sharq", "https://m.al-sharq.com/issues"),
  ("Qatar Tribune", "https://www.qatar-tribune.com/pdf"),
  ("Arab Times Online", "https://www.arabtimesonline.com/news/category/e-paper/"),
  ("Kuwait Times", "https://www.kuwaittimes.com/category/e-paper/"),
  ("Al Qabas", "https://alqabas.com/"),
  ("Akhbar Al Khaleej", "https://www.akhbar-alkhaleej.com/"),
  ("Tehran Times", "https://www.tehrantimes.com/service/newspaper"),
  ("Oman Daily", "https://www.omandaily.om/"),
  ("Arab News", "https://www.arabnews.com/pdfissues.php"),
  ("Al Watan", "https://www.al-watan.com/pdf"),
  ("Al Madina", "https://www.al-madina.com/archivepdf"),
  ("Al Quds", "https://pdf.alquds.co.uk/"),
  ("The Peninsula Qatar", "https://thepeninsulaqatar.com/issuesCategories?date=00:00")
]

for name, url in papers:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=8, context=ctx) as response:
            content = response.read().decode("utf-8", errors="ignore")
            pdfs = re.findall(r'(?:https?://[^\s"\'<>]+\.pdf|/[^\s"\'<>]+\.pdf)', content, re.IGNORECASE)
            print(f"[{response.status}] {name}: Found {len(pdfs)} PDFs")
            if pdfs:
                print(f"   -> {pdfs[:2]}")
    except Exception as e:
        print(f"[ERR] {name}: {e}")
