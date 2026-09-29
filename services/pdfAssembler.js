const { PDFDocument, PDFName, rgb, degrees, StandardFonts } = require('pdf-lib');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execSync } = require('child_process');

function isJpg(buf) {
    if (!buf || buf.length < 4) return false;
    return buf[0] === 0xFF && buf[1] === 0xD8;
}

function isPng(buf) {
    if (!buf || buf.length < 4) return false;
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
}

function hexToRgb(hex) {
    let clean = hex.replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    const num = parseInt(clean, 16);
    return rgb(
        ((num >> 16) & 255) / 255,
        ((num >> 8) & 255) / 255,
        (num & 255) / 255
    );
}

function repairPdfBuffer(buf) {
    if (!buf || !Buffer.isBuffer(buf) || buf.length < 5000) return buf;
    try {
        const randId = Math.random().toString(36).substring(7);
        const inPath = path.join(os.tmpdir(), `repair_in_${Date.now()}_${randId}.pdf`);
        const outPath = path.join(os.tmpdir(), `repair_out_${Date.now()}_${randId}.pdf`);
        fs.writeFileSync(inPath, buf);
        execSync(`qpdf --linearize --object-streams=disable "${inPath}" "${outPath}"`, { stdio: 'ignore' });
        if (fs.existsSync(outPath)) {
            const repairedBuf = fs.readFileSync(outPath);
            try { fs.unlinkSync(inPath); } catch (_) {}
            try { fs.unlinkSync(outPath); } catch (_) {}
            if (repairedBuf && repairedBuf.length > 5000) {
                console.log(`[PDF Assembler] qpdf repaired PDF buffer (${(repairedBuf.length / 1024 / 1024).toFixed(2)} MB)`);
                return repairedBuf;
            }
        }
    } catch (err) {
        console.warn('[PDF Assembler] qpdf repair attempt warning:', err.message);
    }
    return buf;
}

// In-memory cache for promo pages to avoid redundant disk read & sharp ops
let cachedPromoImages = null;
function getPromoImages() {
    if (cachedPromoImages) return cachedPromoImages;
    const promoFiles = [
        path.join(__dirname, "..", "assets", "last_page_1_rules.jpg"),
        path.join(__dirname, "..", "assets", "last_page_2_services.jpg")
    ];
    cachedPromoImages = [];
    for (const promoPath of promoFiles) {
        if (fs.existsSync(promoPath)) {
            try {
                cachedPromoImages.push(fs.readFileSync(promoPath));
            } catch (_) {}
        }
    }
    return cachedPromoImages;
}

/**
 * Fast & Non-Blocking: Attaches an embedded XObject /Thumb image to Page 1 for WhatsApp / OS document previews.
 */
async function attachFirstPageThumbnail(finalDoc, input) {
    try {
        let thumbJpgBuf = null;

        if (Array.isArray(input) && input.length > 0 && Buffer.isBuffer(input[0])) {
            // For image arrays: generate a ~300px thumbnail from the first page image
            thumbJpgBuf = await sharp(input[0])
                .resize(300, 400, { fit: 'inside' })
                .jpeg({ quality: 80 })
                .toBuffer();
        } else if (Buffer.isBuffer(input)) {
            // For raw PDF buffers: render Page 1 using pdftoppm -scale-to 300 (fast, single step)
            const randId = Math.random().toString(36).substring(7);
            const tmpPdfPath = path.join(os.tmpdir(), `input_thumb_${Date.now()}_${randId}.pdf`);
            const tmpOutPrefix = path.join(os.tmpdir(), `page1_thumb_${Date.now()}_${randId}`);
            fs.writeFileSync(tmpPdfPath, input);
            
            try {
                await new Promise((resolve) => {
                    exec(`pdftoppm -jpeg -scale-to 300 -f 1 -l 1 -singlefile "${tmpPdfPath}" "${tmpOutPrefix}"`, { timeout: 1500 }, (err) => {
                        resolve();
                    });
                });
                const renderedJpg = fs.existsSync(`${tmpOutPrefix}.jpg`) ? `${tmpOutPrefix}.jpg` : `${tmpOutPrefix}-1.jpg`;
                if (fs.existsSync(renderedJpg)) {
                    thumbJpgBuf = fs.readFileSync(renderedJpg);
                    try { fs.unlinkSync(renderedJpg); } catch (_) {}
                }
            } catch (errExec) {
                console.error('[PDF Assembler] pdftoppm thumbnail extraction error:', errExec.message);
            } finally {
                try { fs.unlinkSync(tmpPdfPath); } catch (_) {}
            }
        }

        if (thumbJpgBuf && finalDoc.getPageCount() > 0) {
            const thumbImage = await finalDoc.embedJpg(thumbJpgBuf);
            const firstPage = finalDoc.getPages()[0];
            firstPage.node.set(PDFName.of('Thumb'), thumbImage.ref);
            console.log('[PDF Assembler] Attached /Thumb thumbnail to Page 1.');
        }
    } catch (thumbErr) {
        console.error('[PDF Assembler] Error attaching page 1 thumbnail:', thumbErr.message);
    }
}

/**
 * Assembles and watermarks a PDF with clean extra top & bottom margin padding (zero overlap).
 * Appends 2 promo/rules pages at the end of every generated PDF.
 */
async function assembleAndWatermarkPdf(input, metadata, config = {}) {
    const { newspaperName, editionName, dateFormatted, outputPath } = metadata;
    const watermarkText = config.watermarkText || 'Social Media Pakistan 0342-4938217';
    
    // Watermark preferences: Top disabled by default, Bottom enabled by default
    const enableTopBanner = Boolean(config.enableTopBanner);
    const enableBottomBanner = config.enableBottomBanner !== false;
    const enableDiagonal = Boolean(config.enableDiagonal);
    
    const topMargin = enableTopBanner ? 40 : 0;
    const bottomMargin = enableBottomBanner ? 35 : 0;
    
    const finalDoc = await PDFDocument.create();
    const font = await finalDoc.embedFont(StandardFonts.HelveticaBold);
    
    const titleCity = editionName ? `${newspaperName} (${editionName})` : newspaperName;
    const topText = dateFormatted ? `${watermarkText}   |   ${titleCity}   |   ${dateFormatted}` : `${watermarkText}   |   ${titleCity}`;
    const bottomText = watermarkText; // Simple: "Social Media Pakistan 0342-4938217"

    if (Array.isArray(input)) {
        // Collect all valid images or any buffer with size > 10KB
        const validImages = input.filter(b => Buffer.isBuffer(b) && b.length > 5000);
        if (validImages.length === 0) {
            throw new Error(`No valid image pages to assemble for ${newspaperName} ${editionName}`);
        }

        for (let i = 0; i < validImages.length; i++) {
            let imgBuffer = validImages[i];

            let image;
            try {
                image = await finalDoc.embedJpg(imgBuffer);
            } catch (err1) {
                try {
                    image = await finalDoc.embedPng(imgBuffer);
                } catch (err2) {
                    try {
                        const jpgBuf = await sharp(imgBuffer)
                            .jpeg({ quality: 95 })
                            .toBuffer();
                        image = await finalDoc.embedJpg(jpgBuf);
                    } catch (err3) {
                        try {
                            const pngBuf = await sharp(imgBuffer)
                                .png({ compressionLevel: 0 })
                                .toBuffer();
                            image = await finalDoc.embedPng(pngBuf);
                        } catch (err4) {
                            console.error(`Error embedding image on page ${i + 1}: ${err1.message}`);
                            continue;
                        }
                    }
                }
            }
            
            const { width, height } = image.scale(1);
            const totalHeight = height + topMargin + bottomMargin;
            const newPage = finalDoc.addPage([width, totalHeight]);

            // 1. Top banner in extra space (if enabled)
            if (enableTopBanner) {
                newPage.drawRectangle({
                    x: 0,
                    y: height + bottomMargin,
                    width: width,
                    height: topMargin,
                    color: rgb(0.06, 0.09, 0.16),
                    opacity: 1
                });
                
                const topFontSize = 14;
                const topTextWidth = font.widthOfTextAtSize(topText, topFontSize);
                newPage.drawText(topText, {
                    x: (width - topTextWidth) / 2,
                    y: height + bottomMargin + (topMargin - topFontSize) / 2 + 1,
                    size: topFontSize,
                    font: font,
                    color: rgb(1, 1, 1),
                    opacity: 0.98
                });
            }

            // 2. Bottom banner in extra space
            if (enableBottomBanner) {
                newPage.drawRectangle({
                    x: 0,
                    y: 0,
                    width: width,
                    height: bottomMargin,
                    color: rgb(0.06, 0.09, 0.16),
                    opacity: 1
                });
                
                const bottomFontSize = 14;
                const bottomTextWidth = font.widthOfTextAtSize(bottomText, bottomFontSize);
                newPage.drawText(bottomText, {
                    x: (width - bottomTextWidth) / 2,
                    y: (bottomMargin - bottomFontSize) / 2 + 1,
                    size: bottomFontSize,
                    font: font,
                    color: rgb(0.98, 0.82, 0.2),
                    opacity: 0.98
                });
            }

            // 3. Draw newspaper content in middle
            newPage.drawImage(image, {
                x: 0,
                y: bottomMargin,
                width: width,
                height: height
            });

            // 4. Optional diagonal watermark
            if (enableDiagonal) {
                const diagSize = Number(config.diagonalSize) || 42;
                const diagOpacity = Number(config.diagonalOpacity) || 0.25;
                const diagColor = config.diagonalColor ? hexToRgb(config.diagonalColor) : rgb(0.85, 0.15, 0.15);
                const diagAngle = Number(config.diagonalAngle) || 35;
                
                newPage.drawText(watermarkText, {
                    x: width * 0.12,
                    y: totalHeight * 0.45,
                    size: diagSize,
                    font: font,
                    color: diagColor,
                    opacity: diagOpacity,
                    rotate: degrees(diagAngle)
                });
            }
        }
    } else {
        // CASE: Single PDF Buffer (direct PDF download or custom uploaded PDF)
        let srcPdf;
        let workingBuffer = input;
        try {
            srcPdf = await PDFDocument.load(workingBuffer, { ignoreEncryption: true });
        } catch (loadErr1) {
            console.warn('[PDF Assembler] PDFDocument.load failed, attempting qpdf repair:', loadErr1.message);
            workingBuffer = repairPdfBuffer(input);
            try {
                srcPdf = await PDFDocument.load(workingBuffer, { ignoreEncryption: true });
            } catch (loadErr2) {
                console.error('[PDF Assembler] Repair failed to fix pdf-lib parse error. Fallback saving raw PDF:', loadErr2.message);
                fs.writeFileSync(outputPath, input);
                const stats = fs.statSync(outputPath);
                let pCount = 10;
                try {
                    const outPpm = execSync(`pdfinfo "${outputPath}"`, { encoding: 'utf8' });
                    const mP = outPpm.match(/Pages:\s*(\d+)/i);
                    if (mP) pCount = parseInt(mP[1], 10);
                } catch (_) {}
                return {
                    filename: path.basename(outputPath),
                    sizeMb: (stats.size / 1024 / 1024).toFixed(2),
                    pages: pCount,
                    url: `/output/${encodeURIComponent(path.basename(outputPath))}`
                };
            }
        }
        const copiedPages = await finalDoc.copyPages(srcPdf, srcPdf.getPageIndices());
        
        for (let i = 0; i < copiedPages.length; i++) {
            const page = copiedPages[i];
            const { width, height } = page.getSize();

            // 1. Top banner in extra space (if enabled)
            if (enableTopBanner) {
                page.drawRectangle({
                    x: 0,
                    y: height - topMargin,
                    width: width,
                    height: topMargin,
                    color: rgb(0.06, 0.09, 0.16),
                    opacity: 1
                });
                
                const topFontSize = 14;
                const topTextWidth = font.widthOfTextAtSize(topText, topFontSize);
                page.drawText(topText, {
                    x: Math.max(10, (width - topTextWidth) / 2),
                    y: height - topMargin + (topMargin - topFontSize) / 2 + 1,
                    size: topFontSize,
                    font: font,
                    color: rgb(1, 1, 1),
                    opacity: 0.98
                });
            }

            // 2. Bottom banner in extra space
            if (enableBottomBanner) {
                page.drawRectangle({
                    x: 0,
                    y: 0,
                    width: width,
                    height: bottomMargin,
                    color: rgb(0.06, 0.09, 0.16),
                    opacity: 1
                });
                
                const bottomFontSize = 14;
                const bottomTextWidth = font.widthOfTextAtSize(bottomText, bottomFontSize);
                page.drawText(bottomText, {
                    x: Math.max(10, (width - bottomTextWidth) / 2),
                    y: (bottomMargin - bottomFontSize) / 2 + 1,
                    size: bottomFontSize,
                    font: font,
                    color: rgb(0.98, 0.82, 0.2),
                    opacity: 0.98
                });
            }

            // 3. Optional diagonal watermark
            if (enableDiagonal) {
                const diagSize = Number(config.diagonalSize) || 42;
                const diagOpacity = Number(config.diagonalOpacity) || 0.25;
                const diagColor = config.diagonalColor ? hexToRgb(config.diagonalColor) : rgb(0.85, 0.15, 0.15);
                const diagAngle = Number(config.diagonalAngle) || 35;
                
                page.drawText(watermarkText, {
                    x: width * 0.12,
                    y: height * 0.45,
                    size: diagSize,
                    font: font,
                    color: diagColor,
                    opacity: diagOpacity,
                    rotate: degrees(diagAngle)
                });
            }

            finalDoc.addPage(page);
        }
    }

    // ── 5. AUTOMATICALLY APPEND 2 LAST PROMO & RULES PAGES TO EVERY PDF ──
    if (config.appendPromoPages !== false) {
        const promoBufs = getPromoImages();
        for (const promoBuf of promoBufs) {
            try {
                let promoImage;
                try {
                    promoImage = await finalDoc.embedJpg(promoBuf);
                } catch (_) {
                    promoImage = await finalDoc.embedPng(promoBuf);
                }
                const { width: pW, height: pH } = promoImage.scale(1);
                const promoPage = finalDoc.addPage([pW, pH]);
                promoPage.drawImage(promoImage, {
                    x: 0,
                    y: 0,
                    width: pW,
                    height: pH
                });
            } catch (pErr) {
                console.error(`[PDF Assembler] Error appending cached promo page:`, pErr.message);
            }
        }
    }

    if (finalDoc.getPageCount() === 0) {
        throw new Error(`PDF creation failed: 0 pages generated for ${newspaperName}`);
    }

    // Attach embedded /Thumb thumbnail to Page 1 if not in fastMode/skipThumbnail
    if (!config.fastMode && !config.skipThumbnail) {
        await attachFirstPageThumbnail(finalDoc, input);
    }

    // Save without compressed object streams so WhatsApp mobile document previewers can parse it cleanly
    const finalBytes = await finalDoc.save({ useObjectStreams: false });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    // FAST DIRECT WRITE: Write final PDF synchronously to outputPath
    fs.writeFileSync(outputPath, finalBytes);

    // ASYNC BACKGROUND LINEARIZE: Run qpdf only if fastMode is not enabled
    if (!config.fastMode) {
        const tmpRawPath = outputPath + '.tmp.pdf';
        fs.writeFileSync(tmpRawPath, finalBytes);
        exec(`qpdf --linearize "${tmpRawPath}" "${outputPath}"`, (qerr) => {
            try { fs.unlinkSync(tmpRawPath); } catch (_) {}
            if (!qerr) {
                console.log(`[PDF Assembler] Background qpdf linearize completed for ${path.basename(outputPath)}`);
            }
        });
    }

    const stats = fs.statSync(outputPath);

    return {
        filename: path.basename(outputPath),
        sizeMb: (stats.size / 1024 / 1024).toFixed(2),
        pages: finalDoc.getPageCount(),
        path: outputPath
    };
}

module.exports = {
    assembleAndWatermarkPdf
};
