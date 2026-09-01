const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const AdmZip = require('adm-zip');
const { NEWSPAPER_CATALOG } = require('./scrapers');

const app = express();
const PORT = process.env.PORT || 3000;
const WORKSPACE_DIR = __dirname;
const OUTPUT_DIR = path.join(WORKSPACE_DIR, 'output');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(OUTPUT_DIR));

// Helper: Parse date string DD-MM-YYYY or YYYY-MM-DD
function parseDateParts(dateStr) {
    if (!dateStr) {
        const now = new Date();
        return {
            day: now.getDate(),
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            formatted: `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`
        };
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return {
            day: d,
            month: m,
            year: y,
            formatted: `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`
        };
    }
    
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
        const [d, m, y] = dateStr.split('-').map(Number);
        return {
            day: d,
            month: m,
            year: y,
            formatted: `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`
        };
    }
    
    const now = new Date();
    return {
        day: now.getDate(),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        formatted: `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`
    };
}

// API Routes

// 1. Get newspaper catalog
app.get('/api/catalog', (req, res) => {
    const catalog = NEWSPAPER_CATALOG.map(n => ({
        id: n.id,
        name: n.name,
        category: n.category
    }));
    res.json({ success: true, catalog });
});

// 2. Get list of generated PDF files
app.get('/api/files', (req, res) => {
    try {
        const files = fs.readdirSync(OUTPUT_DIR)
            .filter(f => f.toLowerCase().endsWith('.pdf') && !f.startsWith('TheNews-') && !f.startsWith('test_'))
            .map(f => {
                const fullPath = path.join(OUTPUT_DIR, f);
                const stats = fs.statSync(fullPath);
                return {
                    name: f,
                    sizeBytes: stats.size,
                    sizeMb: (stats.size / 1024 / 1024).toFixed(2),
                    createdAt: stats.mtime,
                    url: `/output/${encodeURIComponent(f)}`
                };
            })
            .sort((a, b) => b.createdAt - a.createdAt);
            
        res.json({ success: true, files });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Download All Files as a single ZIP Archive for a given date
app.get('/api/download-zip', (req, res) => {
    try {
        const dateQuery = req.query.date;
        const dateObj = parseDateParts(dateQuery);
        const dateStr = dateObj.formatted;

        const allFiles = fs.readdirSync(OUTPUT_DIR)
            .filter(f => f.toLowerCase().endsWith('.pdf') && !f.startsWith('TheNews-') && !f.startsWith('test_'));

        const matchingFiles = allFiles.filter(f => f.startsWith(dateStr));
        const filesToZip = matchingFiles.length > 0 ? matchingFiles : allFiles;

        if (filesToZip.length === 0) {
            return res.status(404).send('No PDF files found to package into ZIP.');
        }

        const zip = new AdmZip();
        for (const f of filesToZip) {
            const filePath = path.join(OUTPUT_DIR, f);
            zip.addLocalFile(filePath);
        }

        const zipBuffer = zip.toBuffer();
        const zipName = `${dateStr} Newspapers Package - Social Media Pakistan.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);
        res.setHeader('Content-Length', zipBuffer.length);
        res.send(zipBuffer);
    } catch (err) {
        console.error('ZIP creation error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Open Output Folder in Windows Explorer
app.post('/api/open-folder', (req, res) => {
    try {
        const folderToOpen = OUTPUT_DIR.replace(/\//g, '\\');
        exec(`explorer.exe "${folderToOpen}"`);
        res.json({ success: true, message: 'Opening folder in Windows Explorer' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Delete a file
app.delete('/api/files/:filename', (req, res) => {
    try {
        const targetPath = path.join(OUTPUT_DIR, req.params.filename);
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
            res.json({ success: true, message: 'File deleted' });
        } else {
            res.status(404).json({ success: false, error: 'File not found' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. SSE Stream endpoint for batch downloading
app.post('/api/process-batch', async (req, res) => {
    const { date, selectedIds, config } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const sendLog = (msg, type = 'info', progress = null, fileResult = null) => {
        const payload = JSON.stringify({ message: msg, type, progress, fileResult, time: new Date().toLocaleTimeString() });
        res.write(`data: ${payload}\n\n`);
    };

    const dateObj = parseDateParts(date);
    const targetIds = (selectedIds && selectedIds.length > 0) 
        ? selectedIds 
        : ['thenews_khi', 'thenews_lhr', 'thenews_isb', 'jang_lhr', 'pak_observer', 'lead_pakistan'];

    sendLog(`🚀 Starting batch job for ${targetIds.length} newspaper edition(s) on date ${dateObj.formatted}...`, 'info', 5);

    const results = [];
    const total = targetIds.length;

    for (let i = 0; i < total; i++) {
        const paperId = targetIds[i];
        const paperEntry = NEWSPAPER_CATALOG.find(n => n.id === paperId);
        
        if (!paperEntry) {
            sendLog(`Skipping unrecognized paper ID: ${paperId}`, 'error');
            continue;
        }

        try {
            const startProg = Math.round((i / total) * 90);
            sendLog(`[${i + 1}/${total}] Processing ${paperEntry.name}...`, 'info', startProg);
            
            const fileInfo = await paperEntry.handler(
                dateObj,
                OUTPUT_DIR,
                config || {},
                (logMsg) => sendLog(logMsg, 'info')
            );
            
            results.push(fileInfo);
            const endProg = Math.round(((i + 1) / total) * 90);
            sendLog(`✓ Completed ${paperEntry.name}! (${fileInfo.sizeMb} MB, ${fileInfo.pages} pages)`, 'success', endProg, fileInfo);
        } catch (err) {
            sendLog(`✗ Failed for ${paperEntry.name}: ${err.message}`, 'error');
        }
    }

    sendLog(`🎉 All processing finished! ${results.length}/${total} editions completed. Click "Download All (ZIP)" to download everything together.`, 'done', 100);
    res.write(`data: ${JSON.stringify({ type: 'COMPLETE', results, date: dateObj.formatted })}\n\n`);
    res.end();
});

// Start Server
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  Pakistan News PDF Watermarker & Downloader Hub`);
    console.log(`  Server running at: http://localhost:${PORT}`);
    console.log(`  Output Folder: ${OUTPUT_DIR}`);
    console.log(`====================================================`);
});
