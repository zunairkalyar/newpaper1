const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function checkMorePapers() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

  console.log("=== 92 News ===");
  try {
    await page.goto("https://92newshd.tv/epaper", { waitUntil: "domcontentloaded", timeout: 20000 });
    const p92 = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img")).map(i => i.src);
      const links = Array.from(document.querySelectorAll("a")).map(a => a.href);
      return { title: document.title, imgs: imgs.slice(0, 10), links: links.filter(l => l.includes("92news")).slice(0, 10) };
    });
    console.log("92 News Data:", JSON.stringify(p92, null, 2));
  } catch(e) { console.log("92 News Err:", e.message); }

  console.log("=== Pakistan Observer ===");
  try {
    await page.goto("https://pakobserver.net/", { waitUntil: "domcontentloaded", timeout: 20000 });
    const po = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a")).map(a => ({ href: a.href, text: a.innerText.trim() })).filter(l => l.text.toLowerCase().includes("epaper") || l.href.toLowerCase().includes("epaper") || l.href.toLowerCase().includes("paper"));
      return { links };
    });
    console.log("PO Links:", JSON.stringify(po, null, 2));
  } catch(e) { console.log("PO Err:", e.message); }

  console.log("=== Daily Aaj ===");
  try {
    await page.goto("https://dailyaaj.com.pk/", { waitUntil: "domcontentloaded", timeout: 20000 });
    const aaj = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a")).map(a => ({ href: a.href, text: a.innerText.trim() })).filter(l => l.href.includes("epaper") || l.text.includes("Epaper") || l.text.includes("ای پیپر"));
      return { title: document.title, links };
    });
    console.log("Daily Aaj Links:", JSON.stringify(aaj, null, 2));
  } catch(e) { console.log("Aaj Err:", e.message); }

  await browser.close();
}
checkMorePapers();
