const arabPapers = [
  { name: "Gulf Times", url: "https://www.gulf-times.com/pdfs" },
  { name: "Al Ayam", url: "https://www.alayam.com/epaper" },
  { name: "Al Sharq", url: "https://m.al-sharq.com/issues" },
  { name: "Qatar Tribune", url: "https://www.qatar-tribune.com/pdf" },
  { name: "Arab Times Online", url: "https://www.arabtimesonline.com/news/category/e-paper/" },
  { name: "Kuwait Times", url: "https://www.kuwaittimes.com/category/e-paper/" },
  { name: "Al Qabas", url: "https://alqabas.com/" },
  { name: "Akhbar Al Khaleej", url: "https://www.akhbar-alkhaleej.com/" },
  { name: "Tehran Times", url: "https://www.tehrantimes.com/service/newspaper" },
  { name: "Oman Daily", url: "https://www.omandaily.om/" },
  { name: "Arab News", url: "https://www.arabnews.com/pdfissues.php" },
  { name: "Al Watan", url: "https://www.al-watan.com/pdf" },
  { name: "Al Madina", url: "https://www.al-madina.com/archivepdf" },
  { name: "Al Quds", url: "https://pdf.alquds.co.uk/" },
  { name: "The Peninsula Qatar", url: "https://thepeninsulaqatar.com/issuesCategories?date=00:00" }
];

async function check() {
  for (const p of arabPapers) {
    try {
      const res = await fetch(p.url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(8000)
      });
      const html = await res.text();
      const pdfMatches = html.match(/(?:https?:\/\/[^\s"'\x27<>]+\.pdf|\/[^\s"'\x27<>]+\.pdf)/gi) || [];
      console.log(`[${res.status}] ${p.name} => PDFs found: ${pdfMatches.length}`);
      if (pdfMatches.length > 0) {
        console.log("  Sample PDFs:", pdfMatches.slice(0, 3));
      }
    } catch(e) {
      console.log(`[ERR] ${p.name} => ${e.message}`);
    }
  }
}
check();
