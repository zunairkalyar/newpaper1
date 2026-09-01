const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

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

/**
 * Assembles and watermarks a PDF with clean extra top & bottom margin padding (zero overlap).
 */
async function assembleAndWatermarkPdf(input, metadata, config = {}) {
    const { newspaperName, editionName, dateFormatted, outputPath } = metadata;
    const watermarkText = config.watermarkText || 'Social Media Pakistan 0342-4938217';
    
    const enableTopBanner = config.enableTopBanner !== false;
    const enableBottomBanner = config.enableBottomBanner !== false;
    const enableDiagonal = Boolean(config.enableDiagonal);
    
    const topMargin = enableTopBanner ? 40 : 0;
    const bottomMargin = enableBottomBanner ? 35 : 0;
    
    const finalDoc = await PDFDocument.create();
    const font = await finalDoc.embedFont(StandardFonts.HelveticaBold);
    
    const titleCity = editionName ? `${newspaperName} (${editionName})` : newspaperName;
    const topText = `${watermarkText}   |   ${titleCity}   |   ${dateFormatted}`;
    const bottomText = `WhatsApp Group: ${watermarkText}  -  Daily Newspaper PDF Service`;

    if (Array.isArray(input)) {
        // Collect all valid images or any buffer with size > 10KB
        const validImages = input.filter(b => Buffer.isBuffer(b) && b.length > 5000);
        if (validImages.length === 0) {
            throw new Error(`No valid image pages to assemble for ${newspaperName} ${editionName}`);
        }

        for (let i = 0; i < validImages.length; i++) {
            const imgBuffer = validImages[i];
            let image;
            try {
                image = await finalDoc.embedJpg(imgBuffer);
            } catch (err1) {
                try {
                    image = await finalDoc.embedPng(imgBuffer);
                } catch (err2) {
                    console.error(`Error embedding image on page ${i + 1}: ${err1.message}`);
                    continue;
                }
            }
            
            const { width, height } = image.scale(1);
            const totalHeight = height + topMargin + bottomMargin;
            const newPage = finalDoc.addPage([width, totalHeight]);

            // 1. Top banner in extra space
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
                
                const bottomFontSize = 13;
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
        // CASE: Single PDF Buffer (direct PDF download)
        const srcPdf = await PDFDocument.load(input);
        const embeddedPages = await finalDoc.embedPages(srcPdf.getPages());
        
        for (let i = 0; i < embeddedPages.length; i++) {
            const embPage = embeddedPages[i];
            const { width, height } = embPage;
            const totalHeight = height + topMargin + bottomMargin;
            const newPage = finalDoc.addPage([width, totalHeight]);

            // 1. Top banner in extra space
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
                
                const bottomFontSize = 13;
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

            // 3. Draw embedded page in middle
            newPage.drawPage(embPage, {
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
    }

    if (finalDoc.getPageCount() === 0) {
        throw new Error(`PDF creation failed: 0 pages generated for ${newspaperName}`);
    }

    const finalBytes = await finalDoc.save();
    fs.writeFileSync(outputPath, finalBytes);
    
    return {
        filename: path.basename(outputPath),
        sizeMb: (finalBytes.length / 1024 / 1024).toFixed(2),
        pages: finalDoc.getPageCount(),
        path: outputPath
    };
}

module.exports = {
    assembleAndWatermarkPdf
};
