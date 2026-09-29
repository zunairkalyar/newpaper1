const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

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

async function run() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

  for (const item of arabPapers) {
    console.log(`\n=================== ${item.name} (${item.url}) ===================`);
    try {
      await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 15000 });
      const data = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a[href]")).map(a => ({
          href: a.href,
          text: a.innerText.trim()
        }));
        const pdfLinks = links.filter(l => l.href.endsWith(".pdf") || l.href.includes(".pdf") || l.href.includes("download") || l.href.includes("pdf"));
        const iframes = Array.from(document.querySelectorAll("iframe")).map(i => i.src);
        return {
          title: document.title,
          currentUrl: window.location.href,
          pdfLinks: pdfLinks.slice(0, 10),
          allLinksCount: links.length,
          iframes: iframes.slice(0, 5)
        };
      });
      console.log(JSON.stringify(data, null, 2));
    } catch(e) {
      console.log("Error probing:", e.message);
    }
  }

  await browser.close();
}
run();
