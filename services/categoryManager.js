const fs = require('fs');
const path = require('path');

const CATEGORIES_FILE = path.join(__dirname, '..', 'cache', 'file_categories.json');
let fileCategoriesMap = null;

function loadCategoryMap() {
    try {
        if (fs.existsSync(CATEGORIES_FILE)) {
            const data = fs.readFileSync(CATEGORIES_FILE, 'utf8');
            fileCategoriesMap = JSON.parse(data) || {};
        } else {
            fileCategoriesMap = {};
        }
    } catch (err) {
        console.warn('[CategoryManager] Error loading category map:', err.message);
        fileCategoriesMap = fileCategoriesMap || {};
    }
    return fileCategoriesMap;
}

function saveCategoryMap() {
    try {
        const dir = path.dirname(CATEGORIES_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(fileCategoriesMap || {}, null, 2), 'utf8');
    } catch (err) {
        console.error('[CategoryManager] Error saving category map:', err.message);
    }
}

function setFileCategory(filename, category) {
    if (!filename || !category) return;
    loadCategoryMap();
    fileCategoriesMap[filename] = category;
    saveCategoryMap();
}

function getStoredCategory(filename) {
    if (!filename) return null;
    loadCategoryMap();
    return fileCategoriesMap[filename] || null;
}

function removeFileCategory(filename) {
    if (!filename) return;
    loadCategoryMap();
    if (fileCategoriesMap[filename]) {
        delete fileCategoriesMap[filename];
        saveCategoryMap();
    }
}

function isIndianName(lower) {
    return lower.includes('hindu analysis') ||
        lower.includes('the hindu') ||
        lower.includes('times of india') ||
        lower.includes('economic times') ||
        lower.includes('financial express') ||
        lower.includes('the telegraph') ||
        lower.includes('deccan chronicle') ||
        lower.includes('statesman') ||
        lower.includes('the tribune') ||
        lower.includes('asian age') ||
        lower.includes('the pioneer') ||
        lower.includes('free press journal') ||
        lower.includes('business standard') ||
        lower.includes('live mint') ||
        lower.includes('hans india') ||
        lower.includes('deccan herald') ||
        lower.includes('hindustan times') ||
        lower.includes('lokmat times') ||
        lower.includes('ahmedabad mirror') ||
        lower.includes('telangana today') ||
        lower.includes('indian paper') ||
        lower.includes('indian newspaper');
}

function isArabName(lower) {
    return lower.includes('gulf times') ||
        lower.includes('qatar tribune') ||
        lower.includes('peninsula') ||
        lower.includes('al sharq') ||
        lower.includes('al-sharq') ||
        lower.includes('al watan') ||
        lower.includes('al-watan') ||
        lower.includes('al ayam') ||
        lower.includes('al-ayam') ||
        lower.includes('akhbar al khaleej') ||
        lower.includes('akhbar al-khaleej') ||
        lower.includes('arab times') ||
        lower.includes('kuwait times') ||
        lower.includes('al qabas') ||
        lower.includes('al-qabas') ||
        lower.includes('tehran times') ||
        lower.includes('oman daily') ||
        lower.includes('khaleej times') ||
        lower.includes('gulf news') ||
        lower.includes('asharq al-awsat') ||
        lower.includes('al ahram') ||
        lower.includes('al riyadh') ||
        lower.includes('arab news') ||
        lower.includes('al madina') ||
        lower.includes('al-madina') ||
        lower.includes('madina') ||
        lower.includes('al quds') ||
        lower.includes('al-quds') ||
        lower.includes('quds');
}

function isKhaliqName(lower) {
    return lower.includes('92 columns') ||
        lower.includes('express columns') ||
        lower.includes('dunya columns') ||
        lower.includes('daily express') ||
        lower.includes('jehan pakistan') ||
        lower.includes('daily pakistan') ||
        lower.includes('daily jinnah') ||
        lower.includes('sahafat') ||
        lower.includes('daily k2') ||
        lower.includes('daily jang') ||
        lower.includes('roznama dunya');
}

function isNewspaperHubName(lower) {
    return lower.includes('dawn') ||
        lower.includes('the news') ||
        lower.includes('business recorder') ||
        lower.includes('the nation') ||
        lower.includes('daily lead') ||
        lower.includes('pakistan observer') ||
        lower.includes('daily times') ||
        lower.includes('express tribune') ||
        lower.includes('juraat') ||
        lower.includes('ausaf') ||
        lower.includes('daily aaj') ||
        lower.includes('nai baat') ||
        lower.includes('jasarat') ||
        lower.includes('jobz.pk') ||
        lower.includes('roznama 92 news') ||
        lower.includes('balochistan times') ||
        lower.includes('daily dak') ||
        lower.includes('daily ibrat') ||
        lower.includes('frontier post') ||
        lower.includes('pakistan today') ||
        lower.includes('nawa-i-waqt') ||
        lower.includes('asian telegraph');
}

function isForeignPaperName(lower) {
    return lower.includes('wall street journal') ||
        lower.includes('washington post') ||
        lower.includes('usa today') ||
        lower.includes('new york magazine') ||
        lower.includes('the times') ||
        lower.includes('the independent') ||
        lower.includes('the guardian') ||
        lower.includes('the daily telegraph') ||
        lower.includes('financial times') ||
        lower.includes('new york times') ||
        lower.includes('globe and mail') ||
        lower.includes('daily mail');
}

function getFileCategory(filename) {
    if (!filename) return 'magazines';

    // 1. Check persistent category map first
    const stored = getStoredCategory(filename);
    if (stored) return stored;

    const lower = filename.toLowerCase();

    // 2. Watermark Stamper check
    if (lower.includes('watermark') || 
        lower.includes('[watermarked]') || 
        lower.includes('_watermarked') || 
        lower.includes('-watermark') || 
        lower.includes('watermarked_') ||
        filename.includes('²⁴⁰⁹')) {
        return 'watermark';
    }

    // 3. Indian Newspapers check
    if (isIndianName(lower)) return 'indianpaper';

    // 4. Arab Newspapers check
    if (isArabName(lower)) return 'arabnews';

    // 5. Khaliq Category check
    if (isKhaliqName(lower)) return 'khalik';

    // 6. Newspaper Hub check
    if (isNewspaperHubName(lower)) return 'newspaper_hub';

    // 7. Foreign Paper check
    if (isForeignPaperName(lower)) return 'foreignpaper';

    return 'magazines';
}

module.exports = {
    loadCategoryMap,
    saveCategoryMap,
    setFileCategory,
    getStoredCategory,
    removeFileCategory,
    getFileCategory
};
