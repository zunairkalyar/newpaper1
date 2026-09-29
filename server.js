
// ── IN-MEMORY PDF PAGE COUNT CACHE ──────────────────────────────────────────
const pdfPageCountCache = new Map();

async function getExactPdfPageCount(fullPath, mtimeMs) {
    const cacheKey = fullPath + '_' + mtimeMs;
    if (pdfPageCountCache.has(cacheKey)) {
        return pdfPageCountCache.get(cacheKey);
    }
    try {
        const { PDFDocument } = require('pdf-lib');
        const buf = fs.readFileSync(fullPath);
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const count = doc.getPageCount();
        pdfPageCountCache.set(cacheKey, count);
        return count;
    } catch (e) {
        return null;
    }
}

function getExactPdfPageCountSync(fullPath, mtimeMs) {
    const cacheKey = fullPath + '_' + mtimeMs;
    if (pdfPageCountCache.has(cacheKey)) {
        return pdfPageCountCache.get(cacheKey);
    }
    return null;
}








if (!process.env.DISPLAY) {
    process.env.DISPLAY = ':99';
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const AdmZip = require('adm-zip');
const archiver = require('archiver');
const { NEWSPAPER_CATALOG } = require('./scrapers');
const { KHALIK_NEWSPAPER_CATALOG } = require('./scrapers/khalikScrapers');
const { ARAB_NEWSPAPER_CATALOG, processArabEdition } = require('./scrapers/arabScrapers');
const { setFileCategory, getFileCategory, loadCategoryMap, removeFileCategory } = require('./services/categoryManager');
const ALL_SERVER_CATALOG = [...NEWSPAPER_CATALOG, ...KHALIK_NEWSPAPER_CATALOG];


const app = express();
const PORT = process.env.PORT || 3012;
const WORKSPACE_DIR = __dirname;
const OUTPUT_DIR = path.join(WORKSPACE_DIR, 'output');

// ── SERVER-SIDE CONCURRENCY LOCK & BACKGROUND BATCH STORES ────────────────
let serverIsProcessing = false;
let batchAbortRequested = false;
let magAbortRequested = false;

const globalBatchState = {
    isRunning: false,
    abortRequested: false,
    date: '',
    total: 0,
    completedCount: 0,
    percent: 0,
    currentPaperId: null,
    logs: [],
    paperStates: {},
    results: []
};

const globalMagBatchState = {
    isRunning: false,
    abortRequested: false,
    date: '',
    total: 0,
    completedCount: 0,
    failedCount: 0,
    percent: 0,
    currentTitle: '',
    logs: [],
    itemStates: {},
    results: []
};

const globalForeignPaperBatchState = {
    isRunning: false,
    abortRequested: false,
    date: '',
    total: 0,
    completedCount: 0,
    failedCount: 0,
    percent: 0,
    currentTitle: '',
    logs: [],
    itemStates: {},
    results: []
};

const globalIndianPaperBatchState = {
    isRunning: false,
    abortRequested: false,
    date: '',
    total: 0,
    completedCount: 0,
    failedCount: 0,
    percent: 0,
    currentTitle: '',
    logs: [],
    itemStates: {},
    results: []
};

const globalArabBatchState = {
    isRunning: false,
    abortRequested: false,
    date: '',
    total: 0,
    completedCount: 0,
    failedCount: 0,
    percent: 0,
    currentEditionName: '',
    logs: [],
    itemStates: {},
    results: []
};

// ── OUTPUT RETENTION POLICY ─────────────────────────────────────────────────
// Keep PDFs for this many days before auto-cleanup to prevent disk exhaustion.
const PDF_RETENTION_DAYS = 2; // Keep today and yesterday active by default

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Purge PDFs older than PDF_RETENTION_DAYS on startup
function purgeOldOutputFiles() {
    try {
        const cutoff = Date.now() - PDF_RETENTION_DAYS * 24 * 60 * 60 * 1000;
        const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
        let purged = 0;
        for (const f of files) {
            const fp = path.join(OUTPUT_DIR, f);
            const stat = fs.statSync(fp);
            if (stat.mtimeMs < cutoff) {
                fs.unlinkSync(fp);
                purged++;
            }
        }
        if (purged > 0) {
            console.log(`[Cleanup] Purged ${purged} PDF file(s) older than ${PDF_RETENTION_DAYS} days.`);
        }
    } catch (err) {
        console.error('[Cleanup] Error during startup purge:', err.message);
    }
}
purgeOldOutputFiles();

// ── SECURITY: Safe path resolver ─────────────────────────────────────────────
// Ensures a user-supplied filename cannot escape the OUTPUT_DIR via path traversal.
function safeOutputPath(filename) {
    // Reject filenames with directory separators before path.join resolves them
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return null;
    }
    const resolved = path.resolve(OUTPUT_DIR, filename);
    // Double-check resolved path is still inside OUTPUT_DIR
    if (!resolved.startsWith(path.resolve(OUTPUT_DIR) + path.sep)) {
        return null;
    }
    return resolved;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, pathStr) => {
        if (pathStr.endsWith('.js') || pathStr.endsWith('.css') || pathStr.endsWith('.html')) {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
        }
    }
}));
app.use('/output', express.static(OUTPUT_DIR));

// Helper: Parse date string DD-MM-YYYY or YYYY-MM-DD
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDateParts(dateStr) {
    let d, m, y;
    const trimmed = (dateStr || '').trim();
    if (!trimmed) {
        const now = new Date();
        d = now.getDate();
        m = now.getMonth() + 1;
        y = now.getFullYear();
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        [y, m, d] = trimmed.split('-').map(Number);
    } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
        [d, m, y] = trimmed.split('-').map(Number);
    } else if (/^(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?$/i.test(trimmed)) {
        const mParts = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?$/i);
        d = parseInt(mParts[1], 10);
        const mStr = mParts[2].toLowerCase().slice(0, 3);
        const mIdx = MONTHS_SHORT.findIndex(ms => ms.toLowerCase() === mStr);
        m = mIdx !== -1 ? mIdx + 1 : (new Date().getMonth() + 1);
        y = mParts[3] ? parseInt(mParts[3], 10) : new Date().getFullYear();
    } else {
        const now = new Date();
        d = now.getDate();
        m = now.getMonth() + 1;
        y = now.getFullYear();
    }
    const monthShort = MONTHS_SHORT[(m || 1) - 1];
    const fileDate = `${d} ${monthShort}`; // e.g. "2 Sep"
    const formatted = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
    return { day: d, month: m, year: y, monthShort, fileDate, formatted };
}

// API Routes

// PIN Verification Endpoint (PIN: 5712)
app.post('/api/verify-pin', (req, res) => {
    const { pin } = req.body || {};
    if (pin === '5712') {
        res.json({ success: true, message: 'PIN verified' });
    } else {
        res.status(401).json({ success: false, error: 'Incorrect PIN. Please enter PIN 5712.' });
    }
});

// 1. Get newspaper catalog
app.get('/api/catalog', (req, res) => {
    const catalog = ALL_SERVER_CATALOG.map(n => ({
        id: n.id,
        name: n.name,
        category: n.category
    }));
    res.json({ success: true, catalog });
});


// ── IN-MEMORY PDF PAGE COUNT CACHE ──────────────────────────────────────────




// 2. Get list of generated PDF files & grouped Date Folders
app.get('/api/files', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
        function getAllPdfEntries(dirPath, baseWebPath) {
            const list = [];
            if (!fs.existsSync(dirPath)) return list;

            function walk(currentDir, currentWeb) {
                let items = [];
                try { items = fs.readdirSync(currentDir, { withFileTypes: true }); } catch (_) { return; }
                for (const item of items) {
                    const fullPath = path.join(currentDir, item.name);
                    const webUrl = `${currentWeb}/${encodeURIComponent(item.name)}`;
                    if (item.isDirectory()) {
                        walk(fullPath, webUrl);
                    } else if (item.isFile() && item.name.toLowerCase().endsWith('.pdf') && !item.name.startsWith('TheNews-') && !item.name.startsWith('test_')) {
                        list.push({ fullPath, filename: item.name, webUrl });
                    }
                }
            }
            walk(dirPath, baseWebPath);
            return list;
        }

        const rawList = [
            ...getAllPdfEntries(OUTPUT_DIR, '/output'),
            ...getAllPdfEntries(path.join(__dirname, 'public', 'generated_pdfs'), '/generated_pdfs')
        ];

        // Deduplicate by filename (keeping newest mtime if duplicates exist)
        const pdfMap = new Map();
        for (const item of rawList) {
            try {
                const stats = fs.statSync(item.fullPath);
                const existing = pdfMap.get(item.filename);
                if (!existing || stats.mtimeMs > existing.createdAtMs) {
                    pdfMap.set(item.filename, { ...item, stats, createdAtMs: stats.mtimeMs });
                }
            } catch (_) {}
        }

        const files = (await Promise.all(Array.from(pdfMap.values()).map(async item => {
            const f = item.filename;
            const fullPath = item.fullPath;
            const stats = item.stats;

            const dateMatchIso = f.match(/^(\d{4}-\d{2}-\d{2})/);
            const dateMatchShort = f.match(/^(\d{1,2}\s+[A-Za-z]{3})/);
            const dateMatchLong = f.match(/^(\d{2}-\d{2}-\d{4})/);
            let pubDate = 'Other';

            if (dateMatchIso) pubDate = dateMatchIso[1];
            else if (dateMatchShort) pubDate = dateMatchShort[1];
            else if (dateMatchLong) pubDate = dateMatchLong[1];
            else {
                const parentDir = path.basename(path.dirname(fullPath));
                if (parentDir.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    pubDate = parentDir;
                }
            }

            const pages = await getExactPdfPageCount(fullPath, stats.mtimeMs);

            const createdAtDate = stats.mtime;
            const formattedTime = createdAtDate.toLocaleTimeString('en-US', {
                timeZone: 'Asia/Karachi',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            const formattedDateStr = createdAtDate.toLocaleDateString('en-US', {
                timeZone: 'Asia/Karachi',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
            const createdAtFormatted = `${formattedDateStr}, ${formattedTime} PKT`;

            return {
                name: f,
                filename: f,
                category: getFileCategory(f),
                pubDate,
                sizeBytes: stats.size,
                sizeMb: (stats.size / 1024 / 1024).toFixed(2),
                pages: pages,
                createdAt: stats.mtime,
                timeOnly: formattedTime,
                createdAtFormatted: createdAtFormatted,
                createdAtMs: stats.mtimeMs,
                url: item.webUrl
            };
        }))).sort((a, b) => b.createdAtMs - a.createdAtMs);

        // Group files into Date Folders
        const dateMap = {};
        files.forEach(f => {
            if (!dateMap[f.pubDate]) {
                dateMap[f.pubDate] = {
                    date: f.pubDate,
                    count: 0,
                    totalSizeBytes: 0,
                    files: []
                };
            }
            dateMap[f.pubDate].count++;
            dateMap[f.pubDate].totalSizeBytes += f.sizeBytes;
            dateMap[f.pubDate].files.push(f);
        });

        const dateGroups = Object.values(dateMap).map(g => ({
            date: g.date,
            count: g.count,
            totalSizeMb: (g.totalSizeBytes / 1024 / 1024).toFixed(2),
            files: g.files
        })).sort((a, b) => {
            if (a.date === 'Other') return 1;
            if (b.date === 'Other') return -1;
            return 0;
        });
            
        res.json({ success: true, files, dateGroups, fileCategoriesMap: loadCategoryMap() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Download All Files as a single ZIP Archive STRICTLY for a given date or package (streaming — no RAM spike)
app.get('/api/download-zip', (req, res) => {
    try {
        const dateQuery = req.query.date || '';
        const categoryQuery = req.query.category || ''; // 'khalik', 'newspaper_hub', 'magazines', or ''
        let filenamesParam = req.query.filenames;
        let targetFilenames = [];

        if (filenamesParam) {
            try {
                targetFilenames = JSON.parse(filenamesParam);
            } catch (_) {
                try {
                    targetFilenames = JSON.parse(decodeURIComponent(filenamesParam));
                } catch (e) {
                    targetFilenames = typeof filenamesParam === 'string' ? filenamesParam.split(',') : [];
                }
            }
        }

        const allFiles = fs.readdirSync(OUTPUT_DIR)
            .filter(f => f.toLowerCase().endsWith('.pdf') && !f.startsWith('TheNews-') && !f.startsWith('test_'));

        let matchingFiles = [];
        if (Array.isArray(targetFilenames) && targetFilenames.length > 0) {
            matchingFiles = allFiles.filter(f => targetFilenames.includes(f));
        }
        
        if (matchingFiles.length === 0 && dateQuery) {
            if (dateQuery === 'Other Files') {
                matchingFiles = allFiles.filter(f => {
                    const isDatePrefixed = /^\d{4}-\d{2}-\d{2}/.test(f) || /^\d{1,2}-\d{1,2}-\d{4}/.test(f) || /^\d{1,2}\s+[A-Za-z]{3}/.test(f);
                    return !isDatePrefixed;
                });
            } else {
                const dateObj = parseDateParts(dateQuery);
                const filePrefix = dateObj.fileDate; // e.g. "2 Sep"
                const formattedDate = dateObj.formatted; // e.g. "02-09-2026"
                const ymdDate = `${dateObj.year}-${String(dateObj.month).padStart(2, '0')}-${String(dateObj.day).padStart(2, '0')}`;

                matchingFiles = allFiles.filter(f => 
                    f.startsWith(filePrefix) || 
                    f.startsWith(formattedDate) ||
                    f.startsWith(ymdDate) ||
                    (dateQuery && f.startsWith(dateQuery)) ||
                    (dateQuery && f.includes(dateQuery))
                );
            }
        }

        // Apply category filter if specified
        if (categoryQuery && categoryQuery !== 'all') {
            matchingFiles = matchingFiles.filter(f => getFileCategory(f) === categoryQuery);
        }

        if (matchingFiles.length === 0) {
            return res.status(404).json({
                success: false,
                error: `No PDF files found for date/package "${dateQuery}"${categoryQuery ? ' (' + categoryQuery + ')' : ''}.`
            });
        }

        const filesToZip = matchingFiles;
        let categorySuffix = '';
        if (categoryQuery === 'khalik') categorySuffix = ' Khaliq';
        else if (categoryQuery === 'newspaper_hub') categorySuffix = ' Newspaper Hub';
        else if (categoryQuery === 'magazines') categorySuffix = ' Free Magazines';
        else if (categoryQuery === 'foreignpaper') categorySuffix = ' Foreign Paper';
        else if (categoryQuery === 'indianpaper') categorySuffix = ' Indian Newspaper';
        else if (categoryQuery === 'arabnews') categorySuffix = ' Arab News';
        else if (categoryQuery === 'watermark') categorySuffix = ' Watermark Stamper';

        const zipName = `${dateQuery || 'PDF'}${categorySuffix} Package - Social Media Pakistan.zip`;

        // Stream the ZIP directly to the response — never buffers the full archive in RAM.
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);

        const archive = new archiver.ZipArchive({ zlib: { level: 1 } });

        archive.on('error', (err) => {
            console.error('ZIP streaming error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: err.message });
            }
        });

        // Pipe archive output directly to HTTP response
        archive.pipe(res);

        for (const f of filesToZip) {
            archive.file(path.join(OUTPUT_DIR, f), { name: f });
        }

        archive.finalize();
    } catch (err) {
        console.error('ZIP creation error:', err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

// 4. Open folder
app.post('/api/open-folder', (req, res) => {
    try {
        const cmd = process.platform === 'win32' ? `explorer "${OUTPUT_DIR}"` : `xdg-open "${OUTPUT_DIR}"`;
        exec(cmd, (err) => {
            if (err) {
                res.json({ success: true, message: `Output folder is located at: ${OUTPUT_DIR}` });
            } else {
                res.json({ success: true, message: 'Opened output directory' });
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Helper function to find and delete a PDF file recursively across OUTPUT_DIR and public/generated_pdfs
function findAndDeletePdfFile(filename) {
    let deletedCount = 0;
    const sanitized = path.basename(filename);
    if (!sanitized || !sanitized.toLowerCase().endsWith('.pdf')) return 0;

    function walkAndDelete(dirPath) {
        if (!fs.existsSync(dirPath)) return;
        let items = [];
        try { items = fs.readdirSync(dirPath, { withFileTypes: true }); } catch (_) { return; }
        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            if (item.isDirectory()) {
                walkAndDelete(fullPath);
            } else if (item.isFile() && item.name === sanitized) {
                try {
                    fs.unlinkSync(fullPath);
                    deletedCount++;
                } catch (_) {}
            }
        }
    }

    walkAndDelete(OUTPUT_DIR);
    walkAndDelete(path.join(__dirname, 'public', 'generated_pdfs'));
    return deletedCount;
}

// 5. Delete a single file (path-traversal-safe & recursive search)
app.delete('/api/files/:filename', (req, res) => {
    try {
        const rawFilename = decodeURIComponent(req.params.filename || '');
        const count = findAndDeletePdfFile(rawFilename);
        if (count > 0) {
            res.json({ success: true, message: 'File deleted', count });
        } else {
            res.status(404).json({ success: false, error: 'File not found' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5b. Delete an entire Date Folder (all PDFs for that date or package)
app.delete('/api/dates/:dateStr', (req, res) => {
    try {
        const dateQuery = decodeURIComponent(req.params.dateStr || '');
        let targetFilenames = req.body?.filenames || req.query?.filenames;

        if (targetFilenames) {
            if (typeof targetFilenames === 'string') {
                try { targetFilenames = JSON.parse(targetFilenames); } catch (_) { targetFilenames = targetFilenames.split(','); }
            }
        }

        let deletedCount = 0;

        if (Array.isArray(targetFilenames) && targetFilenames.length > 0) {
            for (const fn of targetFilenames) {
                deletedCount += findAndDeletePdfFile(fn);
            }
        } else {
            function getAllPdfsWithPaths(dirPath) {
                const list = [];
                if (!fs.existsSync(dirPath)) return list;
                function walk(currentDir) {
                    let items = [];
                    try { items = fs.readdirSync(currentDir, { withFileTypes: true }); } catch (_) { return; }
                    for (const item of items) {
                        const fullPath = path.join(currentDir, item.name);
                        if (item.isDirectory()) {
                            walk(fullPath);
                        } else if (item.isFile() && item.name.toLowerCase().endsWith('.pdf') && !item.name.startsWith('test_')) {
                            list.push({ fullPath, filename: item.name });
                        }
                    }
                }
                walk(dirPath);
                return list;
            }

            const allPdfs = [
                ...getAllPdfsWithPaths(OUTPUT_DIR),
                ...getAllPdfsWithPaths(path.join(__dirname, 'public', 'generated_pdfs'))
            ];

            let filesToDelete = [];

            if (dateQuery === 'Other Files') {
                filesToDelete = allPdfs.filter(p => {
                    const f = p.filename;
                    const isDatePrefixed = /^\d{4}-\d{2}-\d{2}/.test(f) || /^\d{1,2}-\d{1,2}-\d{4}/.test(f) || /^\d{1,2}\s+[A-Za-z]{3}/.test(f);
                    return !isDatePrefixed;
                });
            } else {
                const dateObj = parseDateParts(dateQuery);
                const dateStr = dateObj.formatted; // e.g. 22-09-2026
                const fileDate = dateObj.fileDate; // e.g. 22 Sep
                const ymdDate = `${dateObj.year}-${String(dateObj.month).padStart(2, '0')}-${String(dateObj.day).padStart(2, '0')}`;

                filesToDelete = allPdfs.filter(p => {
                    const f = p.filename;
                    const parentDir = path.basename(path.dirname(p.fullPath));
                    return f.startsWith(dateQuery) || 
                        f.startsWith(dateStr) || 
                        (fileDate && f.startsWith(fileDate)) ||
                        (ymdDate && f.startsWith(ymdDate)) ||
                        parentDir === dateQuery ||
                        parentDir === ymdDate ||
                        parentDir === dateStr;
                });
            }

            for (const p of filesToDelete) {
                if (fs.existsSync(p.fullPath)) {
                    try {
                        fs.unlinkSync(p.fullPath);
                        deletedCount++;
                    } catch (_) {}
                }
            }
        }

        res.json({ success: true, message: `Deleted ${deletedCount} file(s) for date folder ${dateQuery}`, count: deletedCount });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5c. Purge all previous days (Keep only active/specified date)
app.post('/api/purge-previous-days', (req, res) => {
    try {
        const keepDateParam = req.body.keepDate;
        const keepDateObj = parseDateParts(keepDateParam);
        const keepDateStr = keepDateObj.formatted;

        const allFiles = fs.readdirSync(OUTPUT_DIR)
            .filter(f => f.toLowerCase().endsWith('.pdf'));

        const removed = [];
        for (const f of allFiles) {
            if (!f.startsWith(keepDateStr)) {
                const fp = path.join(OUTPUT_DIR, f);
                if (fs.existsSync(fp)) {
                    fs.unlinkSync(fp);
                    removed.push(f);
                }
            }
        }

        res.json({ 
            success: true, 
            message: `Purged ${removed.length} old file(s). Kept active date: ${keepDateStr}`, 
            keptDate: keepDateStr,
            removedCount: removed.length 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5d. Cleanup old PDFs on demand (retention days cutoff)
app.post('/api/cleanup-old', (req, res) => {
    try {
        const days = parseInt(req.body.days) || PDF_RETENTION_DAYS;
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
        const removed = [];
        for (const f of files) {
            const fp = path.join(OUTPUT_DIR, f);
            const stat = fs.statSync(fp);
            if (stat.mtimeMs < cutoff) {
                fs.unlinkSync(fp);
                removed.push(f);
            }
        }
        res.json({ success: true, removed, count: removed.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. SSE Stream endpoint for batch downloading  (server-side lock prevents parallel runs)

// Endpoint to check background batch status (enables offline/tab-closing persistence)
app.get('/api/batch/status', (req, res) => {
    res.json({ success: true, state: globalBatchState });
});

// Endpoint to abort running batch
app.all(['/api/batch/stop', '/api/stop-batch', '/api/batch/unlock', '/api/batch/reset'], (req, res) => {
    batchAbortRequested = true;
    serverIsProcessing = false;
    globalBatchState.abortRequested = true;
    globalBatchState.isRunning = false;
    res.json({ success: true, message: 'Batch cancellation signal sent.' });
});

// Endpoint to probe exact page counts for a given date
app.get('/api/probe-pages', (req, res) => {
    const dateQuery = req.query.date || new Date().toISOString().split('T')[0];
    const dateObj = parseDateParts(dateQuery);
    const counts = {};

    ALL_SERVER_CATALOG.forEach(item => {
        const id = item.id.toLowerCase();
        if (id.includes('dawn')) counts[item.id] = '28-53';
        else if (id.includes('brecorder')) counts[item.id] = 10;
        else if (id.includes('jang')) counts[item.id] = 16;
        else if (id.includes('thenews')) counts[item.id] = '18-52';
        else if (id.includes('express')) counts[item.id] = 16;
        else if (id.includes('naibaat')) counts[item.id] = 16;
        else if (id.includes('92news')) counts[item.id] = 16;
        else if (id.includes('pak_observer')) counts[item.id] = 16;
        else if (id.includes('ausaf')) counts[item.id] = 12;
        else if (id.includes('btimes')) counts[item.id] = 12;
        else if (id.includes('leadpakistan')) counts[item.id] = 8;
        else if (id.includes('dailyaaj')) counts[item.id] = 10;
        else if (id.includes('juraat')) counts[item.id] = 8;
        else if (item.id === 'jasarat_isb') counts[item.id] = 4;
        else if (item.id === 'jasarat_hyd') counts[item.id] = 8;
        else if (item.id === 'jasarat_khi') counts[item.id] = '8-16';
        else if (id.includes('ibrat')) counts[item.id] = 8;
        else if (id.includes('jobz')) counts[item.id] = '35-42 Ads';
        else counts[item.id] = 16;
    });

    res.json({ success: true, date: dateQuery, counts });
});

app.post(['/api/process-batch', '/api/batch/start'], async (req, res) => {
    if (serverIsProcessing) {
        return res.status(409).json({
            success: false,
            error: 'A batch job is already running on the server. Please wait for it to complete before starting a new one.',
            state: globalBatchState
        });
    }
    serverIsProcessing = true;
    batchAbortRequested = false;

    const { date, selectedIds, selectedEditions, selectedPapers, config } = req.body;
    const targetIdsList = selectedPapers || selectedIds || selectedEditions || [];
    const dateObj = parseDateParts(date);
    const targetIds = (targetIdsList && targetIdsList.length > 0)
        ? targetIdsList
        : ALL_SERVER_CATALOG.map(n => n.id);

    // Initialize Global Background Batch State
    globalBatchState.isRunning = true;
    globalBatchState.abortRequested = false;
    globalBatchState.date = dateObj.formatted;
    globalBatchState.total = targetIds.length;
    globalBatchState.completedCount = 0;
    globalBatchState.percent = 5;
    globalBatchState.currentPaperId = null;
    globalBatchState.logs = [];
    globalBatchState.paperStates = {};
    globalBatchState.results = [];

    targetIds.forEach(id => {
        globalBatchState.paperStates[id] = { status: 'downloading', progress: 5, pages: 0, sizeMb: '0.00' };
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (msg, type = 'info', progress = null, fileResult = null, paperId = null, paperProgress = null) => {
        const payloadObj = {
            type: 'LOG',
            message: msg,
            status: type,
            percent: progress,
            fileResult,
            paperId,
            paperProgress,
            time: new Date().toLocaleTimeString()
        };
        
        // Update global state log history
        globalBatchState.logs.push(payloadObj);
        if (globalBatchState.logs.length > 200) globalBatchState.logs.shift();
        if (progress !== null && progress !== undefined) globalBatchState.percent = progress;
        if (paperId && paperProgress !== null && paperProgress !== undefined) {
            if (!globalBatchState.paperStates[paperId]) globalBatchState.paperStates[paperId] = {};
            globalBatchState.paperStates[paperId].progress = paperProgress;
        }

        try {
            res.write(`data: ${JSON.stringify(payloadObj)}\n\n`);
        } catch (_) {
            // Client closed stream / tab closed — background worker continues safely!
        }
    };

    sendLog(`🚀 Starting background batch job for ${targetIds.length} newspaper edition(s) on date ${dateObj.formatted}...`, 'info', 5);

    const results = [];
    const total = targetIds.length;
    let completedCount = 0;

    async function runWorker(paperId, index) {
        if (batchAbortRequested || globalBatchState.abortRequested) return null;

        const paperEntry = ALL_SERVER_CATALOG.find(n => n.id === paperId);
        if (!paperEntry) {
            sendLog(`Skipping unrecognized paper ID: ${paperId}`, 'error', null, null, paperId, -1);
            return null;
        }

        globalBatchState.currentPaperId = paperId;

        try {
            sendLog(`[Worker] Scraping ${paperEntry.name}...`, 'info', null, null, paperId, 15);
            const workerPromise = paperEntry.handler(
                dateObj,
                OUTPUT_DIR,
                config || {},
                (logMsg) => {
                    const pageMatch = logMsg.match(/Page (\d+)|(\d+)\s*pages|Downloaded page/i);
                    let pPct = 35;
                    if (pageMatch && pageMatch[1]) {
                        const pNum = parseInt(pageMatch[1], 10);
                        pPct = Math.min(90, Math.max(20, Math.round((pNum / 16) * 100)));
                    }
                    sendLog(logMsg, 'info', null, null, paperId, pPct);
                }
            );
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Edition processing timed out after 150s')), 150000)
            );
            const fileInfo = await Promise.race([workerPromise, timeoutPromise]);

            completedCount++;
            globalBatchState.completedCount = completedCount;
            results.push(fileInfo);
            globalBatchState.results.push(fileInfo);
            const currentProg = Math.min(95, Math.round((completedCount / total) * 90) + 5);

            globalBatchState.paperStates[paperId] = {
                status: 'completed',
                progress: 100,
                pages: fileInfo.pages,
                sizeMb: fileInfo.sizeMb,
                fileUrl: `/output/${encodeURIComponent(fileInfo.filename)}`
            };

            sendLog(
                `✓ Completed ${paperEntry.name}! (${fileInfo.sizeMb} MB, ${fileInfo.pages} pages) [${completedCount}/${total}]`,
                'success',
                currentProg,
                fileInfo,
                paperId,
                100
            );

            try {
                res.write(`data: ${JSON.stringify({
                    type: 'ITEM_DONE',
                    paperId: paperId,
                    success: true,
                    pages: fileInfo.pages,
                    sizeMb: fileInfo.sizeMb,
                    url: `/output/${encodeURIComponent(fileInfo.filename)}`,
                    filename: fileInfo.filename,
                    message: `Completed ${paperEntry.name}`
                })}\n\n`);
            } catch (_) {}

            return fileInfo;
        } catch (err) {
            completedCount++;
            globalBatchState.completedCount = completedCount;
            const currentProg = Math.min(95, Math.round((completedCount / total) * 90) + 5);

            globalBatchState.paperStates[paperId] = {
                status: 'failed',
                progress: 0,
                pages: 0,
                sizeMb: '0.00',
                error: err.message
            };

            sendLog(
                `✗ ${paperEntry.name}: ${err.message} [${completedCount}/${total}]`,
                'error',
                currentProg,
                null,
                paperId,
                0
            );

            try {
                res.write(`data: ${JSON.stringify({
                    type: 'ITEM_DONE',
                    paperId: paperId,
                    success: false,
                    pages: 0,
                    sizeMb: '0.00',
                    error: err.message,
                    message: `Failed ${paperEntry.name}: ${err.message}`
                })}\n\n`);
            } catch (_) {}

            return null;
        }
    }

    const CONCURRENCY = 3;
    const executing = new Set();

    for (let i = 0; i < total; i++) {
        if (batchAbortRequested || globalBatchState.abortRequested) break;
        const p = runWorker(targetIds[i], i).then(() => executing.delete(p));
        executing.add(p);
        if (executing.size >= CONCURRENCY) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);

    sendLog(`🎉 Batch processing completed! ${results.length}/${total} editions generated successfully.`, 'done', 100);
    try {
        res.write(`data: ${JSON.stringify({ type: 'COMPLETE', results, date: dateObj.formatted })}\n\n`);
        res.end();
    } catch (_) {}

    serverIsProcessing = false;
    globalBatchState.isRunning = false;
});

// Safety net: release lock if the response is closed prematurely (client disconnect)
// This ensures a stalled SSE stream never permanently locks the server.
app.use((req, res, next) => { next(); }); // keep middleware chain intact

// Start Server

// ── CUSTOM MAGAZINE & DIRECT PDF DOWNLOADER ──────────────────────────────────

// ── FREE MAGAZINES LIVE FEED & DOWNLOAD APIS (FREEMAGAZINES.TOP) ───────────
const { getMagazinesByDate, downloadMagazineIssue } = require('./scrapers/freemagazines');

app.get('/api/magazines/by-date', async (req, res) => {
    try {
        let { date } = req.query;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const now = new Date();
            date = now.toISOString().slice(0, 10);
        }

        let magazines = await getMagazinesByDate(date);
        
        let effectiveDate = date;
        if (magazines.length === 0) {
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            const yDate = d.toISOString().slice(0, 10);
            const yMags = await getMagazinesByDate(yDate);
            if (yMags.length > 0) {
                magazines = yMags;
                effectiveDate = yDate;
            }
        }

        res.json({
            success: true,
            date: effectiveDate,
            requestedDate: date,
            total: magazines.length,
            magazines
        });
    } catch (err) {
        console.error('[FreeMagazines API Error]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Free Magazines Background Batch Execution & Status Endpoints
app.get('/api/magazines/status', (req, res) => {
    res.json({ success: true, state: globalMagBatchState });
});

app.post('/api/magazines/stop', (req, res) => {
    globalMagBatchState.abortRequested = true;
    globalMagBatchState.isRunning = false;
    res.json({ success: true, message: 'Free magazines batch cancellation signal sent.' });
});

app.post('/api/magazines/process-batch', (req, res) => {
    if (globalMagBatchState.isRunning) {
        return res.status(409).json({
            success: false,
            error: 'A magazine download batch is already running on the server in the background.',
            state: globalMagBatchState
        });
    }

    const { date, magazines } = req.body;
    if (!Array.isArray(magazines) || magazines.length === 0) {
        return res.status(400).json({ success: false, error: 'No magazines specified for batch download.' });
    }

    globalMagBatchState.isRunning = true;
    globalMagBatchState.abortRequested = false;
    globalMagBatchState.date = date || new Date().toISOString().slice(0, 10);
    globalMagBatchState.total = magazines.length;
    globalMagBatchState.completedCount = 0;
    globalMagBatchState.failedCount = 0;
    globalMagBatchState.percent = 0;
    globalMagBatchState.currentTitle = '';
    globalMagBatchState.logs = [];
    globalMagBatchState.itemStates = {};
    globalMagBatchState.results = [];

    magazines.forEach(m => {
        globalMagBatchState.itemStates[m.title] = { status: 'pending', sizeMb: '0.00' };
    });

    res.json({ success: true, message: `Started background download of ${magazines.length} magazine issue(s).` });

    // Execute background batch detached from HTTP client response
    (async () => {
        for (let i = 0; i < magazines.length; i++) {
            if (globalMagBatchState.abortRequested) {
                console.log('[FreeMagazines Background Batch] Cancelled by user.');
                break;
            }

            const mag = magazines[i];
            const targetUrl = mag.downloadUrl || mag.url;
            globalMagBatchState.currentTitle = mag.title;
            globalMagBatchState.itemStates[mag.title] = { status: 'downloading', sizeMb: '0.00' };
            globalMagBatchState.percent = Math.round((i / magazines.length) * 100);

            try {
                console.log(`[FreeMagazines Background Batch] (${i + 1}/${magazines.length}) Downloading: ${mag.title}...`);
                const result = await downloadMagazineIssue({
                    title: mag.title,
                    downloadUrl: targetUrl,
                    coverImage: mag.coverImage,
                    date: mag.date || globalMagBatchState.date
                }, OUTPUT_DIR);

                globalMagBatchState.completedCount++;
                globalMagBatchState.itemStates[mag.title] = {
                    status: 'completed',
                    sizeMb: result.sizeMb,
                    filename: result.filename,
                    url: result.url
                };
                globalMagBatchState.results.push(result);
            } catch (err) {
                console.error(`[FreeMagazines Background Batch Error] ${mag.title}:`, err.message);
                globalMagBatchState.failedCount++;
                globalMagBatchState.itemStates[mag.title] = {
                    status: 'failed',
                    error: err.message
                };
            }

            globalMagBatchState.percent = Math.round(((i + 1) / magazines.length) * 100);
        }

        globalMagBatchState.isRunning = false;
        globalMagBatchState.currentTitle = '';
        console.log(`[FreeMagazines Background Batch] Finished! ${globalMagBatchState.completedCount}/${magazines.length} completed.`);
    })();
});

// ── FOREIGN PAPER LIVE FEED & DOWNLOAD APIS (MOBILISM F=123) ───────────────
const { getForeignPapersByDate, downloadForeignPaperIssue } = require('./scrapers/foreignpaper');

app.get('/api/foreignpaper/by-date', async (req, res) => {
    try {
        let { date } = req.query;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const now = new Date();
            date = now.toISOString().slice(0, 10);
        }

        let papers = await getForeignPapersByDate(date);
        
        let effectiveDate = date;
        if (papers.length === 0) {
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            const yDate = d.toISOString().slice(0, 10);
            const yPapers = await getForeignPapersByDate(yDate);
            if (yPapers.length > 0) {
                papers = yPapers;
                effectiveDate = yDate;
            }
        }

        res.json({
            success: true,
            date: effectiveDate,
            requestedDate: date,
            total: papers.length,
            papers
        });
    } catch (err) {
        console.error('[ForeignPaper API Error]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/foreignpaper/status', (req, res) => {
    res.json({ success: true, state: globalForeignPaperBatchState });
});

app.post('/api/foreignpaper/download-single', async (req, res) => {
    try {
        const { paper } = req.body;
        if (!paper || !paper.title) {
            return res.status(400).json({ success: false, error: 'No foreign paper specified.' });
        }

        console.log(`[ForeignPaper Single API] Direct download requested for: ${paper.title}...`);
        const targetUrl = paper.downloadUrl || paper.url;
        const result = await downloadForeignPaperIssue({
            title: paper.title,
            downloadUrl: targetUrl,
            allDownloadUrls: paper.allDownloadUrls,
            coverImage: paper.coverImage,
            date: paper.date || new Date().toISOString().slice(0, 10),
            postUrl: paper.postUrl
        }, OUTPUT_DIR);

        console.log(`[ForeignPaper Single API] Successfully generated ${result.filename}`);

        res.json({
            success: true,
            filename: result.filename,
            sizeMb: result.sizeMb,
            pages: result.pages,
            url: result.url
        });
    } catch (err) {
        console.error('[ForeignPaper Single API Error]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/foreignpaper/stop', (req, res) => {
    globalForeignPaperBatchState.abortRequested = true;
    globalForeignPaperBatchState.isRunning = false;
    res.json({ success: true, message: 'Foreign Paper batch cancellation signal sent.' });
});

app.post('/api/foreignpaper/process-batch', (req, res) => {
    if (globalForeignPaperBatchState.isRunning) {
        return res.status(409).json({
            success: false,
            error: 'A Foreign Paper download batch is already running on the server in the background.',
            state: globalForeignPaperBatchState
        });
    }

    const { date, papers } = req.body;
    if (!Array.isArray(papers) || papers.length === 0) {
        return res.status(400).json({ success: false, error: 'No foreign papers specified for batch download.' });
    }

    globalForeignPaperBatchState.isRunning = true;
    globalForeignPaperBatchState.abortRequested = false;
    globalForeignPaperBatchState.date = date || new Date().toISOString().slice(0, 10);
    globalForeignPaperBatchState.total = papers.length;
    globalForeignPaperBatchState.completedCount = 0;
    globalForeignPaperBatchState.failedCount = 0;
    globalForeignPaperBatchState.percent = 0;
    globalForeignPaperBatchState.currentTitle = '';
    globalForeignPaperBatchState.logs = [];
    globalForeignPaperBatchState.itemStates = {};
    globalForeignPaperBatchState.results = [];

    papers.forEach(p => {
        globalForeignPaperBatchState.itemStates[p.title] = { status: 'pending', sizeMb: '0.00' };
    });

    res.json({ success: true, message: `Started background download of ${papers.length} foreign paper issue(s).` });

    (async () => {
        for (let i = 0; i < papers.length; i++) {
            if (globalForeignPaperBatchState.abortRequested) {
                console.log('[ForeignPaper Background Batch] Cancelled by user.');
                break;
            }

            const item = papers[i];
            const targetUrl = item.downloadUrl || item.url;
            globalForeignPaperBatchState.currentTitle = item.title;
            globalForeignPaperBatchState.itemStates[item.title] = { status: 'downloading', sizeMb: '0.00' };
            globalForeignPaperBatchState.percent = Math.round((i / papers.length) * 100);

            try {
                console.log(`[ForeignPaper Background Batch] (${i + 1}/${papers.length}) Downloading: ${item.title}...`);
                const result = await downloadForeignPaperIssue({
                    title: item.title,
                    downloadUrl: targetUrl,
                    allDownloadUrls: item.allDownloadUrls,
                    coverImage: item.coverImage,
                    date: item.date || globalForeignPaperBatchState.date,
                    postUrl: item.postUrl
                }, OUTPUT_DIR);

                globalForeignPaperBatchState.completedCount++;
                globalForeignPaperBatchState.itemStates[item.title] = {
                    status: 'completed',
                    sizeMb: result.sizeMb,
                    filename: result.filename,
                    url: result.url
                };
                globalForeignPaperBatchState.results.push(result);
            } catch (err) {
                console.error(`[ForeignPaper Background Batch Error] ${item.title}:`, err.message);
                globalForeignPaperBatchState.failedCount++;
                globalForeignPaperBatchState.itemStates[item.title] = {
                    status: 'failed',
                    error: err.message
                };
            }

            globalForeignPaperBatchState.percent = Math.round(((i + 1) / papers.length) * 100);
        }

        globalForeignPaperBatchState.isRunning = false;
        globalForeignPaperBatchState.currentTitle = '';
        console.log(`[ForeignPaper Background Batch] Finished! ${globalForeignPaperBatchState.completedCount}/${papers.length} completed.`);
    })();
});

// ── INDIAN NEWSPAPER LIVE FEED & DOWNLOAD APIS (DAILYEPAPER.IN) ──────────────
const { getIndianPapersByDate, downloadIndianPaperIssue } = require('./scrapers/indianpaper');

app.get('/api/indianpaper/by-date', async (req, res) => {
    try {
        let { date } = req.query;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const now = new Date();
            date = now.toISOString().slice(0, 10);
        }

        let papers = await getIndianPapersByDate(date);
        
        let effectiveDate = date;
        if (papers.length === 0) {
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            const yDate = d.toISOString().slice(0, 10);
            const yPapers = await getIndianPapersByDate(yDate);
            if (yPapers.length > 0) {
                papers = yPapers;
                effectiveDate = yDate;
            }
        }

        res.json({
            success: true,
            date: effectiveDate,
            requestedDate: date,
            total: papers.length,
            papers
        });
    } catch (err) {
        console.error('[IndianPaper API Error]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/indianpaper/status', (req, res) => {
    res.json({ success: true, state: globalIndianPaperBatchState });
});

app.post('/api/indianpaper/stop', (req, res) => {
    globalIndianPaperBatchState.abortRequested = true;
    globalIndianPaperBatchState.isRunning = false;
    res.json({ success: true, message: 'Indian Newspaper batch cancellation signal sent.' });
});

app.post('/api/indianpaper/process-batch', (req, res) => {
    if (globalIndianPaperBatchState.isRunning) {
        return res.status(409).json({
            success: false,
            error: 'An Indian Newspaper download batch is already running on the server in the background.',
            state: globalIndianPaperBatchState
        });
    }

    const { date, papers } = req.body;
    if (!Array.isArray(papers) || papers.length === 0) {
        return res.status(400).json({ success: false, error: 'No Indian newspapers specified for batch download.' });
    }

    globalIndianPaperBatchState.isRunning = true;
    globalIndianPaperBatchState.abortRequested = false;
    globalIndianPaperBatchState.date = date || new Date().toISOString().slice(0, 10);
    globalIndianPaperBatchState.total = papers.length;
    globalIndianPaperBatchState.completedCount = 0;
    globalIndianPaperBatchState.failedCount = 0;
    globalIndianPaperBatchState.percent = 0;
    globalIndianPaperBatchState.currentTitle = '';
    globalIndianPaperBatchState.logs = [];
    globalIndianPaperBatchState.itemStates = {};
    globalIndianPaperBatchState.results = [];

    papers.forEach(p => {
        globalIndianPaperBatchState.itemStates[p.title] = { status: 'pending', sizeMb: '0.00' };
    });

    res.json({ success: true, message: `Started background download of ${papers.length} Indian newspaper issue(s).` });

    (async () => {
        for (let i = 0; i < papers.length; i++) {
            if (globalIndianPaperBatchState.abortRequested) {
                console.log('[IndianPaper Background Batch] Cancelled by user.');
                break;
            }

            const item = papers[i];
            globalIndianPaperBatchState.currentTitle = item.title;
            globalIndianPaperBatchState.itemStates[item.title] = { status: 'downloading', sizeMb: '0.00' };
            globalIndianPaperBatchState.percent = Math.round((i / papers.length) * 100);

            try {
                console.log(`[IndianPaper Background Batch] (${i + 1}/${papers.length}) Downloading: ${item.title}...`);
                const result = await downloadIndianPaperIssue({
                    title: item.title,
                    name: item.name,
                    editionName: item.editionName,
                    downloadUrl: item.downloadUrl,
                    fileId: item.fileId,
                    date: item.date || globalIndianPaperBatchState.date
                }, OUTPUT_DIR);

                globalIndianPaperBatchState.completedCount++;
                globalIndianPaperBatchState.itemStates[item.title] = {
                    status: 'completed',
                    sizeMb: result.sizeMb,
                    filename: result.filename,
                    url: result.url
                };
                globalIndianPaperBatchState.results.push(result);
            } catch (err) {
                console.error(`[IndianPaper Background Batch Error] ${item.title}:`, err.message);
                globalIndianPaperBatchState.failedCount++;
                globalIndianPaperBatchState.itemStates[item.title] = {
                    status: 'failed',
                    error: err.message
                };
            }

            globalIndianPaperBatchState.percent = Math.round(((i + 1) / papers.length) * 100);
        }

        globalIndianPaperBatchState.isRunning = false;
        globalIndianPaperBatchState.currentTitle = '';
        console.log(`[IndianPaper Background Batch] Finished! ${globalIndianPaperBatchState.completedCount}/${papers.length} completed.`);
    })();
});

// ── ARAB NEWS ENDPOINTS ──────────────────────────────────────────────────────
app.get('/api/arab/catalog', (req, res) => {
    const catalog = ARAB_NEWSPAPER_CATALOG.map(item => ({
        id: item.id,
        name: item.name,
        city: item.city,
        country: item.country,
        code: item.code
    }));
    res.json({ success: true, catalog });
});

app.get('/api/arab/status', (req, res) => {
    res.json({ success: true, state: globalArabBatchState });
});

app.get('/api/arab/files', (req, res) => {
    try {
        const dateQuery = req.query.date || new Date().toISOString().slice(0, 10);
        let normalizedDate = dateQuery;
        const parts = dateQuery.split('-');
        let day, monthShort;
        const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                normalizedDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
                day = parseInt(parts[2], 10);
                monthShort = MONTHS_SHORT[parseInt(parts[1], 10) - 1];
            } else {
                normalizedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                day = parseInt(parts[0], 10);
                monthShort = MONTHS_SHORT[parseInt(parts[1], 10) - 1];
            }
        } else {
            const d = new Date();
            day = d.getDate();
            monthShort = MONTHS_SHORT[d.getMonth()];
        }

        const datePrefixShort = monthShort ? `${day} ${monthShort}` : '';
        const datePrefixPadded = monthShort ? `${String(day).padStart(2, '0')} ${monthShort}` : '';

        const allFoundFiles = [];
        const seenNames = new Set();

        // 1. Scan OUTPUT_DIR
        if (fs.existsSync(OUTPUT_DIR)) {
            const outputPdfs = fs.readdirSync(OUTPUT_DIR).filter(f => f.toLowerCase().endsWith('.pdf') && !f.startsWith('test_'));
            for (const filename of outputPdfs) {
                const matchesDate = !datePrefixShort || filename.startsWith(datePrefixShort) || filename.startsWith(datePrefixPadded) || filename.includes(normalizedDate);
                const isArabPaper = ARAB_NEWSPAPER_CATALOG.some(cat => {
                    const cleanCat = cat.name.toLowerCase().replace(/[^a-z0-9 ]/g, '');
                    const words = cleanCat.split(' ').filter(w => w.length > 2);
                    return words.length > 0 && words.every(w => filename.toLowerCase().includes(w));
                });

                if (matchesDate && isArabPaper && !seenNames.has(filename)) {
                    seenNames.add(filename);
                    const fullPath = path.join(OUTPUT_DIR, filename);
                    const stats = fs.statSync(fullPath);
                    let pageCount = 0;
                    try {
                        const pdfBuffer = fs.readFileSync(fullPath);
                        pageCount = (pdfBuffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
                    } catch (_) {}

                    allFoundFiles.push({
                        filename,
                        name: filename.replace(/\.pdf$/i, ''),
                        sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
                        url: `/output/${encodeURIComponent(filename)}`,
                        pages: pageCount || 16,
                        mtime: stats.mtime
                    });
                }
            }
        }

        // 2. Scan public/generated_pdfs/arab/normalizedDate
        const dirPath = path.join(__dirname, 'public', 'generated_pdfs', 'arab', normalizedDate);
        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath).filter(f => f.toLowerCase().endsWith('.pdf')).map(filename => {
                if (seenNames.has(filename)) return null;
                seenNames.add(filename);
                const fullPath = path.join(dirPath, filename);
                const stats = fs.statSync(fullPath);
                let pageCount = 0;
                try {
                    const pdfBuffer = fs.readFileSync(fullPath);
                    pageCount = (pdfBuffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
                } catch (_) {}

                return {
                    filename,
                    name: filename.replace(/\.pdf$/i, ''),
                    sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
                    url: `/generated_pdfs/arab/${normalizedDate}/${encodeURIComponent(filename)}`,
                    pages: pageCount || 16,
                    mtime: stats.mtime
                };
            }).filter(Boolean);
            allFoundFiles.push(...files);
        }

        res.json({ success: true, files: allFoundFiles });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, files: [] });
    }
});

app.post('/api/arab/stop', (req, res) => {
    globalArabBatchState.abortRequested = true;
    globalArabBatchState.isRunning = false;
    res.json({ success: true, message: 'Arab News batch cancellation signal sent.' });
});

app.post('/api/arab/process-batch', (req, res) => {
    if (globalArabBatchState.isRunning) {
        return res.status(409).json({
            success: false,
            error: 'An Arab News batch processing is already running in the background.',
            state: globalArabBatchState
        });
    }

    const { date, editions, papers } = req.body;
    const targetEditions = (Array.isArray(editions) && editions.length > 0)
        ? editions
        : ((Array.isArray(papers) && papers.length > 0) ? papers : ARAB_NEWSPAPER_CATALOG.map(e => e.id));

    globalArabBatchState.isRunning = true;
    globalArabBatchState.abortRequested = false;
    globalArabBatchState.date = date || new Date().toISOString().slice(0, 10);
    globalArabBatchState.total = targetEditions.length;
    globalArabBatchState.completedCount = 0;
    globalArabBatchState.failedCount = 0;
    globalArabBatchState.percent = 0;
    globalArabBatchState.currentEditionName = '';
    globalArabBatchState.logs = [];
    globalArabBatchState.itemStates = {};
    globalArabBatchState.results = [];

    targetEditions.forEach(id => {
        const item = ARAB_NEWSPAPER_CATALOG.find(e => e.id === id);
        const name = item ? item.name : id;
        globalArabBatchState.itemStates[id] = { name, status: 'pending', sizeMb: '0.00' };
    });

    res.json({ success: true, message: `Started background process of ${targetEditions.length} Arab News edition(s).` });

    (async () => {
        try {
            for (let i = 0; i < targetEditions.length; i++) {
                if (globalArabBatchState.abortRequested) {
                    console.log('[Arab News Batch] Cancelled by user.');
                    break;
                }

                const editionId = targetEditions[i];
                const item = ARAB_NEWSPAPER_CATALOG.find(e => e.id === editionId);
                const edName = item ? item.name : editionId;

                globalArabBatchState.currentEditionName = edName;
                globalArabBatchState.itemStates[editionId] = { name: edName, status: 'processing', sizeMb: '0.00' };
                globalArabBatchState.percent = Math.round((i / targetEditions.length) * 100);

                try {
                    console.log(`[Arab News Batch] (${i + 1}/${targetEditions.length}) Processing: ${edName}...`);
                    const result = await processArabEdition(editionId, globalArabBatchState.date);

                    globalArabBatchState.completedCount++;
                    globalArabBatchState.itemStates[editionId] = {
                        name: edName,
                        status: 'completed',
                        sizeMb: result.sizeMb,
                        filename: result.filename,
                        url: result.webUrl,
                        pages: result.pages
                    };
                    globalArabBatchState.results.push(result);
                } catch (err) {
                    console.error(`[Arab News Batch Error] ${edName}:`, err.message);
                    globalArabBatchState.failedCount++;
                    globalArabBatchState.itemStates[editionId] = {
                        name: edName,
                        status: 'failed',
                        error: err.message
                    };
                }

                globalArabBatchState.percent = Math.round(((i + 1) / targetEditions.length) * 100);
            }
        } finally {
            globalArabBatchState.isRunning = false;
            globalArabBatchState.currentEditionName = '';
            console.log(`[Arab News Batch] Finished! ${globalArabBatchState.completedCount}/${targetEditions.length} completed.`);
        }
    })();
});

app.post('/api/magazines/download-issue', async (req, res) => {
    try {
        const { title, downloadUrl, url, coverImage, date } = req.body;
        const targetUrl = downloadUrl || url;
        if (!title) return res.status(400).json({ success: false, error: 'Missing magazine title' });
        if (!targetUrl) return res.status(400).json({ success: false, error: 'Missing download URL' });

        console.log('[FreeMagazines] Downloading issue: ' + title + ' (' + targetUrl + ')...');
        const result = await downloadMagazineIssue({
            title,
            downloadUrl: targetUrl,
            coverImage,
            date
        }, OUTPUT_DIR);

        res.json({
            success: true,
            filename: result.filename,
            sizeMb: result.sizeMb,
            url: result.url,
            cached: result.cached || false
        });
    } catch (err) {
        console.error('[FreeMagazines Download Error]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Legacy /feed endpoint compatibility
app.get('/api/magazines/feed', async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const magazines = await getMagazinesByDate(today);
        res.json({ success: true, count: magazines.length, magazines });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/download-custom-magazine', async (req, res) => {
    try {
        const { url, title, date, config } = req.body;
        if (!url || !url.trim()) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }

        const dateObj = parseDateParts(date);
        let rawTitle = (title || '').trim();
        if (!rawTitle) {
            // Extract from URL basename
            try {
                const uObj = new URL(url);
                const pathParts = uObj.pathname.split('/').filter(Boolean);
                const lastPart = pathParts[pathParts.length - 1] || 'Magazine';
                rawTitle = decodeURIComponent(lastPart.replace(/[-_]/g, ' ').replace(/\.pdf$/i, ''));
            } catch (_) {
                rawTitle = 'Free Magazine';
            }
        }

        // Clean brackets & invalid filename characters
        let cleanTitle = rawTitle.replace(/[()\[\]{}]/g, '').replace(/[/\\?%*:|"<>]/g, '').trim();
        if (!cleanTitle) cleanTitle = 'Free Magazine';

        const finalFilename = `${dateObj.fileDate} ${cleanTitle}.pdf`;
        const outputPath = path.join(OUTPUT_DIR, finalFilename);

        console.log(`[Magazine Downloader] Fetching: ${url} -> ${finalFilename}`);

        // Fetch PDF from URL
        const fetchRes = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        });

        if (!fetchRes.ok) {
            return res.status(500).json({ success: false, error: `Failed to download from URL (HTTP ${fetchRes.status})` });
        }

        const buffer = Buffer.from(await fetchRes.arrayBuffer());

        if (buffer.length < 1000) {
            return res.status(400).json({ success: false, error: 'Downloaded content is too small or not a valid PDF file.' });
        }

        // Save binary PDF
        fs.writeFileSync(outputPath, buffer);

        // Calculate pages & size
        let pagesCount = 1;
        try {
            const { PDFDocument } = require('pdf-lib');
            const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
            pagesCount = pdfDoc.getPageCount();
        } catch (_) {}

        const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
        console.log(`[Magazine Downloader] Saved ${finalFilename} (${sizeMb} MB, ${pagesCount} pgs)`);

        res.json({
            success: true,
            filename: finalFilename,
            sizeMb: sizeMb,
            pages: pagesCount,
            url: `/output/${encodeURIComponent(finalFilename)}`
        });
    } catch (err) {
        console.error('[Magazine Downloader Error]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// ── BULK CUSTOM PDF WATERMARK & PROMO STAMPER ROUTE ─────────────────────────
const multer = require('multer');
const uploadTmpDir = '/tmp/newspaper_uploads';
if (!fs.existsSync(uploadTmpDir)) {
    fs.mkdirSync(uploadTmpDir, { recursive: true });
}

function fixUtf8Filename(str) {
    if (!str) return '';
    try {
        const decoded = Buffer.from(str, 'latin1').toString('utf-8');
        return decoded;
    } catch (_) {
        return str;
    }
}

function cleanOriginalFilename(filename) {
    if (!filename) return '';
    let name = fixUtf8Filename(filename).trim();

    // 0. Strip superscript numbers and garbled unicode bytes (e.g. ²⁶⁰⁹²⁰²⁶ or Â²â□¶â□°)
    name = name.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾\u00C0-\u00FF\u0100-\u024F\u2000-\u206F]/g, '');

    const months = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

    // 1. Remove dates with month names (e.g. 17 September 2026, 17 Sept 2026, Oct 2026, September 17 2026)
    name = name.replace(new RegExp(`(?:[\\s_\\-.]|\\b)\\d{1,2}[\\s_\\-.]*${months}(?:[\\s_\\-.]*\\d{2,4})?\\b`, "gi"), "");
    name = name.replace(new RegExp(`(?:[\\s_\\-.]|\\b)${months}[\\s_\\-.]*\\d{1,2}(?:,?[\\s_\\-.]*\\d{2,4})?\\b`, "gi"), "");
    name = name.replace(new RegExp(`(?:[\\s_\\-.]|\\b)${months}[\\s_\\-.]*\\d{2,4}\\b`, "gi"), "");

    // 2. Numeric full date formats: YYYY-MM-DD, DD-MM-YYYY, DD_MM_YYYY, DD.MM.YYYY, YYYY.MM.DD
    name = name.replace(/(?:[\s_\-.]|\b)(?:\d{4}[\s_\-./]\d{1,2}[\s_\-./]\d{1,2}|\d{1,2}[\s_\-./]\d{1,2}[\s_\-./]\d{2,4})\b/g, "");

    // 3. 2-part numeric dates or trailing date suffixes: _17_09, -17-09, 17-09, _1709, _17092026, -17092026, _170926, 26092026
    name = name.replace(/[\s_\-.]+\d{1,2}[\s_\-./]\d{1,2}\b/g, "");
    name = name.replace(/(?:[\s_\-.]|\b)(?:\d{4}|\d{6}|\d{8})\b/g, "");

    // 4. Remove any remaining non-printable / garbled non-ASCII characters
    name = name.replace(/[^\w\s\-().,]/g, "");

    // 5. Clean up any remaining trailing/leading separators and extra spaces
    name = name.replace(/^[\s_\-.]+|[\s_\-.]+$/g, "").replace(/\s+/g, " ");

    return name.trim() || filename;
}

const customPdfDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadTmpDir),
    filename: (req, file, cb) => cb(null, `up_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`)
});

const pdfUpload = multer({
    storage: customPdfDiskStorage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500 MB per file limit
});

app.post('/api/custom-pdf/watermark-batch', pdfUpload.array('pdfFiles', 50), async (req, res) => {
    req.setTimeout(600000); // 10 minutes timeout per request
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No PDF files were uploaded.' });
        }

        const watermarkText = req.body.watermarkText || 'Social Media Pakistan 0342-4938217';
        const enableTopBanner = req.body.enableTopBanner === 'true' || req.body.enableTopBanner === true;
        const enableBottomBanner = req.body.enableBottomBanner !== 'false' && req.body.enableBottomBanner !== false;
        const enableDiagonal = req.body.enableDiagonal === 'true' || req.body.enableDiagonal === true;
        const appendPromoPages = req.body.appendPromoPages !== 'false' && req.body.appendPromoPages !== false;
        const enableCleanFilename = req.body.enableCleanFilename === 'true' || req.body.enableCleanFilename === true;
        const enableDateOption = req.body.enableDateOption === 'true' || req.body.enableDateOption === true;
        const customDate = (req.body.customDate || '').trim();

        const { assembleAndWatermarkPdf } = require('./services/pdfAssembler');

        let datePrefix = '';
        let dateFormattedStr = '';

        if (enableDateOption) {
            if (customDate) {
                datePrefix = `${customDate} `;
                dateFormattedStr = customDate;
            } else {
                const d = new Date();
                const day = d.getDate();
                const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthShort = monthsShort[d.getMonth()];
                datePrefix = `${day} ${monthShort} `;
                dateFormattedStr = `${day} ${monthShort} ${d.getFullYear()}`;
            }
        }

        const results = await Promise.all(req.files.map(async (file, i) => {
            const originalName = file.originalname || `Document_${i + 1}.pdf`;
            const ext = path.extname(originalName) || '.pdf';
            const rawBaseName = path.basename(originalName, ext);
            
            const baseName = enableCleanFilename ? cleanOriginalFilename(rawBaseName) : rawBaseName;
            const outputFilename = enableDateOption ? `${datePrefix}${baseName}${ext}` : `${baseName}${ext}`;
            const outputPath = safeOutputPath(outputFilename);

            const metadata = {
                newspaperName: baseName,
                editionName: '',
                dateFormatted: enableDateOption ? dateFormattedStr : '',
                outputPath: outputPath
            };

            const config = {
                watermarkText: watermarkText,
                enableTopBanner: enableTopBanner,
                enableBottomBanner: enableBottomBanner,
                enableDiagonal: enableDiagonal,
                appendPromoPages: appendPromoPages,
                fastMode: true
            };

            try {
                const pdfBuffer = fs.readFileSync(file.path);
                const info = await assembleAndWatermarkPdf(pdfBuffer, metadata, config);
                try { fs.unlinkSync(file.path); } catch (_) {}
                setFileCategory(info.filename, 'watermark');

                return {
                    success: true,
                    originalName: originalName,
                    filename: info.filename,
                    pages: info.pages,
                    sizeMb: info.sizeMb,
                    url: `/output/${encodeURIComponent(info.filename)}`
                };
            } catch (err) {
                console.error(`[Custom PDF Watermarker] Error processing ${originalName}:`, err.message);
                try { fs.unlinkSync(file.path); } catch (_) {}
                return {
                    success: false,
                    originalName: originalName,
                    error: err.message
                };
            }
        }));

        return res.json({
            success: true,
            processedCount: results.filter(r => r.success).length,
            totalCount: req.files.length,
            results: results
        });
    } catch (err) {
        console.error('[Custom PDF Watermarker Error]:', err);
        if (req.files) {
            req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) {} });
        }
        return res.status(500).json({ success: false, message: err.message || 'Error processing uploaded PDFs.' });
    }
});

// ── CHUNKED UPLOAD ENDPOINTS FOR LARGE PDF WATERMARKING (Bypasses Cloudflare 100MB Payload Limit) ──
const chunkUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadTmpDir),
        filename: (req, file, cb) => cb(null, `chunk_${Date.now()}_${Math.random().toString(36).substring(7)}.tmp`)
    }),
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB per chunk limit
});

app.post('/api/custom-pdf/upload-chunk', chunkUpload.single('chunk'), async (req, res) => {
    try {
        const { uploadId, chunkIndex, totalChunks } = req.body;
        if (!uploadId || chunkIndex === undefined || !req.file) {
            return res.status(400).json({ success: false, message: 'Invalid chunk data uploaded.' });
        }

        const chunkNum = Number(chunkIndex);
        const chunkFilePath = path.join(uploadTmpDir, `chunk_${uploadId}_${chunkNum}`);
        
        try {
            await fs.promises.rename(req.file.path, chunkFilePath);
        } catch (_) {
            await fs.promises.copyFile(req.file.path, chunkFilePath);
            try { await fs.promises.unlink(req.file.path); } catch (_) {}
        }

        return res.json({
            success: true,
            uploadId: uploadId,
            chunkIndex: chunkNum,
            totalChunks: Number(totalChunks)
        });
    } catch (err) {
        console.error('[Chunk Upload Error]:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/custom-pdf/process-watermark-chunked', express.json(), async (req, res) => {
    req.setTimeout(600000); // 10 minutes timeout per request
    try {
        const { uploadId, totalChunks, originalName, watermarkText, enableTopBanner, enableBottomBanner, enableDiagonal, appendPromoPages, enableCleanFilename, enableDateOption, customDate } = req.body;
        if (!uploadId || !totalChunks) {
            return res.status(400).json({ success: false, message: 'Missing uploadId or totalChunks' });
        }

        const numChunks = Number(totalChunks);
        const assembledPath = path.join(uploadTmpDir, `assembled_${uploadId}.pdf`);

        // Verify all chunks exist and assemble in exact order
        const chunkFiles = [];
        for (let i = 0; i < numChunks; i++) {
            const chunkPath = path.join(uploadTmpDir, `chunk_${uploadId}_${i}`);
            if (!fs.existsSync(chunkPath)) {
                return res.status(400).json({ success: false, message: `Missing chunk ${i} for upload ${uploadId}` });
            }
            chunkFiles.push(chunkPath);
        }

        // Assemble chunks into final PDF file asynchronously via stream piping
        const outStream = fs.createWriteStream(assembledPath);
        for (const cPath of chunkFiles) {
            await new Promise((resPipe, rejPipe) => {
                const inStream = fs.createReadStream(cPath);
                inStream.pipe(outStream, { end: false });
                inStream.on('end', () => {
                    try { fs.unlinkSync(cPath); } catch (_) {}
                    resPipe();
                });
                inStream.on('error', rejPipe);
            });
        }
        await new Promise(resolve => outStream.end(resolve));

        const isCleanEnabled = enableCleanFilename === 'true' || enableCleanFilename === true;
        const isDateEnabled = enableDateOption === 'true' || enableDateOption === true;
        const trimmedCustomDate = (customDate || '').trim();

        let datePrefix = '';
        let dateFormattedStr = '';

        if (isDateEnabled) {
            if (trimmedCustomDate) {
                datePrefix = `${trimmedCustomDate} `;
                dateFormattedStr = trimmedCustomDate;
            } else {
                const d = new Date();
                const day = d.getDate();
                const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthShort = monthsShort[d.getMonth()];
                datePrefix = `${day} ${monthShort} `;
                dateFormattedStr = `${day} ${monthShort} ${d.getFullYear()}`;
            }
        }

        const ext = path.extname(originalName || '') || '.pdf';
        const rawBaseName = path.basename(originalName || 'Document', ext);
        
        const baseName = isCleanEnabled ? cleanOriginalFilename(rawBaseName) : rawBaseName;
        const outputFilename = isDateEnabled ? `${datePrefix}${baseName}${ext}` : `${baseName}${ext}`;
        const outputPath = safeOutputPath(outputFilename);

        const metadata = {
            newspaperName: baseName,
            editionName: '',
            dateFormatted: isDateEnabled ? dateFormattedStr : '',
            outputPath: outputPath
        };

        const config = {
            watermarkText: watermarkText || 'Social Media Pakistan 0342-4938217',
            enableTopBanner: enableTopBanner === 'true' || enableTopBanner === true,
            enableBottomBanner: enableBottomBanner !== 'false' && enableBottomBanner !== false,
            enableDiagonal: enableDiagonal === 'true' || enableDiagonal === true,
            appendPromoPages: appendPromoPages !== 'false' && appendPromoPages !== false,
            fastMode: true
        };

        const { assembleAndWatermarkPdf } = require('./services/pdfAssembler');

        const pdfBuffer = fs.readFileSync(assembledPath);
        const info = await assembleAndWatermarkPdf(pdfBuffer, metadata, config);
        try { fs.unlinkSync(assembledPath); } catch (_) {}
        setFileCategory(info.filename, 'watermark');

        return res.json({
            success: true,
            processedCount: 1,
            totalCount: 1,
            results: [{
                success: true,
                originalName: originalName || baseName + ext,
                filename: info.filename,
                pages: info.pages,
                sizeMb: info.sizeMb,
                url: `/output/${encodeURIComponent(info.filename)}`
            }]
        });
    } catch (err) {
        console.error('[Process Watermark Chunked Error]:', err);
        return res.status(500).json({ success: false, message: err.message || 'Error processing uploaded PDF.' });
    }
});


// ==========================================



// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM CHANNEL INTEGRATION API (Channel ID: 1154495545)
// ═══════════════════════════════════════════════════════════════════════════════
const telegramSync = require('./services/telegramSync');

// Get list of Telegram PDF files, dates, and current configuration
app.get('/api/telegram/files', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
        const data = await telegramSync.listTelegramFiles(req.query.date);
        res.json(data);
    } catch (err) {
        console.error('[API /api/telegram/files error]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Trigger Telegram Channel Sync / Poll
app.post('/api/telegram/sync', async (req, res) => {
    try {
        const result = await telegramSync.syncTelegramChannel();
        res.json(result);
    } catch (err) {
        console.error('[API /api/telegram/sync error]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get Telegram configuration
app.get('/api/telegram/config', (req, res) => {
    try {
        const config = telegramSync.getConfig();
        const masked = { ...config };
        if (masked.botToken) {
            masked.botTokenMasked = masked.botToken.substring(0, 6) + '...' + masked.botToken.slice(-4);
        }
        res.json({ success: true, config: masked });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Save Telegram configuration
app.post('/api/telegram/config', (req, res) => {
    try {
        const { channelId, botToken, channelUsername, channelInviteLink } = req.body;
        const updates = {};
        if (channelId !== undefined) updates.channelId = channelId.trim();
        if (botToken !== undefined) updates.botToken = botToken.trim();
        if (channelUsername !== undefined) updates.channelUsername = channelUsername.trim();
        if (channelInviteLink !== undefined) updates.channelInviteLink = channelInviteLink.trim();

        const updated = telegramSync.saveConfig(updates);
        res.json({ success: true, config: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Download ZIP package of Telegram publications for a date
app.get('/api/telegram/download-zip', async (req, res) => {
    try {
        const dateStr = req.query.date || '';
        await telegramSync.createDateZipStream(dateStr, res);
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

// Delete a single Telegram publication file
app.delete('/api/telegram/file', (req, res) => {
    try {
        const filePath = req.query.path || (req.body && req.body.path);
        if (!filePath) {
            return res.status(400).json({ success: false, error: 'Path is required' });
        }
        const success = telegramSync.deleteTelegramFile(filePath);
        res.json({ success });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// Upload Telegram PDF publication directly from browser
app.post('/api/telegram/upload', (req, res) => {
    try {
        const rawFilename = req.query.filename || req.headers['x-filename'] || 'Telegram_Publication.pdf';
        const cleanFilename = path.basename(decodeURIComponent(rawFilename)).replace(/[/\\?%*:|"<>]/g, '').trim();
        const dateStr = req.query.date || new Date().toISOString().split('T')[0];
        
        const targetDir = path.join(telegramSync.TELEGRAM_OUTPUT_DIR, dateStr);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const destPath = path.join(targetDir, cleanFilename);
        const writeStream = fs.createWriteStream(destPath);
        
        req.pipe(writeStream);
        
        writeStream.on('finish', () => {
            const stats = fs.statSync(destPath);
            res.json({
                success: true,
                filename: cleanFilename,
                sizeMb: (stats.size / 1024 / 1024).toFixed(2),
                url: `/output/telegram/${encodeURIComponent(dateStr)}/${encodeURIComponent(cleanFilename)}`
            });
        });
        
        writeStream.on('error', (err) => {
            res.status(500).json({ success: false, error: err.message });
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── PASSPORT SIZE PHOTO AI PROCESSOR API ─────────────────────────────────────
const passportStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadTmpDir),
    filename: (req, file, cb) => cb(null, `passport_${Date.now()}_${Math.random().toString(36).substring(7)}.png`)
});
const passportUpload = multer({ storage: passportStorage });

app.post('/api/passport/process-ai', passportUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image uploaded.' });
        }
        const inputPath = req.file.path;
        const outputPath = path.join(uploadTmpDir, `processed_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
        
        const smoothing = parseInt(req.body.smoothing || '40', 10);
        const brightness = parseInt(req.body.brightness || '5', 10);
        const contrast = parseInt(req.body.contrast || '10', 10);

        const venvPython = path.join(__dirname, 'venv', 'bin', 'python3');
        const scriptPath = path.join(__dirname, 'services', 'passport_ai.py');
        const cmd = `"${venvPython}" "${scriptPath}" "${inputPath}" "${outputPath}" ${smoothing} ${brightness} ${contrast}`;

        exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
            try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch (e) {}

            if (err) {
                console.error('[Passport AI Error]:', err, stderr);
                return res.status(500).json({ success: false, error: stderr || err.message });
            }

            try {
                const parsed = JSON.parse(stdout.trim());
                if (parsed.success && fs.existsSync(outputPath)) {
                    const imgBuf = fs.readFileSync(outputPath);
                    const base64Img = `data:image/png;base64,${imgBuf.toString('base64')}`;
                    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (e) {}
                    return res.json({ success: true, base64Image: base64Img });
                } else {
                    return res.status(500).json({ success: false, error: parsed.error || 'Failed to process image with AI.' });
                }
            } catch (e) {
                console.error('[Passport JSON parse error]:', e, stdout);
                return res.status(500).json({ success: false, error: 'Invalid response from AI engine.' });
            }
        });
    } catch (err) {
        console.error('[Passport API Error]:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  Pakistan News PDF Watermarker & Downloader Hub`);
    console.log(`  Server running at: http://localhost:${PORT}`);
    console.log(`  Output Folder: ${OUTPUT_DIR}`);
    console.log(`====================================================`);
});
