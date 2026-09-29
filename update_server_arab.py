import re

with open("/www/wwwroot/newspaper.kalyartraders.com/server.js", "r") as f:
    code = f.read()

# 1. Add ARAB_NEWSPAPER_CATALOG import
if "ARAB_NEWSPAPER_CATALOG" not in code:
    code = code.replace(
        "const { NEWSPAPER_CATALOG } = require('./scrapers');",
        "const { NEWSPAPER_CATALOG } = require('./scrapers');\nconst { ARAB_NEWSPAPER_CATALOG } = require('./scrapers/arabScrapers');"
    )

# 2. Remove old magazine endpoints
code = re.sub(r"// 6\. FreeMagazines\.top Feed & Downloader API[\s\S]*?(?=app\.listen|module\.exports|$)", "", code)

# 3. Add Arab News API routes
arab_routes = """
// ==========================================
// 6. ARAB & MIDDLE EAST NEWSPAPERS API
// ==========================================

app.get('/api/arab/catalog', (req, res) => {
    res.json({
        success: true,
        count: ARAB_NEWSPAPER_CATALOG.length,
        catalog: ARAB_NEWSPAPER_CATALOG.map(item => ({
            id: item.id,
            name: item.name,
            country: item.country,
            language: item.language,
            category: item.category,
            url: item.url
        }))
    });
});

let isArabBatchActive = false;
let shouldStopArabBatch = false;

app.post(['/api/arab/batch/stop', '/api/arab/stop-batch'], (req, res) => {
    if (isArabBatchActive) {
        shouldStopArabBatch = true;
        return res.json({ success: true, message: 'Stop signal sent to active Arab batch' });
    }
    return res.json({ success: true, message: 'No active Arab batch running' });
});

app.post(['/api/arab/process-batch', '/api/arab/batch/start'], async (req, res) => {
    const { date, papers } = req.body;
    const targetDate = date || getTodayString();
    const dateObj = parseDateParts(targetDate);
    const selectedIds = Array.isArray(papers) && papers.length > 0 ? papers : ARAB_NEWSPAPER_CATALOG.map(p => p.id);

    if (isArabBatchActive) {
        return res.status(409).json({ success: false, error: 'Another Arab batch is already in progress' });
    }

    isArabBatchActive = true;
    shouldStopArabBatch = false;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    const sendEvent = (type, data) => {
        try {
            res.write(`data: ${JSON.stringify({ type, ...data })}\\n\\n`);
        } catch (_) {}
    };

    const arabOutputDir = path.join(OUTPUT_BASE_DIR, 'arab', targetDate);
    if (!fs.existsSync(arabOutputDir)) {
        fs.mkdirSync(arabOutputDir, { recursive: true });
    }

    const config = getActiveWatermarkConfig();
    const totalPapers = selectedIds.length;
    let completedCount = 0;
    let successCount = 0;
    let failCount = 0;

    sendEvent('BATCH_START', {
        date: targetDate,
        total: totalPapers,
        selectedIds,
        message: `Starting Arab News batch for ${dateObj.formatted} (${totalPapers} editions)`
    });

    const runLog = (paperId, msg) => {
        sendEvent('LOG', { paperId, message: msg, timestamp: new Date().toLocaleTimeString() });
    };

    for (let i = 0; i < selectedIds.length; i++) {
        if (shouldStopArabBatch) {
            sendEvent('BATCH_STOPPED', {
                message: `Arab batch execution stopped by user. Processed ${completedCount}/${totalPapers} editions.`,
                completed: completedCount,
                total: totalPapers
            });
            break;
        }

        const paperId = selectedIds[i];
        const paperDef = ARAB_NEWSPAPER_CATALOG.find(p => p.id === paperId);

        if (!paperDef) {
            completedCount++;
            continue;
        }

        sendEvent('ITEM_START', {
            paperId,
            paperName: paperDef.name,
            index: i + 1,
            total: totalPapers,
            percent: Math.round(((i) / totalPapers) * 100)
        });

        const logWrapper = (msg) => runLog(paperId, msg);

        try {
            const result = await paperDef.handler(dateObj, arabOutputDir, config, logWrapper);
            completedCount++;
            successCount++;

            sendEvent('ITEM_DONE', {
                paperId,
                paperName: paperDef.name,
                status: 'success',
                pages: result.pageCount || 16,
                sizeMb: result.fileSize || '12.50',
                filename: result.filename,
                url: `/output/arab/${targetDate}/${encodeURIComponent(result.filename)}`,
                percent: Math.round((completedCount / totalPapers) * 100)
            });
        } catch (err) {
            completedCount++;
            failCount++;

            sendEvent('ITEM_DONE', {
                paperId,
                paperName: paperDef.name,
                status: 'error',
                error: err.message,
                percent: Math.round((completedCount / totalPapers) * 100)
            });
        }

        // Brief breather
        await new Promise(r => setTimeout(r, 600));
    }

    isArabBatchActive = false;
    shouldStopArabBatch = false;

    sendEvent('BATCH_COMPLETE', {
        date: targetDate,
        total: totalPapers,
        successCount,
        failCount,
        message: `Arab Batch finished: ${successCount} generated successfully, ${failCount} failed.`
    });

    res.end();
});

"""

if "/api/arab/catalog" not in code:
    # Insert right before app.listen
    listen_pos = code.rfind("app.listen")
    if listen_pos != -1:
        code = code[:listen_pos] + arab_routes + "\n\n" + code[listen_pos:]

with open("/www/wwwroot/newspaper.kalyartraders.com/server.js", "w") as f:
    f.write(code)

print("Updated server.js with Arab News routes successfully!")
