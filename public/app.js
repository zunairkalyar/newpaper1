document.addEventListener('DOMContentLoaded', () => {
    // Theme Switcher Logic
    const btnThemeToggle = document.getElementById('btnThemeToggle');
    const htmlElement = document.documentElement;
    
    const savedTheme = localStorage.getItem('epaper_theme') || 'light';
    setTheme(savedTheme);

    btnThemeToggle.addEventListener('click', () => {
        const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    });

    function setTheme(theme) {
        htmlElement.setAttribute('data-theme', theme);
        localStorage.setItem('epaper_theme', theme);
        btnThemeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
        btnThemeToggle.title = `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Theme`;
    }

    // DOM Elements
    const inputDate = document.getElementById('inputDate');
    const btnDateToday = document.getElementById('btnDateToday');
    const btnDateYesterday = document.getElementById('btnDateYesterday');
    
    const newspaperGrid = document.getElementById('newspaperGrid');
    const filterTabs = document.querySelectorAll('.tab-btn');
    const btnSelectAll = document.getElementById('btnSelectAll');
    const btnSelectEnglish = document.getElementById('btnSelectEnglish');
    const btnSelectUrdu = document.getElementById('btnSelectUrdu');
    const btnDeselectAll = document.getElementById('btnDeselectAll');
    
    const watermarkText = document.getElementById('watermarkText');
    const btnResetWatermark = document.getElementById('btnResetWatermark');
    const chkTopBanner = document.getElementById('chkTopBanner');
    const chkBottomBanner = document.getElementById('chkBottomBanner');
    const chkDiagonal = document.getElementById('chkDiagonal');
    
    const btnStartBatch = document.getElementById('btnStartBatch');
    const btnOpenFolder = document.getElementById('btnOpenFolder');
    const btnRefreshFiles = document.getElementById('btnRefreshFiles');
    const btnDownloadZipTop = document.getElementById('btnDownloadZipTop');
    const btnDownloadZipList = document.getElementById('btnDownloadZipList');
    const lblZipTopText = document.getElementById('lblZipTopText');
    const lblFileCount = document.getElementById('lblFileCount');
    
    const toggleDirectUrl = document.getElementById('toggleDirectUrl');
    const bodyDirectUrl = document.getElementById('bodyDirectUrl');
    const inputCustomUrl = document.getElementById('inputCustomUrl');
    const btnProcessCustomUrl = document.getElementById('btnProcessCustomUrl');
    
    const mainProgressBar = document.getElementById('mainProgressBar');
    const lblProgressPercent = document.getElementById('lblProgressPercent');
    const consoleBox = document.getElementById('consoleBox');
    const fileListContainer = document.getElementById('fileListContainer');
    
    const previewModal = document.getElementById('previewModal');
    const modalFileName = document.getElementById('modalFileName');
    const modalDownloadBtn = document.getElementById('modalDownloadBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const pdfPreviewIframe = document.getElementById('pdfPreviewIframe');

    let currentCatalog = [];

    // Date formatting helper
    function formatDateYMD(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function getFormattedDateDMY(ymdStr) {
        if (!ymdStr) return '';
        const [y, m, d] = ymdStr.split('-');
        return `${d}-${m}-${y}`;
    }

    function updateZipButtonLabels() {
        const dmy = getFormattedDateDMY(inputDate.value);
        if (lblZipTopText) lblZipTopText.textContent = `Download ZIP (${dmy})`;
        if (btnDownloadZipList) btnDownloadZipList.textContent = `📦 Download ZIP (${dmy})`;
    }

    const today = new Date();
    inputDate.value = formatDateYMD(today);
    updateZipButtonLabels();

    inputDate.addEventListener('change', () => {
        updateZipButtonLabels();
        loadFiles();
    });

    // Quick Date Buttons
    btnDateToday.addEventListener('click', () => {
        inputDate.value = formatDateYMD(new Date());
        btnDateToday.classList.add('active');
        btnDateYesterday.classList.remove('active');
        updateZipButtonLabels();
        loadFiles();
    });

    btnDateYesterday.addEventListener('click', () => {
        const yest = new Date();
        yest.setDate(yest.getDate() - 1);
        inputDate.value = formatDateYMD(yest);
        btnDateYesterday.classList.add('active');
        btnDateToday.classList.remove('active');
        updateZipButtonLabels();
        loadFiles();
    });

    // Load Catalog & Render Checkboxes
    async function loadCatalog() {
        try {
            const res = await fetch('/api/catalog');
            const data = await res.json();
            if (data.success && data.catalog) {
                currentCatalog = data.catalog;
                renderNewspaperGrid('all');
            }
        } catch (err) {
            console.error('Failed to load catalog:', err);
        }
    }

    function renderNewspaperGrid(activeFilter) {
        newspaperGrid.innerHTML = '';
        currentCatalog.forEach(paper => {
            const isHidden = (activeFilter !== 'all' && paper.category !== activeFilter);
            const card = document.createElement('label');
            card.className = `edition-card paper-item ${paper.category}`;
            if (isHidden) card.style.display = 'none';

            // Default selection: The News, Jang, Pak Observer, Lead Pakistan
            const isDefaultChecked = paper.id.includes('thenews') || paper.id.includes('jang') || paper.id === 'pak_observer' || paper.id === 'lead_pakistan';

            card.innerHTML = `
                <input type="checkbox" name="paper_selection" value="${paper.id}" ${isDefaultChecked ? 'checked' : ''}>
                <div class="edition-content">
                    <span class="edition-city">${paper.name}</span>
                    <span class="edition-tag">${paper.category.toUpperCase()}</span>
                </div>
                <div class="check-indicator">✓</div>
            `;
            newspaperGrid.appendChild(card);
        });
    }

    // Filter tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filter = tab.getAttribute('data-filter');
            
            document.querySelectorAll('.paper-item').forEach(el => {
                if (filter === 'all' || el.classList.contains(filter)) {
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'none';
                }
            });
        });
    });

    // Selection buttons
    btnSelectAll.addEventListener('click', () => {
        document.querySelectorAll('input[name="paper_selection"]').forEach(cb => cb.checked = true);
    });

    btnSelectEnglish.addEventListener('click', () => {
        document.querySelectorAll('.paper-item').forEach(item => {
            const cb = item.querySelector('input');
            cb.checked = item.classList.contains('english');
        });
    });

    btnSelectUrdu.addEventListener('click', () => {
        document.querySelectorAll('.paper-item').forEach(item => {
            const cb = item.querySelector('input');
            cb.checked = item.classList.contains('urdu');
        });
    });

    btnDeselectAll.addEventListener('click', () => {
        document.querySelectorAll('input[name="paper_selection"]').forEach(cb => cb.checked = false);
    });

    // Reset Branding
    btnResetWatermark.addEventListener('click', () => {
        watermarkText.value = 'Social Media Pakistan 0342-4938217';
        chkTopBanner.checked = true;
        chkBottomBanner.checked = true;
        chkDiagonal.checked = false;
        showToast('Branding reset to clean margin defaults');
    });

    // Toggle Direct URL
    toggleDirectUrl.addEventListener('click', () => {
        const isHidden = bodyDirectUrl.style.display === 'none';
        bodyDirectUrl.style.display = isHidden ? 'block' : 'none';
        toggleDirectUrl.querySelector('.toggle-icon').textContent = isHidden ? '▲' : '▼';
    });

    // Toast Notification System
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠️'}</span> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Play Gentle Completion Chime
    function playChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (_) {}
    }

    // Console Logging Helper
    function appendLog(msg, type = 'info') {
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        const time = new Date().toLocaleTimeString();
        line.textContent = `[${time}] ${msg}`;
        consoleBox.appendChild(line);
        consoleBox.scrollTop = consoleBox.scrollHeight;
    }

    function setProgress(percent) {
        mainProgressBar.style.width = `${percent}%`;
        lblProgressPercent.textContent = `${percent}%`;
    }

    // Date-Filtered ZIP Download Trigger
    function triggerZipDownload() {
        const selectedDate = inputDate.value;
        const dmy = getFormattedDateDMY(selectedDate);
        const url = `/api/download-zip?date=${encodeURIComponent(dmy)}`;
        showToast(`Packaging all newspapers for ${dmy} into ZIP archive... 📦`);
        window.location.href = url;
    }

    btnDownloadZipTop.addEventListener('click', triggerZipDownload);
    btnDownloadZipList.addEventListener('click', triggerZipDownload);

    // Fetch and Render Generated Files List
    async function loadFiles() {
        try {
            const res = await fetch('/api/files');
            const data = await res.json();
            
            if (!data.success || !data.files || data.files.length === 0) {
                fileListContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📁</div>
                        <h4>No PDFs in Output Folder</h4>
                        <p>Processed newspapers will appear here ready to share to your WhatsApp group.</p>
                    </div>
                `;
                if (lblFileCount) lblFileCount.textContent = '0';
                return;
            }

            if (lblFileCount) lblFileCount.textContent = String(data.files.length);
            fileListContainer.innerHTML = '';
            
            data.files.forEach(f => {
                const item = document.createElement('div');
                item.className = 'file-item';
                
                const dateCreated = new Date(f.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                item.innerHTML = `
                    <div class="file-info">
                        <div class="file-icon">PDF</div>
                        <div class="file-meta">
                            <h4>${escapeHtml(f.name)}</h4>
                            <div class="file-tags">
                                <span class="file-tag">${f.sizeMb} MB</span>
                                <span class="file-tag">${dateCreated}</span>
                                <span class="file-tag" style="color: #059669; font-weight: 600;">✓ Clean Margins</span>
                            </div>
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="btn btn-sm btn-outline btn-copy-caption" data-filename="${escapeHtml(f.name)}" title="Copy formatted text for WhatsApp">
                            📋 Caption
                        </button>
                        <button class="btn btn-sm btn-secondary btn-preview" data-url="${f.url}" data-name="${escapeHtml(f.name)}" title="Preview PDF">
                            👁️ View
                        </button>
                        <a href="${f.url}" class="btn btn-sm btn-primary" download="${escapeHtml(f.name)}" title="Download to PC">
                            📥 Download
                        </a>
                        <button class="btn btn-sm btn-outline btn-delete" data-filename="${escapeHtml(f.name)}" title="Delete" style="color:#ef4444;">
                            🗑️
                        </button>
                    </div>
                `;
                fileListContainer.appendChild(item);
            });

            attachFileActionListeners();
        } catch (err) {
            console.error('Failed to load files:', err);
        }
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function attachFileActionListeners() {
        // Preview button
        document.querySelectorAll('.btn-preview').forEach(btn => {
            btn.onclick = () => {
                const url = btn.getAttribute('data-url');
                const name = btn.getAttribute('data-name');
                modalFileName.textContent = name;
                modalDownloadBtn.href = url;
                modalDownloadBtn.setAttribute('download', name);
                pdfPreviewIframe.src = url;
                previewModal.classList.add('active');
            };
        });

        // Copy WhatsApp Caption
        document.querySelectorAll('.btn-copy-caption').forEach(btn => {
            btn.onclick = () => {
                const filename = btn.getAttribute('data-filename');
                const brand = watermarkText.value || 'Social Media Pakistan 0342-4938217';
                const caption = `📰 *${filename.replace('.pdf', '')}*\n📌 *Service by:* ${brand}\n✨ *Complete Daily E-Paper Edition*\n📲 Join our exclusive WhatsApp Group for daily PDF delivery!`;
                
                navigator.clipboard.writeText(caption).then(() => {
                    showToast('WhatsApp caption copied to clipboard! 📋');
                });
            };
        });

        // Delete button
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = async () => {
                const filename = btn.getAttribute('data-filename');
                if (confirm(`Are you sure you want to delete "${filename}"?`)) {
                    try {
                        const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
                        const data = await res.json();
                        if (data.success) {
                            showToast(`Deleted ${filename}`);
                            loadFiles();
                        }
                    } catch (e) {
                        showToast('Failed to delete file', 'error');
                    }
                }
            };
        });
    }

    // Modal Close
    modalCloseBtn.onclick = () => {
        previewModal.classList.remove('active');
        pdfPreviewIframe.src = '';
    };

    previewModal.onclick = (e) => {
        if (e.target === previewModal) {
            previewModal.classList.remove('active');
            pdfPreviewIframe.src = '';
        }
    };

    // Open Output Folder in Windows Explorer
    btnOpenFolder.addEventListener('click', async () => {
        try {
            await fetch('/api/open-folder', { method: 'POST' });
            showToast('Opened Output Folder in Windows Explorer 📂');
        } catch (e) {
            showToast('Could not open folder', 'error');
        }
    });

    btnRefreshFiles.addEventListener('click', () => {
        loadFiles();
        showToast('File list updated');
    });

    // Start Batch Download & Watermark
    btnStartBatch.addEventListener('click', async () => {
        const selectedDate = inputDate.value;
        const dmy = getFormattedDateDMY(selectedDate);
        const selectedIds = Array.from(document.querySelectorAll('input[name="paper_selection"]:checked'))
            .map(cb => cb.value);

        if (selectedIds.length === 0) {
            showToast('Please select at least one newspaper to process', 'error');
            return;
        }

        const watermarkConfig = {
            watermarkText: watermarkText.value.trim() || 'Social Media Pakistan 0342-4938217',
            enableTopBanner: chkTopBanner.checked,
            enableBottomBanner: chkBottomBanner.checked,
            enableDiagonal: chkDiagonal.checked
        };

        btnStartBatch.disabled = true;
        btnStartBatch.innerHTML = `<span class="btn-icon">⏳</span><span>Processing ${selectedIds.length} Newspaper(s)...</span>`;
        setProgress(5);
        appendLog(`Initiating batch download for date: ${dmy} (${selectedIds.length} publications)...`, 'info');

        try {
            const response = await fetch('/api/process-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    selectedIds: selectedIds,
                    config: watermarkConfig
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.message) {
                                appendLog(data.message, data.type || 'info');
                            }
                            if (data.progress !== null && data.progress !== undefined) {
                                setProgress(data.progress);
                            }
                            if (data.type === 'COMPLETE') {
                                playChime();
                                showToast(`All ${dmy} newspapers ready! Click ZIP to download archive 🎉`, 'success');
                                loadFiles();
                            }
                        } catch (e) {}
                    }
                }
            }
        } catch (err) {
            appendLog(`Execution error: ${err.message}`, 'error');
            showToast(`Error: ${err.message}`, 'error');
        } finally {
            btnStartBatch.disabled = false;
            btnStartBatch.innerHTML = `<span class="btn-icon">⚡</span><span>Download & Process Selected (1-Click)</span>`;
            loadFiles();
        }
    });

    // Single Custom URL Processing
    btnProcessCustomUrl.addEventListener('click', async () => {
        const url = inputCustomUrl.value.trim();
        if (!url) {
            showToast('Please enter an e-paper URL', 'error');
            return;
        }

        showToast(`Processing URL: ${url}`);
        btnStartBatch.click();
    });

    // Initial Load
    loadCatalog();
    loadFiles();
});
