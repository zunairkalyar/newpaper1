const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { PDFDocument } = require('pdf-lib');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'telegram.json');
const TELEGRAM_OUTPUT_DIR = path.join(__dirname, '..', 'output', 'telegram');

// In-memory page count cache
const pageCountCache = new Map();

// Helper: Ensure directories exist
function ensureDirs() {
    if (!fs.existsSync(TELEGRAM_OUTPUT_DIR)) {
        fs.mkdirSync(TELEGRAM_OUTPUT_DIR, { recursive: true });
    }
    const configDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
}

// ── CONFIG MANAGEMENT ────────────────────────────────────────────────────────
function getConfig() {
    ensureDirs();
    if (!fs.existsSync(CONFIG_PATH)) {
        const defaultConfig = {
            channelId: "1154495545",
            chatId: "-1001154495545",
            channelUsername: "",
            channelInviteLink: "",
            botToken: "",
            lastSync: null,
            lastUpdateId: 0,
            autoSync: false
        };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
    }
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.error('[telegramSync] Error reading config:', e.message);
        return {
            channelId: "1154495545",
            chatId: "-1001154495545",
            channelUsername: "",
            channelInviteLink: "",
            botToken: "",
            lastSync: null,
            lastUpdateId: 0,
            autoSync: false
        };
    }
}

function saveConfig(updates) {
    const current = getConfig();
    const merged = { ...current, ...updates };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
    return merged;
}

// ── HELPER: Fast Exact PDF Page Count ────────────────────────────────────────
async function getPdfPageCount(filePath, mtimeMs) {
    const key = filePath + '_' + mtimeMs;
    if (pageCountCache.has(key)) return pageCountCache.get(key);
    try {
        const buf = fs.readFileSync(filePath);
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = doc.getPageCount();
        pageCountCache.set(key, pages);
        return pages;
    } catch (err) {
        return null;
    }
}

// ── HELPER: Format Dates ─────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateFromStats(dateObj) {
    const day = dateObj.getDate();
    const mon = MONTHS_SHORT[dateObj.getMonth()];
    const yr = dateObj.getFullYear();
    return `${day} ${mon} ${yr}`;
}

function parseDateFromFilenameOrFolder(filename, folderName, mtime) {
    // 1. Check if folderName is an ISO date: 2026-09-06
    if (folderName && /^\d{4}-\d{2}-\d{2}$/.test(folderName)) {
        const [y, m, d] = folderName.split('-');
        return `${parseInt(d, 10)} ${MONTHS_SHORT[parseInt(m, 10) - 1]} ${y}`;
    }
    // 2. Check if folderName is formatted like "6 Sep" or "06-Sep-2026"
    if (folderName && folderName !== 'telegram') {
        return folderName;
    }

    // 3. Match from filename: "6 Sep", "06-09-2026", "2026-09-06", "06-Sep-2026"
    const mIso = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) {
        return `${parseInt(mIso[3], 10)} ${MONTHS_SHORT[parseInt(mIso[2], 10) - 1]} ${mIso[1]}`;
    }
    const mShort = filename.match(/(\d{1,2})\s+([A-Za-z]{3})(?:\s+(\d{4}))?/i);
    if (mShort) {
        return `${mShort[1]} ${mShort[2]}${mShort[3] ? ' ' + mShort[3] : ''}`;
    }
    const mDmy = filename.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (mDmy) {
        return `${parseInt(mDmy[1], 10)} ${MONTHS_SHORT[parseInt(mDmy[2], 10) - 1]} ${mDmy[3]}`;
    }

    // 4. Fallback to mtime
    return formatDateFromStats(new Date(mtime));
}

// ── FILE SCANNER & LISTING ───────────────────────────────────────────────────
async function listTelegramFiles(requestedDate) {
    ensureDirs();
    const filesList = [];

    // Helper recursive reader
    function scanDir(currentDir, currentFolderRel) {
        if (!fs.existsSync(currentDir)) return;
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                scanDir(fullPath, currentFolderRel ? path.join(currentFolderRel, entry.name) : entry.name);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
                const stats = fs.statSync(fullPath);
                const originalName = entry.name;
                const pubDate = parseDateFromFilenameOrFolder(originalName, currentFolderRel, stats.mtime);
                
                const relativePath = currentFolderRel ? path.join(currentFolderRel, entry.name) : entry.name;
                // Encode URL path cleanly
                const encodedPath = relativePath.split(path.sep).map(p => encodeURIComponent(p)).join('/');

                filesList.push({
                    name: originalName,
                    originalName: originalName,
                    fullPath: fullPath,
                    relativePath: relativePath,
                    pubDate: pubDate,
                    folder: currentFolderRel || 'root',
                    sizeBytes: stats.size,
                    sizeMb: (stats.size / 1024 / 1024).toFixed(2),
                    createdAt: stats.mtime,
                    mtimeMs: stats.mtimeMs,
                    url: `/output/telegram/${encodedPath}`
                });
            }
        }
    }

    scanDir(TELEGRAM_OUTPUT_DIR, '');

    // Get page counts asynchronously with caching
    await Promise.all(filesList.map(async f => {
        f.pages = await getPdfPageCount(f.fullPath, f.mtimeMs);
    }));

    // Sort newest first
    filesList.sort((a, b) => b.createdAt - a.createdAt);

    // Group files by date
    const dateMap = {};
    filesList.forEach(f => {
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

    let filteredFiles = filesList;
    if (requestedDate) {
        const reqNorm = requestedDate.toLowerCase().trim();
        filteredFiles = filesList.filter(f => 
            f.pubDate.toLowerCase().includes(reqNorm) ||
            f.folder.toLowerCase().includes(reqNorm) ||
            f.name.toLowerCase().includes(reqNorm)
        );
    }

    const config = getConfig();
    return {
        success: true,
        files: filteredFiles,
        allFilesCount: filesList.length,
        dateGroups,
        config: {
            channelId: config.channelId,
            chatId: config.chatId,
            channelUsername: config.channelUsername,
            hasBotToken: Boolean(config.botToken && config.botToken.length > 5),
            lastSync: config.lastSync
        }
    };
}

// ── SYNC ENGINE: TELEGRAM PULL ───────────────────────────────────────────────
async function syncTelegramChannel() {
    ensureDirs();
    const config = getConfig();
    const now = new Date();
    const todayFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayDir = path.join(TELEGRAM_OUTPUT_DIR, todayFolder);
    if (!fs.existsSync(todayDir)) {
        fs.mkdirSync(todayDir, { recursive: true });
    }

    const report = {
        success: true,
        channelId: config.channelId,
        newFiles: [],
        errors: [],
        message: ''
    };

    // Check if user entered a bot username instead of API token
    if (config.botToken && config.botToken.trim()) {
        const trimmedToken = config.botToken.trim();
        if (!/^\d+:[A-Za-z0-9_-]+$/.test(trimmedToken)) {
            report.success = false;
            report.message = `\"${trimmedToken}\" is a Bot Username, not an API Token. A Bot Token is generated via @BotFather and looks like \"123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ\".`;
            return report;
        }
    }

    // Case 1: Valid Bot Token is configured
    if (config.botToken && /^\d+:[A-Za-z0-9_-]+$/.test(config.botToken.trim())) {
        try {
            const token = config.botToken.trim();
            console.log(`[telegramSync] Polling Telegram Bot API for channel ${config.channelId}...`);
            const updateUrl = `https://api.telegram.org/bot${token}/getUpdates?offset=${config.lastUpdateId ? config.lastUpdateId + 1 : 0}&timeout=5`;
            const resp = await fetch(updateUrl);
            const data = await resp.json();

            if (!data.ok) {
                throw new Error(data.description || 'Telegram Bot API error');
            }

            let highestUpdateId = config.lastUpdateId || 0;
            const updates = data.result || [];

            for (const upd of updates) {
                if (upd.update_id > highestUpdateId) {
                    highestUpdateId = upd.update_id;
                }

                // Check channel_post or message
                const msg = upd.channel_post || upd.message;
                if (!msg) continue;

                // Match channel or direct private message/forward to bot
                const msgChatId = msg.chat ? String(msg.chat.id) : '';
                const targetChatId = String(config.channelId).replace(/^-100/, '');
                const fullChatId = `-100${targetChatId}`;

                const isTargetChannel = (msgChatId === targetChatId || msgChatId === fullChatId || msgChatId === config.chatId);
                const isPrivateMessage = (msg.chat && msg.chat.type === 'private');
                const isForwarded = Boolean(msg.forward_from_chat || msg.forward_from);

                // Allow if from target channel OR sent/forwarded directly to the bot
                if (!isTargetChannel && !isPrivateMessage && !isForwarded) {
                    continue;
                }

                // Check for document
                const doc = msg.document;
                if (doc && (doc.mime_type === 'application/pdf' || (doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf')))) {
                    const originalName = doc.file_name || `telegram_doc_${doc.file_id}.pdf`;
                    const destPath = path.join(todayDir, originalName);

                    // Skip if already downloaded
                    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
                        continue;
                    }

                    // Check file size (Telegram bot limit is 20MB for getFile)
                    if (doc.file_size && doc.file_size > 20 * 1024 * 1024) {
                        report.errors.push(`File "${originalName}" is ${(doc.file_size / 1024 / 1024).toFixed(1)}MB, exceeding Telegram standard bot 20MB limit.`);
                        continue;
                    }

                    // Get download path
                    const fileInfoResp = await fetch(`https://api.telegram.org/bot${config.botToken}/getFile?file_id=${doc.file_id}`);
                    const fileInfo = await fileInfoResp.json();

                    if (fileInfo.ok && fileInfo.result && fileInfo.result.file_path) {
                        const fileDownloadUrl = `https://api.telegram.org/file/bot${config.botToken}/${fileInfo.result.file_path}`;
                        const fileResp = await fetch(fileDownloadUrl);
                        if (fileResp.ok) {
                            const arrayBuffer = await fileResp.arrayBuffer();
                            fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
                            report.newFiles.push({
                                filename: originalName,
                                sizeBytes: doc.file_size,
                                sizeMb: (doc.file_size / 1024 / 1024).toFixed(2),
                                path: destPath
                            });
                            console.log(`[telegramSync] Successfully downloaded: ${originalName}`);
                        }
                    }
                }
            }

            saveConfig({
                lastSync: new Date().toISOString(),
                lastUpdateId: highestUpdateId
            });

            report.message = report.newFiles.length > 0 
                ? `Successfully synced ${report.newFiles.length} new PDF(s) from Telegram!` 
                : 'Telegram sync complete. No new PDF publications found in channel.';
            return report;
        } catch (err) {
            console.error('[telegramSync] Error in Bot API sync:', err.message);
            report.success = false;
            report.message = `Telegram sync error: ${err.message}`;
            return report;
        }
    }

    // Case 2: No Bot Token configured yet
    saveConfig({ lastSync: new Date().toISOString() });
    report.message = `Telegram Channel ${config.channelId} sync checked. To enable automated real-time pulling, configure your Telegram Bot Token in Telegram Settings.`;
    return report;
}

// ── ZIP ARCHIVER ─────────────────────────────────────────────────────────────
function createDateZipStream(dateStr, res) {
    ensureDirs();
    const filesResp = listTelegramFiles(dateStr);
    
    return new Promise(async (resolve, reject) => {
        const data = await filesResp;
        const targetGroup = data.dateGroups.find(g => 
            g.date.toLowerCase() === (dateStr || '').toLowerCase() ||
            g.files.some(f => f.pubDate === dateStr || f.folder === dateStr)
        ) || (data.dateGroups.length > 0 ? data.dateGroups[0] : null);

        if (!targetGroup || targetGroup.files.length === 0) {
            res.status(404).json({ success: false, error: `No Telegram PDF files found for date "${dateStr}".` });
            return resolve();
        }

        const cleanDateName = targetGroup.date.replace(/[^a-zA-Z0-9_-]/g, '_');
        const zipFilename = `Telegram_Publications_${cleanDateName}.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

        const archive = new archiver.ZipArchive({ zlib: { level: 4 } });
        archive.on('error', err => {
            console.error('[telegramSync] ZIP Archiver error:', err);
            reject(err);
        });

        archive.pipe(res);

        for (const file of targetGroup.files) {
            if (fs.existsSync(file.fullPath)) {
                // Add with original filename
                archive.file(file.fullPath, { name: file.originalName });
            }
        }

        await archive.finalize();
        resolve();
    });
}

// ── DELETE FILE ──────────────────────────────────────────────────────────────
function deleteTelegramFile(relativePath) {
    ensureDirs();
    if (!relativePath || relativePath.includes('..')) {
        throw new Error('Invalid file path');
    }
    const fullPath = path.resolve(TELEGRAM_OUTPUT_DIR, relativePath);
    if (!fullPath.startsWith(TELEGRAM_OUTPUT_DIR)) {
        throw new Error('Path traversal detected');
    }
    if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
    }
    return false;
}

module.exports = {
    getConfig,
    saveConfig,
    listTelegramFiles,
    syncTelegramChannel,
    createDateZipStream,
    deleteTelegramFile,
    TELEGRAM_OUTPUT_DIR
};
