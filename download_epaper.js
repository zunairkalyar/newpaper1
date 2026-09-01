const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Downloads The News e-paper PDF given an edition URL or date/edition.
 * Example URL: https://e.thenews.pk/karachi/31-08-2026/page1
 */
async function downloadNewsPDF(inputUrlOrDate, inputEdition = 'karachi') {
    let edition = inputEdition;
    let day, month, year;

    if (inputUrlOrDate && inputUrlOrDate.startsWith('http')) {
        const match = inputUrlOrDate.match(/e\.thenews\.pk\/([a-zA-Z]+)\/(\d{1,2})-(\d{1,2})-(\d{4})/i);
        if (match) {
            edition = match[1].toLowerCase();
            day = parseInt(match[2], 10);
            month = parseInt(match[3], 10);
            year = parseInt(match[4], 10);
        } else {
            console.error('Invalid URL format. Expected: https://e.thenews.pk/{edition}/{DD-MM-YYYY}/page1');
            return;
        }
    } else if (inputUrlOrDate) {
        const parts = inputUrlOrDate.split('-');
        if (parts.length === 3) {
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10);
            year = parseInt(parts[2], 10);
        }
    }

    if (!day || !month || !year) {
        const now = new Date();
        day = now.getDate();
        month = now.getMonth() + 1;
        year = now.getFullYear();
    }

    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month).padStart(2, '0');
    const editionCapitalized = edition.charAt(0).toUpperCase() + edition.slice(1);

    // The News static PDF path format: static_pages/M-D-YYYY/edition/thenews.pdf
    const pdfUrl = `https://e.thenews.pk/static_pages/${month}-${day}-${year}/${edition}/thenews.pdf`;
    const outputFilename = `TheNews-${editionCapitalized}-${formattedDay}-${formattedMonth}-${year}.pdf`;
    const outputPath = path.join(__dirname, outputFilename);

    console.log(`Fetching: ${pdfUrl}`);
    console.log(`Saving to: ${outputFilename}...`);

    return new Promise((resolve, reject) => {
        https.get(pdfUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(outputPath);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    const stats = fs.statSync(outputPath);
                    console.log(`✓ Download completed successfully (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                    resolve(outputPath);
                });
            } else {
                console.error(`✗ Failed to download: Server returned status code ${res.statusCode}`);
                reject(new Error(`HTTP Status ${res.statusCode}`));
            }
        }).on('error', (err) => {
            console.error('✗ Download error:', err.message);
            reject(err);
        });
    });
}

// CLI execution
const arg = process.argv[2] || 'https://e.thenews.pk/karachi/31-08-2026/page1';
downloadNewsPDF(arg).catch(() => process.exit(1));
