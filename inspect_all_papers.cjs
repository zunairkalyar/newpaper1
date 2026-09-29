const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

  console.log("\n--- 1. DAWN ---");
  try {
    await page.goto("https://epaper.dawn.com/", { waitUntil: "domcontentloaded", timeout: 15000 });
    const dawnInfo = await page.evaluate(() => {
      const allImgs = Array.from(document.querySelectorAll("img")).map(i => i.src);
      const scripts = Array.from(document.querySelectorAll("script")).map(s => s.innerText).filter(t => t.includes("page") || t.includes("epaper") || t.includes("images") || t.includes(".jpg"));
      return {
        title: document.title,
        imgs: allImgs.filter(u => u.includes(".jpg") || u.includes(".png")).slice(0, 10),
        scriptSnippets: scripts.map(s => s.slice(0, 200))
      };
    });
    console.log("Dawn:", JSON.stringify(dawnInfo, null, 2));
  } catch(e) {
    console.log("Dawn err:", e.message);
  }

  console.log("\n--- 2. THE NEWS ---");
  try {
    await page.goto("https://e.thenews.com.pk/", { waitUntil: "domcontentloaded", timeout: 15000 });
    const newsInfo = await page.evaluate(() => {
      const allImgs = Array.from(document.querySelectorAll("img")).map(i => i.src);
      const links = Array.from(document.querySelectorAll("a")).map(a => a.href);
      return {
        title: document.title,
        imgs: allImgs.filter(u => u.includes("thenews") || u.includes("page") || u.includes(".jpg")).slice(0, 10),
        pageLinks: links.filter(l => l.includes("page") || l.includes("epaper") || l.includes("thenews")).slice(0, 15)
      };
    });
    console.log("The News:", JSON.stringify(newsInfo, null, 2));
  } catch(e) {
    console.log("The News err:", e.message);
  }

  console.log("\n--- 3. DAILY TIMES ---");
  try {
    await page.goto("https://dailytimes.com.pk/e-paper/", { waitUntil: "domcontentloaded", timeout: 15000 });
    const dtInfo = await page.evaluate(() => {
      const allImgs = Array.from(document.querySelectorAll("img")).map(i => i.src);
      const links = Array.from(document.querySelectorAll("a")).map(a => a.href);
      return {
        title: document.title,
        url: window.location.href,
        imgs: allImgs.slice(0, 10),
        links: links.filter(l => l.includes("dailytimes") || l.includes("e-paper")).slice(0, 10)
      };
    });
    console.log("Daily Times:", JSON.stringify(dtInfo, null, 2));
  } catch(e) {
    console.log("DT err:", e.message);
  }

  console.log("\n--- 4. AUSAF ---");
  try {
    await page.goto("https://epaper.dailyausaf.com/", { waitUntil: "domcontentloaded", timeout: 15000 });
    const ausafInfo = await page.evaluate(() => {
      const allImgs = Array.from(document.querySelectorAll("img")).map(i => i.src);
      const links = Array.from(document.querySelectorAll("a")).map(a => a.href);
      return {
        title: document.title,
        url: window.location.href,
        imgs: allImgs.slice(0, 10),
        links: links.filter(l => l.includes("ausaf")).slice(0, 10)
      };
    });
    console.log("Ausaf:", JSON.stringify(ausafInfo, null, 2));
  } catch(e) {
    console.log("Ausaf err:", e.message);
  }

  await browser.close();
}
run();
