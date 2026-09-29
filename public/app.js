// ============================================================================
// PAKISTAN E-PAPER MASTER — MODERN DASHBOARD CONTROLLER
// Full sidebar routing, 38 newspaper master table, live SSE batch progress,
// dedicated Free Magazines hub, date folder archive & deletion management.
// ============================================================================

(function () {
    'use strict';

    // ── EXACT PAGE COUNT PRESETS ─────────────────────────────────────────────
    function getEstimatedPageCount(paperId) {
        const id = (paperId || '').toLowerCase();
        if (id === 'dawn_editorials') return '9';
        if (id.includes('dawn')) return '28-53';
        if (id.includes('thenews')) return '18-52';
        if (id.includes('nation')) return '16';
        if (id.includes('dailytimes')) return '12';
        if (id.includes('brecorder')) return '10';
        if (id.includes('leadpakistan')) return '8';
        if (id.includes('92news')) return '8';
        if (id.includes('balochistan')) return '8';
        if (id.includes('juraat')) return '8';
        if (id.includes('express_tribune')) return '16';
        if (id.includes('naibaat')) return '16';
        if (id.includes('pak_observer')) return '16';
        if (id.includes('ausaf')) return '12';
        if (id.includes('dailyaaj')) return '10';
        if (id === 'jasarat_isb') return '4';
        if (id === 'jasarat_hyd') return '8';
        if (id === 'jasarat_khi') return '8-16';
        if (id.includes('jobz')) return '35-42 Ads';
        if (id.includes('dak')) return '8';
        if (id.includes('ibrat')) return '8';
        if (id.includes('frontierpost')) return '8';
        if (id.includes('pktoday')) return '8';
        return '12';
    }

    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // ── COMPLETE 38-NEWSPAPER FRONTEND CATALOG ───────────────────────────────
        const NEWSPAPER_CATALOG = [
        // 1. English Broadsheets (17)
        { id: 'brecorder', name: 'Business Recorder National', category: 'english', station: 'National', language: 'ENGLISH' },
        { id: 'dawn_khi', name: 'Dawn Karachi', category: 'english', station: 'Karachi', language: 'ENGLISH' },
        { id: 'dawn_editorials', name: 'Dawn Editorials', category: 'english', station: 'National', language: 'ENGLISH' },
        { id: 'nation_lhr', name: 'The Nation Lahore', category: 'english', station: 'Lahore', language: 'ENGLISH' },
        { id: 'nation_isb', name: 'The Nation Islamabad', category: 'english', station: 'Islamabad', language: 'ENGLISH' },
        { id: 'nation_khi', name: 'The Nation Karachi', category: 'english', station: 'Karachi', language: 'ENGLISH' },
        { id: 'nation_qta', name: 'The Nation Quetta', category: 'english', station: 'Quetta', language: 'ENGLISH' },
        { id: 'thenews_khi', name: 'The News Karachi', category: 'english', station: 'Karachi', language: 'ENGLISH' },
        { id: 'thenews_lhr', name: 'The News Lahore', category: 'english', station: 'Lahore', language: 'ENGLISH' },
        { id: 'thenews_isb', name: 'The News Islamabad / Rawalpindi', category: 'english', station: 'Islamabad', language: 'ENGLISH' },
        { id: 'leadpakistan_nat', name: 'Daily Lead Pakistan National', category: 'english', station: 'National', language: 'ENGLISH' },
        { id: 'pak_observer_isb', name: 'Pakistan Observer Islamabad', category: 'english', station: 'Islamabad', language: 'ENGLISH' },
        { id: 'pak_observer_lhr', name: 'Pakistan Observer Lahore', category: 'english', station: 'Lahore', language: 'ENGLISH' },
        { id: 'pak_observer_khi', name: 'Pakistan Observer Karachi', category: 'english', station: 'Karachi', language: 'ENGLISH' },
        { id: 'balochistan_qta', name: 'Balochistan Times Quetta', category: 'english', station: 'Quetta', language: 'ENGLISH' },
        { id: 'balochistan_isb', name: 'Balochistan Times Islamabad', category: 'english', station: 'Islamabad', language: 'ENGLISH' },
        { id: 'balochistan_khi', name: 'Balochistan Times Karachi', category: 'english', station: 'Karachi', language: 'ENGLISH' },
        { id: 'express_tribune', name: 'The Express Tribune National', category: 'english', station: 'National', language: 'ENGLISH' },

        // 2. Urdu Broadsheets (24)
        { id: '92news_isb', name: 'Roznama 92 News Islamabad', category: 'urdu', station: 'Islamabad', language: 'URDU' },
        { id: '92news_lhr', name: 'Roznama 92 News Lahore', category: 'urdu', station: 'Lahore', language: 'URDU' },
        { id: '92news_khi', name: 'Roznama 92 News Karachi', category: 'urdu', station: 'Karachi', language: 'URDU' },
        { id: 'juraat_khi', name: 'Daily Juraat Karachi', category: 'urdu', station: 'Karachi', language: 'URDU' },
        { id: 'ausaf_isb', name: 'Daily Ausaf Islamabad', category: 'urdu', station: 'Islamabad', language: 'URDU' },
        { id: 'ausaf_lhr', name: 'Daily Ausaf Lahore', category: 'urdu', station: 'Lahore', language: 'URDU' },
        { id: 'ausaf_khi', name: 'Daily Ausaf Karachi', category: 'urdu', station: 'Karachi', language: 'URDU' },
        { id: 'ausaf_mzd', name: 'Daily Ausaf Muzaffarabad / Kashmir', category: 'urdu', station: 'Muzaffarabad', language: 'URDU' },
        { id: 'ausaf_pesh', name: 'Daily Ausaf Peshawar', category: 'urdu', station: 'Peshawar', language: 'URDU' },
        { id: 'ausaf_glt', name: 'Daily Ausaf Gilgit Baltistan', category: 'urdu', station: 'Gilgit', language: 'URDU' },
        { id: 'ausaf_eur', name: 'Daily Ausaf Europe', category: 'urdu', station: 'Europe', language: 'URDU' },
        { id: 'dailyaaj_pesh', name: 'Daily Aaj Peshawar', category: 'urdu', station: 'Peshawar', language: 'URDU' },
        { id: 'dailyaaj_atd', name: 'Daily Aaj Abbottabad', category: 'urdu', station: 'Abbottabad', language: 'URDU' },
        { id: 'naibaat_lhr', name: 'Nai Baat Lahore', category: 'urdu', station: 'Lahore', language: 'URDU' },
        { id: 'naibaat_isb', name: 'Nai Baat Islamabad', category: 'urdu', station: 'Islamabad', language: 'URDU' },
        { id: 'naibaat_khi', name: 'Nai Baat Karachi', category: 'urdu', station: 'Karachi', language: 'URDU' },
        { id: 'naibaat_pesh', name: 'Nai Baat Peshawar', category: 'urdu', station: 'Peshawar', language: 'URDU' },
        { id: 'naibaat_qta', name: 'Nai Baat Quetta', category: 'urdu', station: 'Quetta', language: 'URDU' },
        { id: 'naibaat_sgd', name: 'Nai Baat Sargodha', category: 'urdu', station: 'Sargodha', language: 'URDU' },
        { id: 'naibaat_fsd', name: 'Nai Baat Faisalabad', category: 'urdu', station: 'Faisalabad', language: 'URDU' },
        { id: 'jasarat_khi', name: 'Daily Jasarat Karachi', category: 'urdu', station: 'Karachi', language: 'URDU' },
        { id: 'jasarat_isb', name: 'Daily Jasarat Islamabad', category: 'urdu', station: 'Islamabad', language: 'URDU' },
        { id: 'jasarat_hyd', name: 'Daily Jasarat Hyderabad', category: 'urdu', station: 'Hyderabad', language: 'URDU' },

        // 3. Classified / Jobs (1)
        { id: 'jobz_pk', name: 'Jobz.pk - Daily Job Ads', category: 'jobs', station: 'National', language: 'CLASSIFIEDS', website: 'https://www.jobz.pk' },

        // 4. Direct PDF & e-Paper Editions (6)
        { id: 'dailydak_gujrat', name: 'Daily Dak Gujrat', category: 'urdu', station: 'Gujrat', language: 'URDU', website: 'https://dailydak.pk' },
        { id: 'ibrat_hyd', name: 'Daily Ibrat Hyderabad', category: 'regional', station: 'Hyderabad', language: 'SINDHI', website: 'https://dailyibrat.com' },
        { id: 'frontierpost_pesh', name: 'The Frontier Post Peshawar', category: 'english', station: 'Peshawar', language: 'ENGLISH', website: 'https://thefrontierpost.com' },
        { id: 'pktoday_isb', name: 'Pakistan Today Islamabad', category: 'english', station: 'Islamabad', language: 'ENGLISH', website: 'https://issuu.com/pakistantoday-paperazzi' },
        { id: 'pktoday_lhr', name: 'Pakistan Today Lahore', category: 'english', station: 'Lahore', language: 'ENGLISH', website: 'https://issuu.com/pakistantoday-paperazzi' },
        { id: 'pktoday_khi', name: 'Pakistan Today Karachi', category: 'english', station: 'Karachi', language: 'ENGLISH', website: 'https://issuu.com/pakistantoday-paperazzi' },
        { id: 'dailytimes_nat', name: 'Daily Times National', category: 'english', station: 'National', language: 'ENGLISH', website: 'https://dailytimes.com.pk/e-paper/' }
    ];

    // ── KHALIK SECTION FRONTEND CATALOG (57 Editions) ────────────────────────
    const KHALIK_NEWSPAPER_CATALOG = [
        // 0a. Roznama 92 Columns (Editorial)
        { id: 'khalik_92_columns', name: 'Roznama 92 Columns (Editorial)', category: 'khalik', network: 'Roznama 92', station: 'Lahore', language: 'URDU' },

        // 0b. Express Columns (Editorial)
        { id: 'khalik_express_columns', name: 'Express Columns (Editorial)', category: 'khalik', network: 'Express Columns', station: 'Islamabad', language: 'URDU' },

        // 0c. Roznama Dunya Columns (Editorial)
        { id: 'khalik_dunya_columns', name: 'Roznama Dunya Columns (Editorial)', category: 'khalik', network: 'Roznama Dunya', station: 'Lahore', language: 'URDU' },

        // 1. Daily Express (11 Editions)
        { id: 'khalik_express_lhr', name: 'Daily Express Lahore', category: 'khalik', network: 'Express', station: 'Lahore', language: 'URDU' },
        { id: 'khalik_express_khi', name: 'Daily Express Karachi', category: 'khalik', network: 'Express', station: 'Karachi', language: 'URDU' },
        { id: 'khalik_express_isb', name: 'Daily Express Islamabad / Rawalpindi', category: 'khalik', network: 'Express', station: 'Islamabad', language: 'URDU' },
        { id: 'khalik_express_fsb', name: 'Daily Express Faisalabad', category: 'khalik', network: 'Express', station: 'Faisalabad', language: 'URDU' },
        { id: 'khalik_express_grw', name: 'Daily Express Gujranwala', category: 'khalik', network: 'Express', station: 'Gujranwala', language: 'URDU' },
        { id: 'khalik_express_mux', name: 'Daily Express Multan', category: 'khalik', network: 'Express', station: 'Multan', language: 'URDU' },
        { id: 'khalik_express_pew', name: 'Daily Express Peshawar', category: 'khalik', network: 'Express', station: 'Peshawar', language: 'URDU' },
        { id: 'khalik_express_ryk', name: 'Daily Express Rahim Yar Khan', category: 'khalik', network: 'Express', station: 'Rahim Yar Khan', language: 'URDU' },
        { id: 'khalik_express_sgd', name: 'Daily Express Sargodha', category: 'khalik', network: 'Express', station: 'Sargodha', language: 'URDU' },
        { id: 'khalik_express_suk', name: 'Daily Express Sukkur', category: 'khalik', network: 'Express', station: 'Sukkur', language: 'URDU' },
        { id: 'khalik_express_qta', name: 'Daily Express Quetta', category: 'khalik', network: 'Express', station: 'Quetta', language: 'URDU' },

        // 2. Jehan Pakistan (5 Editions)
        { id: 'khalik_jehan_lhr', name: 'Jehan Pakistan Lahore', category: 'khalik', network: 'Jehan Pakistan', station: 'Lahore', language: 'URDU' },
        { id: 'khalik_jehan_khi', name: 'Jehan Pakistan Karachi', category: 'khalik', network: 'Jehan Pakistan', station: 'Karachi', language: 'URDU' },
        { id: 'khalik_jehan_isb', name: 'Jehan Pakistan Islamabad', category: 'khalik', network: 'Jehan Pakistan', station: 'Islamabad', language: 'URDU' },
        { id: 'khalik_jehan_mux', name: 'Jehan Pakistan Multan', category: 'khalik', network: 'Jehan Pakistan', station: 'Multan', language: 'URDU' },
        { id: 'khalik_jehan_grw', name: 'Jehan Pakistan Gujranwala', category: 'khalik', network: 'Jehan Pakistan', station: 'Gujranwala', language: 'URDU' },

        // 3. Daily Pakistan (.com.pk - 5 Editions)
        { id: 'khalik_dpcom_lhr', name: 'Daily Pakistan Lahore (.com.pk)', category: 'khalik', network: 'Daily Pakistan (com.pk)', station: 'Lahore', language: 'URDU' },
        { id: 'khalik_dpcom_rwp', name: 'Daily Pakistan Rawalpindi (.com.pk)', category: 'khalik', network: 'Daily Pakistan (com.pk)', station: 'Rawalpindi', language: 'URDU' },
        { id: 'khalik_dpcom_khi', name: 'Daily Pakistan Karachi (.com.pk)', category: 'khalik', network: 'Daily Pakistan (com.pk)', station: 'Karachi', language: 'URDU' },
        { id: 'khalik_dpcom_pew', name: 'Daily Pakistan Peshawar (.com.pk)', category: 'khalik', network: 'Daily Pakistan (com.pk)', station: 'Peshawar', language: 'URDU' },
        { id: 'khalik_dpcom_mux', name: 'Daily Pakistan Multan (.com.pk)', category: 'khalik', network: 'Daily Pakistan (com.pk)', station: 'Multan', language: 'URDU' },

        // 4. Daily Pakistan (.pk - 9 Editions)
        { id: 'khalik_dppk_isb', name: 'Daily Pakistan Islamabad (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Islamabad', language: 'URDU' },
        { id: 'khalik_dppk_rwp', name: 'Daily Pakistan Rawalpindi (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Rawalpindi', language: 'URDU' },
        { id: 'khalik_dppk_lhr', name: 'Daily Pakistan Lahore (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Lahore', language: 'URDU' },
        { id: 'khalik_dppk_mux', name: 'Daily Pakistan Multan (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Multan', language: 'URDU' },
        { id: 'khalik_dppk_mzd', name: 'Daily Pakistan Muzaffarabad (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Muzaffarabad', language: 'URDU' },
        { id: 'khalik_dppk_qta', name: 'Daily Pakistan Quetta (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Quetta', language: 'URDU' },
        { id: 'khalik_dppk_pew', name: 'Daily Pakistan Peshawar (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Peshawar', language: 'URDU' },
        { id: 'khalik_dppk_fsd', name: 'Daily Pakistan Faisalabad (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Faisalabad', language: 'URDU' },
        { id: 'khalik_dppk_grw', name: 'Daily Pakistan Gujranwala (.pk)', category: 'khalik', network: 'Daily Pakistan (pk)', station: 'Gujranwala', language: 'URDU' },

        // 5. Daily Jinnah (5 Editions)
        { id: 'khalik_jinnah_lhr', name: 'Daily Jinnah Lahore', category: 'khalik', network: 'Daily Jinnah', station: 'Lahore', language: 'URDU' },
        { id: 'khalik_jinnah_isb', name: 'Daily Jinnah Islamabad', category: 'khalik', network: 'Daily Jinnah', station: 'Islamabad', language: 'URDU' },
        { id: 'khalik_jinnah_khi', name: 'Daily Jinnah Karachi', category: 'khalik', network: 'Daily Jinnah', station: 'Karachi', language: 'URDU' },
        { id: 'khalik_jinnah_kpk', name: 'Daily Jinnah KPK / Peshawar', category: 'khalik', network: 'Daily Jinnah', station: 'Peshawar', language: 'URDU' },
        { id: 'khalik_jinnah_mzd', name: 'Daily Jinnah Kashmir / Muzaffarabad', category: 'khalik', network: 'Daily Jinnah', station: 'Muzaffarabad', language: 'URDU' },

        // 6. Roznama Sahafat (5 Editions)
        { id: 'khalik_sahafat_isb', name: 'Roznama Sahafat Islamabad', category: 'khalik', network: 'Sahafat', station: 'Islamabad', language: 'URDU' },
        { id: 'khalik_sahafat_lhr', name: 'Roznama Sahafat Lahore', category: 'khalik', network: 'Sahafat', station: 'Lahore', language: 'URDU' },
        { id: 'khalik_sahafat_khi', name: 'Roznama Sahafat Karachi', category: 'khalik', network: 'Sahafat', station: 'Karachi', language: 'URDU' },
        { id: 'khalik_sahafat_pew', name: 'Roznama Sahafat Peshawar', category: 'khalik', network: 'Sahafat', station: 'Peshawar', language: 'URDU' },
        { id: 'khalik_sahafat_mzd', name: 'Roznama Sahafat Muzaffarabad', category: 'khalik', network: 'Sahafat', station: 'Muzaffarabad', language: 'URDU' },

        // 7. Daily K2 (4 Editions)
        { id: 'khalik_k2_gb', name: 'Daily K2 Gilgit-Baltistan', category: 'khalik', network: 'Daily K2', station: 'Gilgit-Baltistan', language: 'URDU' },
        { id: 'khalik_k2_isb', name: 'Daily K2 Islamabad', category: 'khalik', network: 'Daily K2', station: 'Islamabad', language: 'URDU' },
        { id: 'khalik_k2_khi', name: 'Daily K2 Karachi', category: 'khalik', network: 'Daily K2', station: 'Karachi', language: 'URDU' },
        { id: 'khalik_k2_lhr', name: 'Daily K2 Lahore', category: 'khalik', network: 'Daily K2', station: 'Lahore', language: 'URDU' },

        // 8. Daily Jang (5 Editions)
        { id: 'khalik_jang_khi', name: 'Daily Jang Karachi', category: 'khalik', network: 'Daily Jang', station: 'Karachi', language: 'URDU' },
        { id: 'khalik_jang_lhr', name: 'Daily Jang Lahore', category: 'khalik', network: 'Daily Jang', station: 'Lahore', language: 'URDU' },
        { id: 'khalik_jang_isb', name: 'Daily Jang Rawalpindi / Islamabad', category: 'khalik', network: 'Daily Jang', station: 'Islamabad', language: 'URDU' },
        { id: 'khalik_jang_qta', name: 'Daily Jang Quetta', category: 'khalik', network: 'Daily Jang', station: 'Quetta', language: 'URDU' },
        { id: 'khalik_jang_mux', name: 'Daily Jang Multan', category: 'khalik', network: 'Daily Jang', station: 'Multan', language: 'URDU' },

        // 9. Roznama Dunya (6 Editions)
        { id: 'khalik_dunya_lhr', name: 'Roznama Dunya Lahore', category: 'khalik', network: 'Roznama Dunya', station: 'Lahore', language: 'URDU' },
        { id: 'khalik_dunya_khi', name: 'Roznama Dunya Karachi', category: 'khalik', network: 'Roznama Dunya', station: 'Karachi', language: 'URDU' },
        { id: 'khalik_dunya_isb', name: 'Roznama Dunya Islamabad', category: 'khalik', network: 'Roznama Dunya', station: 'Islamabad', language: 'URDU' },
        { id: 'khalik_dunya_fsd', name: 'Roznama Dunya Faisalabad', category: 'khalik', network: 'Roznama Dunya', station: 'Faisalabad', language: 'URDU' },
        { id: 'khalik_dunya_grw', name: 'Roznama Dunya Gujranwala', category: 'khalik', network: 'Roznama Dunya', station: 'Gujranwala', language: 'URDU' },
        { id: 'khalik_dunya_mux', name: 'Roznama Dunya Multan', category: 'khalik', network: 'Roznama Dunya', station: 'Multan', language: 'URDU' }
    ];

    // Global State
    let currentCategoryFilter = 'all';
    let currentSelectedDate = new Date();
    let generatedFilesList = [];
    let isBatchRunning = false;
    // Track dynamic processing state per newspaper ID:
    // { status: 'ready'|'downloading'|'completed'|'failed', progress: 0..100, pages: 0, sizeMb: '0.00', fileUrl: '' }
    const paperStateMap = new Map();

    // ── HELPERS: DATE FORMATTING ─────────────────────────────────────────────
    function formatDateYMD(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDateDMY(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${day}-${month}-${year}`;
    }

    function getSelectedDateObj() {
        const input = document.getElementById('inputDate');
        let d = currentSelectedDate;
        if (input && input.value) {
            const parts = input.value.split('-');
            if (parts.length === 3) {
                d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            }
        }
        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const monthShort = MONTHS_SHORT[month - 1];
        return {
            day,
            month,
            year,
            formatted: formatDateDMY(d),
            rawDate: formatDateYMD(d),
            fileDate: `${day} ${monthShort}`
        };
    }

    // ── TOAST NOTIFICATIONS ──────────────────────────────────────────────────
    function showToast(msg, type = 'info') {
        const container = document.getElementById('toastContainer') || document.body;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = 'color:#fff; padding:12px 20px; border-radius:8px; font-weight:700; font-size:13px; box-shadow:0 10px 25px rgba(0,0,0,0.25); animation:fadeIn 0.2s ease-in-out; display:flex; align-items:center; gap:8px;';
        if (type === 'success') {
            toast.style.backgroundColor = '#059669';
            toast.innerHTML = `<span>✓</span> <span>${msg}</span>`;
        } else if (type === 'error') {
            toast.style.backgroundColor = '#dc2626';
            toast.innerHTML = `<span>⚠️</span> <span>${msg}</span>`;
        } else {
            toast.style.backgroundColor = '#0f172a';
            toast.innerHTML = `<span>ℹ️</span> <span>${msg}</span>`;
        }
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ── TAB SWITCHING ROUTER ─────────────────────────────────────────────────
    function switchTab(tabId) {
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        const targetPane = document.getElementById(tabId);
        if (targetPane) targetPane.classList.add('active');

        const activeNav = document.querySelector(`.sidebar-nav a[data-tab="${tabId}"]`);
        if (activeNav) activeNav.classList.add('active');

        if (tabId === 'tab-files') {
            fetchFiles();
        } else if (tabId === 'tab-branding') {
            drawBroadsheetMockup();
        } else if (tabId === 'tab-magazines') {
            initMagazinesSection();
        } else if (tabId === 'tab-foreignpaper') {
            initForeignPaperSection();
        } else if (tabId === 'tab-khalik') {
            renderKhalikTable();
        } else if (tabId === 'tab-passport-photo') {
            initPassportPhotoSection();
        } else if (tabId === 'tab-arab') {
            initArabSection();
        } else if (tabId === 'tab-indianpaper') {
            initIndianPaperSection();
        }
    }

    // ── MASTER NEWSPAPER TABLE RENDERER ──────────────────────────────────────
    function renderNewspaperTable() {
        const tbody = document.getElementById('tableBodyNewspapers');
        if (!tbody) return;

        const dObj = getSelectedDateObj();
        const dateFormatted = dObj.formatted;
        const fileDatePrefix = dObj.fileDate.toLowerCase();
        const rawDatePrefix = dObj.rawDate.toLowerCase();
        const dmyDatePrefix = dObj.formatted.toLowerCase();

        // Save unchecked papers state before re-rendering
        const uncheckedIds = new Set();
        document.querySelectorAll('#tableBodyNewspapers .chk-paper-select:not(:checked)').forEach(cb => {
            const id = cb.getAttribute('data-id');
            if (id) uncheckedIds.add(id);
        });

        // Update active date label
        const lblActive = document.getElementById('lblActiveDate');
        if (lblActive) lblActive.textContent = `${dObj.day} ${MONTHS_SHORT[dObj.month - 1]} ${dObj.year}`;

        let readyCount = 0;
        const rowsHtml = NEWSPAPER_CATALOG.map((paper, idx) => {
            const state = paperStateMap.get(paper.id) || { status: 'ready', progress: 0, pages: 0, sizeMb: '0.00' };

            // Check if PDF file exists in generated files for this exact edition
            const existingFile = generatedFilesList.find(f => {
                const fName = (f.name || f.filename || '').toLowerCase();
                const matchesDate = fName.startsWith(rawDatePrefix) || fName.startsWith(fileDatePrefix) || fName.startsWith(dmyDatePrefix);
                if (!matchesDate) return false;

                if (paper.id.startsWith('thenews_')) {
                    if (!fName.includes('the news')) return false;
                    if (paper.id === 'thenews_khi') return fName.includes('karachi');
                    if (paper.id === 'thenews_lhr') return fName.includes('lahore');
                    if (paper.id === 'thenews_isb') return fName.includes('islamabad') || fName.includes('pindi');
                    return true;
                }
                if (paper.id.startsWith('pak_observer_')) {
                    if (!fName.includes('pakistan observer')) return false;
                    if (paper.id === 'pak_observer_isb') return fName.includes('islamabad');
                    if (paper.id === 'pak_observer_lhr') return fName.includes('lahore');
                    if (paper.id === 'pak_observer_khi') return fName.includes('karachi');
                    return true;
                }
                if (paper.id.startsWith('nation_')) {
                    if (!fName.includes('the nation')) return false;
                    if (paper.id === 'nation_lhr') return fName.includes('lahore');
                    if (paper.id === 'nation_isb') return fName.includes('islamabad');
                    if (paper.id === 'nation_khi') return fName.includes('karachi');
                    if (paper.id === 'nation_qta') return fName.includes('quetta');
                    return true;
                }
                if (paper.id.startsWith('92news_')) {
                    if (!fName.includes('92 news')) return false;
                    if (paper.id === '92news_isb') return fName.includes('islamabad');
                    if (paper.id === '92news_lhr') return fName.includes('lahore');
                    if (paper.id === '92news_khi') return fName.includes('karachi');
                    return true;
                }
                if (paper.id.startsWith('balochistan_')) {
                    if (!fName.includes('balochistan times')) return false;
                    if (paper.id === 'balochistan_qta') return fName.includes('quetta');
                    if (paper.id === 'balochistan_isb') return fName.includes('islamabad');
                    if (paper.id === 'balochistan_khi') return fName.includes('karachi');
                    return true;
                }
                if (paper.id.startsWith('ausaf_')) {
                    if (!fName.includes('ausaf')) return false;
                    if (paper.id === 'ausaf_isb') return fName.includes('islamabad');
                    if (paper.id === 'ausaf_lhr') return fName.includes('lahore');
                    if (paper.id === 'ausaf_khi') return fName.includes('karachi');
                    if (paper.id === 'ausaf_mzd') return fName.includes('muzaffarabad') || fName.includes('kashmir');
                    if (paper.id === 'ausaf_pesh') return fName.includes('peshawar');
                    if (paper.id === 'ausaf_glt') return fName.includes('gilgit');
                    if (paper.id === 'ausaf_eur') return fName.includes('europe');
                    return true;
                }
                if (paper.id.startsWith('jasarat_')) {
                    if (!fName.includes('jasarat')) return false;
                    if (paper.id === 'jasarat_khi') return fName.includes('karachi');
                    if (paper.id === 'jasarat_isb') return fName.includes('islamabad');
                    if (paper.id === 'jasarat_hyd') return fName.includes('hyderabad');
                    return true;
                }
                if (paper.id.startsWith('naibaat_')) {
                    if (!fName.includes('nai baat')) return false;
                    if (paper.id === 'naibaat_lhr') return fName.includes('lahore');
                    if (paper.id === 'naibaat_isb') return fName.includes('islamabad');
                    if (paper.id === 'naibaat_khi') return fName.includes('karachi');
                    if (paper.id === 'naibaat_pesh') return fName.includes('peshawar');
                    if (paper.id === 'naibaat_qta') return fName.includes('quetta');
                    if (paper.id === 'naibaat_sgd') return fName.includes('sargodha');
                    if (paper.id === 'naibaat_fsd') return fName.includes('faisalabad');
                    return true;
                }
                if (paper.id.startsWith('dailyaaj_')) {
                    if (!fName.includes('daily aaj')) return false;
                    if (paper.id === 'dailyaaj_pesh') return fName.includes('peshawar');
                    if (paper.id === 'dailyaaj_atd') return fName.includes('abbottabad');
                    return true;
                }
                if (paper.id.startsWith('juraat_')) {
                    if (!fName.includes('juraat')) return false;
                    if (paper.id === 'juraat_khi') return fName.includes('karachi');
                    if (paper.id === 'juraat_hyd') return fName.includes('hyderabad');
                    return true;
                }
                if (paper.id === 'brecorder') return fName.includes('business recorder');
                if (paper.id === 'dawn_editorials') return fName.includes('dawn editorials') || fName.includes('dawn editorial');
                if (paper.id === 'dawn_khi') return fName.includes('dawn') && !fName.includes('editorial');
                if (paper.id === 'express_tribune') return fName.includes('express tribune');
                if (paper.id === 'leadpakistan_nat') return fName.includes('lead pakistan');
                if (paper.id === 'jobz_pk') return fName.includes('jobz') || fName.includes('job ads');

                return false;
            });

            if (existingFile && state.status !== 'downloading') {
                state.status = 'completed';
                state.progress = 100;
                state.sizeMb = existingFile.sizeMb;
                state.pages = existingFile.pages || state.pages || parseInt(getEstimatedPageCount(paper.id), 10);
                state.fileUrl = existingFile.url;
                readyCount++;
            }

            let isVisible = true;
            if (currentCategoryFilter === 'all') {
                isVisible = true;
            } else if (currentCategoryFilter === 'pdf_ready') {
                isVisible = (state.status === 'completed');
            } else if (currentCategoryFilter === 'pdf_pending') {
                isVisible = (state.status !== 'completed');
            } else {
                isVisible = (paper.category === currentCategoryFilter);
            }

            let statusPill = '<span class="status-pill st-ready">● Ready</span>';
            let actionBtn = `<button type="button" class="btn-action-process" onclick="processSingleNewspaper('${paper.id}')">Process →</button>`;

            if (state.status === 'downloading') {
                statusPill = '<span class="status-pill st-downloading">⏳ Scraping...</span>';
                actionBtn = `<span style="font-size: 11px; font-weight: 700; color: var(--primary);">${state.progress}%</span>`;
            } else if (state.status === 'completed') {
                statusPill = '<span class="status-pill st-completed">✓ Completed</span>';
                actionBtn = `
                    <div class="newspaper-actions-group">
                        <button type="button" class="btn-action-view" onclick="previewPdfFile('${state.fileUrl || ''}', '${encodeURIComponent(paper.name)}')" title="Preview PDF">👁 View</button>
                        <a href="${state.fileUrl || '#'}" download class="btn-action-download" title="Download PDF">⬇ PDF</a>
                        <button type="button" class="btn-action-recreate" onclick="processSingleNewspaper('${paper.id}')" title="Re-create PDF">🔄 Re-create</button>
                    </div>
                `;
            } else if (state.status === 'failed') {
                statusPill = '<span class="status-pill st-failed">⚠️ Error</span>';
                actionBtn = `<button type="button" class="btn-action-process" onclick="processSingleNewspaper('${paper.id}')">Retry</button>`;
            }

            const pagePreset = getEstimatedPageCount(paper.id);
            const displayPages = state.pages > 0 ? `${state.pages} pgs` : (pagePreset.includes('Ads') ? pagePreset : `~${pagePreset} pgs`);
            const displaySize = (state.sizeMb && parseFloat(state.sizeMb) > 0) ? ` | ${state.sizeMb} MB` : '';

            let catClass = 'cat-urdu';
            if (paper.category === 'english') catClass = 'cat-english';
            else if (paper.category === 'jobs') catClass = 'cat-jobs';
            else if (paper.category === 'regional') catClass = 'cat-regional';

            const isChecked = !uncheckedIds.has(paper.id);

            return `
                <tr data-paper-id="${paper.id}" data-category="${paper.category}" style="display: ${isVisible ? 'table-row' : 'none'};">
                    <td class="col-checkbox">
                        <input type="checkbox" class="chk-paper-select" data-id="${paper.id}" ${isChecked ? 'checked' : ''}>
                    </td>
                    <td>
                        <div class="paper-name-cell">
                            <div class="paper-logo-badge">${paper.id === "jobz_pk" ? "JZ" : paper.name.substring(0, 2).toUpperCase()}</div>
                            <div>
                                <div class="paper-title">${paper.name}</div>
                                <div class="paper-meta">${paper.language} • Station: ${paper.station}${paper.website ? ` • <a href="${paper.website}" target="_blank" rel="noopener noreferrer" style="color:var(--primary); font-weight:600; text-decoration:none;">jobz.pk ↗</a>` : ""}</div>
                            </div>
                        </div>
                    </td>
                    <td><span class="category-pill ${catClass}">${paper.category.toUpperCase()}</span></td>
                    <td><span style="font-weight: 600; color: var(--text-secondary);">${paper.station}</span></td>
                    <td><span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted);">${dateFormatted}</span></td>
                    <td class="cell-status">${statusPill}</td>
                    <td style="min-width: 140px;">
                        <div class="row-progress-container">
                            <div class="row-progress-bar" id="rowBar_${paper.id}" style="width: ${state.progress}%;"></div>
                        </div>
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);" id="rowPct_${paper.id}">${state.progress}%</span>
                    </td>
                    <td>
                        <span class="page-count-badge">${displayPages}${displaySize}</span>
                    </td>
                    <td style="text-align: right;" class="cell-action">
                        ${actionBtn}
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml;

        // Update counts
        const navHub = document.getElementById('navCountHub'); if (navHub) navHub.textContent = NEWSPAPER_CATALOG.length;
        const lblReady = document.getElementById('lblReadyCount');
        if (lblReady) lblReady.innerHTML = `${readyCount} <span class="stat-sub">Files</span>`;

        // Update dynamic chip counts
        const totalPapers = NEWSPAPER_CATALOG.length;
        const pdfReadyCount = readyCount;
        const pdfPendingCount = totalPapers - readyCount;
        const englishCount = NEWSPAPER_CATALOG.filter(p => p.category === 'english').length;
        const urduCount = NEWSPAPER_CATALOG.filter(p => p.category === 'urdu').length;
        const jobsCount = NEWSPAPER_CATALOG.filter(p => p.category === 'jobs').length;
        const regionalCount = NEWSPAPER_CATALOG.filter(p => p.category === 'regional').length;

        const chipAll = document.querySelector('.tab-chip[data-filter="all"]');
        if (chipAll) chipAll.textContent = `All Editions (${totalPapers})`;

        const chipPdfReady = document.querySelector('.tab-chip[data-filter="pdf_ready"]');
        if (chipPdfReady) chipPdfReady.textContent = `✓ PDF Generated (${pdfReadyCount})`;

        const chipPdfPending = document.querySelector('.tab-chip[data-filter="pdf_pending"]');
        if (chipPdfPending) chipPdfPending.textContent = `⏳ PDF Pending (${pdfPendingCount})`;

        const chipEnglish = document.querySelector('.tab-chip[data-filter="english"]');
        if (chipEnglish) chipEnglish.textContent = `English (${englishCount})`;

        const chipUrdu = document.querySelector('.tab-chip[data-filter="urdu"]');
        if (chipUrdu) chipUrdu.textContent = `Urdu (${urduCount})`;

        const chipJobs = document.querySelector('.tab-chip[data-filter="jobs"]');
        if (chipJobs) chipJobs.textContent = `Daily Jobs (${jobsCount})`;

        const chipRegional = document.querySelector('.tab-chip[data-filter="regional"]');
        if (chipRegional) chipRegional.textContent = `Regional & Sindhi (${regionalCount})`;

        updateSelectionCounter();
    }

    function updateSelectionCounter() {
        const checkedBoxes = document.querySelectorAll('.chk-paper-select:checked');
        const lblSelected = document.getElementById('lblSelectedCount');
        if (lblSelected) lblSelected.innerHTML = `${checkedBoxes.length} <span class="stat-sub">Selected</span>`;
    }

    // ── KHALIK NEWSPAPERS TABLE RENDERER ─────────────────────────────────────
    let currentKhalikFilter = 'all';

    function renderKhalikTable() {
        const tbody = document.getElementById('tableBodyKhalik');
        if (!tbody) return;

        const dObj = getSelectedDateObj();
        const dateFormatted = dObj.formatted;
        const fileDatePrefix = dObj.fileDate.toLowerCase();
        const rawDatePrefix = dObj.rawDate.toLowerCase();
        const dmyDatePrefix = dObj.formatted.toLowerCase();

        // Save unchecked papers state before re-rendering
        const uncheckedIds = new Set();
        document.querySelectorAll('#tableBodyKhalik .chk-khalik-paper-select:not(:checked)').forEach(cb => {
            const id = cb.getAttribute('data-id');
            if (id) uncheckedIds.add(id);
        });

        const lblActive = document.getElementById('lblKhalikActiveDate');
        if (lblActive) lblActive.textContent = `${dObj.day} ${MONTHS_SHORT[dObj.month - 1]} ${dObj.year}`;

        let readyCount = 0;
        const rowsHtml = KHALIK_NEWSPAPER_CATALOG.map((paper, idx) => {
            const state = paperStateMap.get(paper.id) || { status: 'ready', progress: 0, pages: 0, sizeMb: '0.00' };

            const existingFile = generatedFilesList.find(f => {
                const fName = (f.name || f.filename || '').toLowerCase();
                const matchesDate = fName.startsWith(rawDatePrefix) || fName.startsWith(fileDatePrefix) || fName.startsWith(dmyDatePrefix);
                if (!matchesDate) return false;

                const st = (paper.station || '').toLowerCase();
                if (paper.id.includes('express')) return fName.includes('express') && fName.includes(st);
                if (paper.id.includes('jehan')) return fName.includes('jehan') && fName.includes(st);
                if (paper.id.includes('dpcom') || paper.id.includes('dppk')) return fName.includes('pakistan') && fName.includes(st);
                if (paper.id.includes('jinnah')) return fName.includes('jinnah') && fName.includes(st);
                if (paper.id.includes('sahafat')) return fName.includes('sahafat') && fName.includes(st);
                if (paper.id.includes('k2')) return fName.includes('k2') && fName.includes(st);
                if (paper.id.includes('jang')) return fName.includes('jang') && fName.includes(st);
                if (paper.id.includes('dunya')) return fName.includes('dunya') && fName.includes(st);
                return false;
            });

            if (existingFile && state.status !== 'downloading') {
                state.status = 'completed';
                state.progress = 100;
                state.sizeMb = existingFile.sizeMb || (existingFile.size ? (existingFile.size / 1024 / 1024).toFixed(2) : '0.00');
                state.pages = existingFile.pages || state.pages || 10;
                state.fileUrl = existingFile.url || `/output/${encodeURIComponent(existingFile.name)}`;
                readyCount++;
            }

            let isVisible = true;
            if (currentKhalikFilter === 'all') {
                isVisible = true;
            } else if (currentKhalikFilter === 'pdf_ready') {
                isVisible = (state.status === 'completed');
            } else if (currentKhalikFilter === 'pdf_pending') {
                isVisible = (state.status !== 'completed');
            } else if (currentKhalikFilter === 'express') {
                isVisible = paper.id.includes('express');
            } else if (currentKhalikFilter === 'jehan') {
                isVisible = paper.id.includes('jehan');
            } else if (currentKhalikFilter === 'dpcom') {
                isVisible = paper.id.includes('dpcom');
            } else if (currentKhalikFilter === 'dppk') {
                isVisible = paper.id.includes('dppk');
            } else if (currentKhalikFilter === 'jinnah') {
                isVisible = paper.id.includes('jinnah');
            } else if (currentKhalikFilter === 'sahafat') {
                isVisible = paper.id.includes('sahafat');
            } else if (currentKhalikFilter === 'k2') {
                isVisible = paper.id.includes('k2');
            } else if (currentKhalikFilter === 'jang') {
                isVisible = paper.id.includes('jang');
            } else if (currentKhalikFilter === 'dunya') {
                isVisible = paper.id.includes('dunya');
            }

            let statusPill = '<span class="status-pill st-ready">● Ready</span>';
            let actionBtn = `<button type="button" class="btn-action-process" onclick="processSingleKhalikNewspaper('${paper.id}')">Process →</button>`;

            if (state.status === 'downloading') {
                statusPill = '<span class="status-pill st-downloading">⏳ Scraping...</span>';
                actionBtn = `<span style="font-size: 11px; font-weight: 700; color: var(--primary);">${state.progress}%</span>`;
            } else if (state.status === 'completed') {
                statusPill = '<span class="status-pill st-completed">✓ Completed</span>';
                actionBtn = `
                    <div class="newspaper-actions-group">
                        <button type="button" class="btn-action-view" onclick="previewPdfFile('${state.fileUrl || ''}', '${encodeURIComponent(paper.name)}')" title="Preview PDF">👁 View</button>
                        <a href="${state.fileUrl || '#'}" download class="btn-action-download" title="Download PDF">⬇ PDF</a>
                        <button type="button" class="btn-action-recreate" onclick="processSingleKhalikNewspaper('${paper.id}')" title="Re-create PDF">🔄 Re-create</button>
                    </div>
                `;
            } else if (state.status === 'failed') {
                statusPill = '<span class="status-pill st-failed">⚠️ Error</span>';
                actionBtn = `<button type="button" class="btn-action-process" onclick="processSingleKhalikNewspaper('${paper.id}')">Retry</button>`;
            }

            const pCount = existingFile ? `${existingFile.pages || state.pages || 10} pgs` : (state.pages > 0 ? `${state.pages} pgs` : '~10 pgs');
            const displaySize = (state.sizeMb && parseFloat(state.sizeMb) > 0) ? ` | ${state.sizeMb} MB` : '';
            const badgeText = paper.network.substring(0, 2).toUpperCase();
            const isChecked = !uncheckedIds.has(paper.id);

            return `
                <tr data-paper-id="${paper.id}" data-category="khalik" style="display: ${isVisible ? 'table-row' : 'none'};">
                    <td class="col-checkbox">
                        <input type="checkbox" class="chk-khalik-paper-select" data-id="${paper.id}" ${isChecked ? 'checked' : ''}>
                    </td>
                    <td>
                        <div class="paper-name-cell">
                            <div class="paper-logo-badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706;">${badgeText}</div>
                            <div>
                                <div class="paper-title">${paper.name}</div>
                                <div class="paper-meta">${paper.language} • Station: ${paper.station}</div>
                            </div>
                        </div>
                    </td>
                    <td><span class="category-pill cat-jobs">${paper.network.toUpperCase()}</span></td>
                    <td><span style="font-weight: 600; color: var(--text-secondary);">${paper.station}</span></td>
                    <td><span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted);">${dateFormatted}</span></td>
                    <td class="cell-status">${statusPill}</td>
                    <td style="min-width: 140px;">
                        <div class="row-progress-container">
                            <div class="row-progress-bar" id="rowBar_${paper.id}" style="width: ${state.progress}%;"></div>
                        </div>
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);" id="rowPct_${paper.id}">${state.progress}%</span>
                    </td>
                    <td>
                        <span class="page-count-badge">${pCount}${displaySize}</span>
                    </td>
                    <td style="text-align: right;" class="cell-action">
                        ${actionBtn}
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml;

        const navKhalik = document.getElementById('navCountKhalik'); if (navKhalik) navKhalik.textContent = KHALIK_NEWSPAPER_CATALOG.length;
        const lblReady = document.getElementById('lblKhalikReadyCount');
        if (lblReady) lblReady.innerHTML = `${readyCount} <span class="stat-sub">Files</span>`;

        // Update Khalik dynamic chip counts
        const totalKhalik = KHALIK_NEWSPAPER_CATALOG.length;
        const kPdfReadyCount = readyCount;
        const kPdfPendingCount = totalKhalik - readyCount;

        const kChipAll = document.querySelector('[data-khalik-filter="all"]');
        if (kChipAll) kChipAll.textContent = `All Khaliq (${totalKhalik})`;

        const kChipPdfReady = document.querySelector('[data-khalik-filter="pdf_ready"]');
        if (kChipPdfReady) kChipPdfReady.textContent = `✓ PDF Generated (${kPdfReadyCount})`;

        const kChipPdfPending = document.querySelector('[data-khalik-filter="pdf_pending"]');
        if (kChipPdfPending) kChipPdfPending.textContent = `⏳ PDF Pending (${kPdfPendingCount})`;

        updateKhalikSelectionCounter();
    }

    function updateKhalikSelectionCounter() {
        const checkedBoxes = document.querySelectorAll('.chk-khalik-paper-select:checked');
        const lblSelected = document.getElementById('lblKhalikSelectedCount');
        if (lblSelected) lblSelected.innerHTML = `${checkedBoxes.length} <span class="stat-sub">Selected</span>`;
    }

    window.processSingleKhalikNewspaper = function(paperId) {
        document.querySelectorAll('.chk-khalik-paper-select').forEach(cb => {
            cb.checked = (cb.getAttribute('data-id') === paperId);
        });
        updateKhalikSelectionCounter();
        executeKhalikBatch();
    };

    async function executeKhalikBatch() {
        if (isBatchRunning) return;

        const selectedCheckboxes = document.querySelectorAll('.chk-khalik-paper-select:checked');
        const targetIds = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-id'));

        if (targetIds.length === 0) {
            showToast('Please select at least one Khalik newspaper edition to process.', 'error');
            return;
        }

        const dObj = getSelectedDateObj();
        const dateStr = dObj.formatted;

        isBatchRunning = true;
        const btnStart = document.getElementById('btnStartKhalikBatch');
        const btnStop = document.getElementById('btnStopKhalikBatch');
        const mainBar = document.getElementById('mainProgressBar');
        const lblPct = document.getElementById('lblProgressPercent');
        const consoleBox = document.getElementById('consoleBox');

        if (btnStart) btnStart.style.display = 'none';
        if (btnStop) btnStop.style.display = 'inline-flex';
        if (mainBar) mainBar.style.width = '0%';
        if (lblPct) lblPct.textContent = '0%';
        if (consoleBox) consoleBox.innerHTML = `<div class="console-line">[System] Initiating Khalik batch processing for ${targetIds.length} editions on ${dateStr}...</div>`;

        targetIds.forEach(id => {
            paperStateMap.set(id, { status: 'downloading', progress: 5, pages: 0, sizeMb: '0.00' });
        });
        renderKhalikTable();

        try {
            const res = await fetch('/api/process-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: dateStr,
                    selectedPapers: targetIds,
                    config: {
                        watermarkText: document.getElementById('inputWatermarkText')?.value || 'Social Media Pakistan 0342-4938217',
                        enableTop: document.getElementById('chkEnableTop')?.checked !== false,
                        enableBottom: document.getElementById('chkEnableBottom')?.checked !== false,
                        enableDiagonal: document.getElementById('chkEnableDiagonal')?.checked === true
                    }
                })
            });

            if (!res.ok) {
                if (res.status === 409) {
                    await fetch('/api/batch/unlock').catch(() => {});
                    throw new Error('A previous batch was running. Reset unlock — please try again.');
                }
                throw new Error(`Server batch error (${res.status})`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split('\n\n');
                buf = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.replace('data: ', ''));
                            if (data.type === 'LOG') {
                                if (consoleBox) {
                                    const cDiv = document.createElement('div');
                                    cDiv.className = `console-line ${data.status || 'info'}`;
                                    cDiv.textContent = `[${data.time || ''}] ${data.message}`;
                                    consoleBox.appendChild(cDiv);
                                    consoleBox.scrollTop = consoleBox.scrollHeight;
                                }
                                if (data.percent !== null && data.percent !== undefined) {
                                    if (mainBar) mainBar.style.width = `${data.percent}%`;
                                    if (lblPct) lblPct.textContent = `${data.percent}%`;
                                }
                                if (data.paperId) {
                                    const st = paperStateMap.get(data.paperId) || { status: 'ready', progress: 0, pages: 0, sizeMb: '0.00' };
                                    if (data.status === 'success') {
                                        st.status = 'completed';
                                        st.progress = 100;
                                    } else if (data.status === 'error') {
                                        st.status = 'failed';
                                    } else {
                                        st.status = 'downloading';
                                        if (data.paperProgress !== null) st.progress = data.paperProgress;
                                    }
                                    paperStateMap.set(data.paperId, st);
                                    renderKhalikTable();
                                }
                            }
                        } catch (_) {}
                    }
                }
            }
            showToast('Khalik Batch completed successfully!', 'success');
        } catch (err) {
            showToast(`Khalik Batch error: ${err.message}`, 'error');
        } finally {
            isBatchRunning = false;
            if (btnStart) btnStart.style.display = 'inline-flex';
            if (btnStop) btnStop.style.display = 'none';
            fetchFiles();
        }
    }

    // ── BATCH ENGINE RUNNER & SSE LISTENER ───────────────────────────────────
    async function executeBatch() {
        if (isBatchRunning) return;

        const selectedCheckboxes = document.querySelectorAll('.chk-paper-select:checked');
        const targetIds = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-id'));

        if (targetIds.length === 0) {
            showToast('Please select at least one newspaper edition to process.', 'error');
            return;
        }

        const dObj = getSelectedDateObj();
        const dateStr = dObj.formatted;

        isBatchRunning = true;
        const btnStart = document.getElementById('btnStartBatch');
        const btnStop = document.getElementById('btnStopBatch');
        const mainBar = document.getElementById('mainProgressBar');
        const lblPct = document.getElementById('lblProgressPercent');
        const consoleBox = document.getElementById('consoleBox');

        if (btnStart) btnStart.style.display = 'none';
        if (btnStop) btnStop.style.display = 'inline-flex';
        if (mainBar) mainBar.style.width = '0%';
        if (lblPct) lblPct.textContent = '0%';
        if (consoleBox) consoleBox.innerHTML = `<div class="console-line">[System] Initiating batch processing for ${targetIds.length} editions on ${dateStr}...</div>`;

        // Mark items as downloading
        targetIds.forEach(id => {
            paperStateMap.set(id, { status: 'downloading', progress: 5, pages: 0, sizeMb: '0.00' });
        });
        renderNewspaperTable();

        try {
            const res = await fetch('/api/process-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: dateStr,
                    selectedPapers: targetIds,
                    config: {
                        watermarkText: document.getElementById('inputWatermarkText')?.value || 'Social Media Pakistan 0342-4938217',
                        enableTop: document.getElementById('chkEnableTop')?.checked !== false,
                        enableBottom: document.getElementById('chkEnableBottom')?.checked !== false,
                        enableDiagonal: document.getElementById('chkEnableDiagonal')?.checked === true
                    }
                })
            });

            if (!res.ok) {
                if (res.status === 409) {
                    await fetch('/api/batch/unlock').catch(() => {});
                    throw new Error('A previous batch was still running. Lock has been automatically reset — please click Run Batch again.');
                }
                throw new Error(`Batch HTTP error ${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep remainder

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.substring(6));
                            handleBatchEvent(event);
                        } catch (_) {}
                    }
                }
            }

            showToast('✓ Batch processing completed successfully!', 'success');
        } catch (err) {
            showToast(`Batch stopped or error: ${err.message}`, 'error');
        } finally {
            isBatchRunning = false;
            if (btnStart) btnStart.style.display = 'inline-flex';
            if (btnStop) btnStop.style.display = 'none';
            await fetchFiles();
            renderNewspaperTable();
        }
    }

        function handleBatchEvent(evt) {
        const consoleBox = document.getElementById('consoleBox');
        const mainBar = document.getElementById('mainProgressBar');
        const lblPct = document.getElementById('lblProgressPercent');

        if (evt.type === 'LOG' && evt.message) {
            if (consoleBox) {
                const div = document.createElement('div');
                div.className = `console-line ${evt.status === 'success' ? 'text-success' : (evt.status === 'error' ? 'text-error' : '')}`;
                div.textContent = `[${evt.time || new Date().toLocaleTimeString()}] ${evt.message}`;
                consoleBox.appendChild(div);
                consoleBox.scrollTop = consoleBox.scrollHeight;
            }
            if (evt.percent !== undefined && evt.percent !== null) {
                if (mainBar) mainBar.style.width = `${evt.percent}%`;
                if (lblPct) lblPct.textContent = `${evt.percent}%`;
            }
            if (evt.paperId && evt.paperProgress !== null && evt.paperProgress !== undefined) {
                const rowBar = document.getElementById(`rowBar_${evt.paperId}`);
                const rowPct = document.getElementById(`rowPct_${evt.paperId}`);
                const tr = document.querySelector(`tr[data-paper-id="${evt.paperId}"]`);
                if (rowBar) rowBar.style.width = `${evt.paperProgress}%`;
                if (rowPct) rowPct.textContent = `${evt.paperProgress}%`;
                if (tr && evt.paperProgress > 0 && evt.paperProgress < 100) {
                    const statusTd = tr.querySelector('.cell-status');
                    if (statusTd) statusTd.innerHTML = `<span class="status-pill st-downloading">⏳ Scraping (${evt.paperProgress}%)...</span>`;
                }
            }
        }

        if (evt.type === 'ITEM_DONE' && evt.paperId) {
            paperStateMap.set(evt.paperId, {
                status: evt.success ? 'completed' : 'failed',
                progress: evt.success ? 100 : 0,
                pages: evt.pages || 0,
                sizeMb: evt.sizeMb || '0.00',
                fileUrl: evt.url || ''
            });

            const tr = document.querySelector(`tr[data-paper-id="${evt.paperId}"]`);
            if (tr) {
                const rowBar = tr.querySelector(`#rowBar_${evt.paperId}`);
                const rowPct = tr.querySelector(`#rowPct_${evt.paperId}`);
                const statusTd = tr.querySelector('.cell-status');
                const actionTd = tr.querySelector('.cell-action');

                if (rowBar) rowBar.style.width = evt.success ? '100%' : '0%';
                if (rowPct) rowPct.textContent = evt.success ? '100%' : '0%';

                if (statusTd) {
                    statusTd.innerHTML = evt.success
                        ? '<span class="status-pill st-completed">✓ Completed</span>'
                        : '<span class="status-pill st-failed">⚠️ No issue today</span>';
                }

                if (actionTd) {
                    if (evt.success) {
                        const pName = (NEWSPAPER_CATALOG.find(p => p.id === evt.paperId)?.name) || evt.paperId;
                        actionTd.innerHTML = `
                            <div class="newspaper-actions-group">
                                <button type="button" class="btn-action-view" onclick="previewPdfFile('${evt.url || ''}', '${encodeURIComponent(pName)}')" title="Preview PDF">👁 View</button>
                                <a href="${evt.url || '#'}" download class="btn-action-download" title="Download PDF">⬇ PDF</a>
                                <button type="button" class="btn-action-recreate" onclick="processSingleNewspaper('${evt.paperId}')" title="Re-create PDF">🔄 Re-create</button>
                            </div>
                        `;
                    } else {
                        actionTd.innerHTML = `<button type="button" class="btn-action-process" onclick="processSingleNewspaper('${evt.paperId}')">Retry</button>`;
                    }
                }
            }

            // Update ready count
            fetchFiles();
        }
    }

    window.processSingleNewspaper = function(paperId) {
        document.querySelectorAll('.chk-paper-select').forEach(cb => {
            cb.checked = (cb.getAttribute('data-id') === paperId);
        });
        updateSelectionCounter();
        executeBatch();
    };

    
    // ── ARAB & MIDDLE EAST NEWSPAPER CONTROLLER ──────────────────────────────
    let allArabPapers = [];
    const arabPaperStateMap = new Map();
    let currentArabCategoryFilter = 'all';
    let isArabBatchRunning = false;
    let arabGeneratedFilesList = [];

    function getSelectedArabDateObj() {
        const inputArab = document.getElementById('dateSelectArab') || document.getElementById('arabPublicationDate');
        if (inputArab && inputArab.value) {
            const parts = inputArab.value.split('-');
            if (parts.length === 3) {
                let year, month, day;
                if (parts[0].length === 4) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10);
                    day = parseInt(parts[2], 10);
                } else {
                    day = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10);
                    year = parseInt(parts[2], 10);
                }
                const fileDate = `${day} ${MONTHS_SHORT[month - 1]}`;
                return {
                    day,
                    month,
                    year,
                    formatted: `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`,
                    fileDate
                };
            }
        }
        return getSelectedDateObj();
    }

    async function fetchArabFiles() {
        const dObj = getSelectedArabDateObj();
        try {
            const res = await fetch(`/api/arab/files?date=${encodeURIComponent(dObj.formatted)}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.files)) {
                arabGeneratedFilesList = data.files;
            } else {
                arabGeneratedFilesList = [];
            }
        } catch (_) {
            arabGeneratedFilesList = [];
        }

        if (typeof generatedFilesList !== 'undefined' && Array.isArray(generatedFilesList)) {
            const arabGlobal = generatedFilesList.filter(f => getFileCategory(f) === 'arabnews');
            arabGlobal.forEach(gf => {
                const gfName = gf.name || gf.filename || '';
                if (!arabGeneratedFilesList.some(af => (af.name || af.filename) === gfName)) {
                    arabGeneratedFilesList.push({
                        filename: gfName,
                        name: gfName.replace(/\.pdf$/i, ''),
                        sizeMb: gf.sizeMb || (gf.sizeBytes ? (gf.sizeBytes / (1024 * 1024)).toFixed(2) : '0.00'),
                        url: gf.url || `/output/${encodeURIComponent(gfName)}`,
                        pages: gf.pages || 16
                    });
                }
            });
        }
    }

    function findExistingArabFile(paper, filesList) {
        if (!Array.isArray(filesList) || filesList.length === 0) return null;
        
        return filesList.find(f => {
            const fName = (f.name || f.filename || '').toLowerCase();
            
            switch (paper.id) {
                case 'arab_gulf_times_main':
                    return fName.includes('gulf') && fName.includes('times') && (fName.includes('main') || (!fName.includes('business') && !fName.includes('biz') && !fName.includes('sport')));
                case 'arab_gulf_times_biz':
                    return fName.includes('gulf') && fName.includes('times') && (fName.includes('business') || fName.includes('biz'));
                case 'arab_gulf_times_sport':
                    return fName.includes('gulf') && fName.includes('times') && (fName.includes('sport') || fName.includes('sports'));

                case 'arab_qatar_tribune_main':
                    return fName.includes('qatar') && fName.includes('tribune') && (fName.includes('main') || (!fName.includes('business') && !fName.includes('biz') && !fName.includes('sport')));
                case 'arab_qatar_tribune_biz':
                    return fName.includes('qatar') && fName.includes('tribune') && (fName.includes('business') || fName.includes('biz'));
                case 'arab_qatar_tribune_sport':
                    return fName.includes('qatar') && fName.includes('tribune') && (fName.includes('sport') || fName.includes('sports'));

                case 'arab_peninsula_main':
                    return fName.includes('peninsula') && (fName.includes('main') || (!fName.includes('business') && !fName.includes('biz') && !fName.includes('sport')));
                case 'arab_peninsula_biz':
                    return fName.includes('peninsula') && (fName.includes('business') || fName.includes('biz'));
                case 'arab_peninsula_sport':
                    return fName.includes('peninsula') && (fName.includes('sport') || fName.includes('sports'));

                case 'arab_al_sharq':
                    return fName.includes('sharq');

                case 'arab_al_watan_main':
                    return fName.includes('watan') && (fName.includes('main') || (!fName.includes('sport') && !fName.includes('sports')));
                case 'arab_al_watan_sport':
                    return fName.includes('watan') && (fName.includes('sport') || fName.includes('sports'));

                case 'arab_akhbar_alkhaleej':
                    return fName.includes('akhbar') || fName.includes('khaleej');
                case 'arab_arab_times':
                    return fName.includes('arab') && fName.includes('times') && !fName.includes('news');
                case 'arab_kuwait_times':
                    return fName.includes('kuwait') && fName.includes('times');
                case 'arab_al_qabas':
                    return fName.includes('qabas');
                case 'arab_tehran_times':
                    return fName.includes('tehran');
                case 'arab_oman_daily':
                    return fName.includes('oman');
                case 'arab_arab_news':
                    return fName.includes('arab') && fName.includes('news');
                case 'arab_al_madina':
                    return fName.includes('madina');
                case 'arab_al_quds':
                    return fName.includes('quds');
                default:
                    const cleanName = paper.name.toLowerCase().replace(/[^a-z0-9 ]/g, '');
                    const words = cleanName.split(' ').filter(w => w.length > 2);
                    return words.every(w => fName.includes(w));
            }
        });
    }

    async function loadArabCatalog() {
        const dObj = getSelectedArabDateObj();
        
        const dateInput = document.getElementById('dateSelectArab') || document.getElementById('arabPublicationDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().slice(0, 10);
        }
        const statDate = document.getElementById('lblArabActiveDate');
        if (statDate) statDate.textContent = `${dObj.day} ${MONTHS_SHORT[dObj.month - 1]} ${dObj.year}`;

        try {
            const res = await fetch('/api/arab/catalog');
            const data = await res.json();
            if (data.success && Array.isArray(data.catalog)) {
                allArabPapers = data.catalog;
                const statTotal = document.getElementById('lblArabTotalCount');
                if (statTotal) statTotal.innerHTML = `${allArabPapers.length} <span class="stat-sub">Editions</span>`;
                const navCount = document.getElementById('navCountArab');
                if (navCount) navCount.textContent = allArabPapers.length;
            }
        } catch (err) {
            console.error('Error loading Arab catalog:', err);
        }

        await fetchArabFiles();
        renderArabTable();
        updateArabSelectionCounter();
    }

    async function initArabSection() {
        await loadArabCatalog();
    }

    window.initArabSection = initArabSection;
    window.loadArabCatalog = loadArabCatalog;

    function renderArabTable() {
        const tbody = document.getElementById('tableBodyArab') || document.getElementById('arabTableBody');
        if (!tbody) return;

        const dObj = getSelectedArabDateObj();

        // Save unchecked papers state before re-rendering
        const uncheckedIds = new Set();
        document.querySelectorAll('#tableBodyArab .chk-arab-select:not(:checked)').forEach(cb => {
            const id = cb.getAttribute('data-id');
            if (id) uncheckedIds.add(id);
        });

        // Update active date label
        const lblActive = document.getElementById('lblArabActiveDate');
        if (lblActive) lblActive.textContent = `${dObj.day} ${MONTHS_SHORT[dObj.month - 1]} ${dObj.year}`;

        const searchQuery = (document.getElementById('searchInputArab')?.value || '').toLowerCase().trim();

        let readyCount = 0;

        const filteredList = allArabPapers.filter(paper => {
            if (searchQuery) {
                const matches = paper.name.toLowerCase().includes(searchQuery) ||
                                (paper.city && paper.city.toLowerCase().includes(searchQuery)) ||
                                (paper.country && paper.country.toLowerCase().includes(searchQuery)) ||
                                (paper.code && paper.code.toLowerCase().includes(searchQuery));
                if (!matches) return false;
            }
            if (currentArabCategoryFilter === 'all') return true;
            if (currentArabCategoryFilter === 'pdf_ready') {
                const state = arabPaperStateMap.get(paper.id);
                return state && state.status === 'completed';
            }
            if (currentArabCategoryFilter === 'pdf_pending') {
                const state = arabPaperStateMap.get(paper.id);
                return !state || state.status !== 'completed';
            }
            if (currentArabCategoryFilter === 'qatar') return paper.country === 'Qatar';
            if (currentArabCategoryFilter === 'bahrain') return paper.country === 'Bahrain';
            if (currentArabCategoryFilter === 'kuwait') return paper.country === 'Kuwait';
            if (currentArabCategoryFilter === 'saudi') return paper.country === 'Saudi Arabia';
            if (currentArabCategoryFilter === 'others') return ['Oman', 'Iran', 'International', 'Regional', 'Pan-Arab'].includes(paper.country);
            return true;
        });

        if (filteredList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color:var(--text-muted);">No Arab editions match the selected filter.</td></tr>`;
            return;
        }

        const rowsHtml = filteredList.map(paper => {
            const state = arabPaperStateMap.get(paper.id) || { status: 'ready', progress: 0, pages: 0, sizeMb: '0.00' };

            // Match with existing Arab generated files
            const existingFile = findExistingArabFile(paper, arabGeneratedFilesList);

            if (existingFile && state.status !== 'downloading') {
                state.status = 'completed';
                state.progress = 100;
                state.sizeMb = existingFile.sizeMb;
                state.pages = existingFile.pages || 16;
                state.fileUrl = existingFile.url;
                readyCount++;
            }

            let statusPill = '<span class="status-pill st-ready">● Ready</span>';
            let actionBtn = `<button type="button" class="btn-action-process" onclick="processSingleArabNewspaper('${paper.id}')">Process →</button>`;

            if (state.status === 'downloading') {
                statusPill = '<span class="status-pill st-downloading">⏳ Scraping...</span>';
                actionBtn = `<span style="font-size: 11px; font-weight: 700; color: var(--primary);">${state.progress}%</span>`;
            } else if (state.status === 'completed') {
                statusPill = '<span class="status-pill st-completed">✓ Completed</span>';
                actionBtn = `
                    <div class="newspaper-actions-group">
                        <button type="button" class="btn-action-view" onclick="previewPdfFile('${state.fileUrl || ''}', '${encodeURIComponent(paper.name)}')" title="Preview PDF">👁 View</button>
                        <a href="${state.fileUrl || '#'}" download class="btn-action-download" title="Download PDF">⬇ PDF</a>
                        <button type="button" class="btn-action-recreate" onclick="processSingleArabNewspaper('${paper.id}')" title="Re-create PDF">🔄 Re-create</button>
                    </div>
                `;
            } else if (state.status === 'failed') {
                statusPill = '<span class="status-pill st-failed">⚠️ Error</span>';
                actionBtn = `<button type="button" class="btn-action-process" onclick="processSingleArabNewspaper('${paper.id}')">Retry</button>`;
            }

            const countryFlags = {
                'Qatar': '🇶🇦',
                'Bahrain': '🇧🇭',
                'Kuwait': '🇰🇼',
                'Saudi Arabia': '🇸🇦',
                'Oman': '🇴🇲',
                'Iran': '🇮🇷',
                'International': '🌍',
                'Regional': '🌐',
                'Pan-Arab': '🌍'
            };
            const flag = countryFlags[paper.country] || '📰';
            const isChecked = !uncheckedIds.has(paper.id);

            return `
                <tr data-paper-id="${paper.id}" data-category="${paper.country.toLowerCase()}">
                    <td class="col-checkbox">
                        <input type="checkbox" class="chk-arab-select" data-id="${paper.id}" ${isChecked ? 'checked' : ''} onchange="updateArabSelectionCounter()">
                    </td>
                    <td>
                        <div class="paper-name-cell">
                            <div class="paper-logo-badge" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6;">${flag}</div>
                            <div>
                                <div class="paper-title">${paper.name}</div>
                                <div class="paper-meta">${paper.country} • Station: ${paper.city}</div>
                            </div>
                        </div>
                    </td>
                    <td><span class="category-pill cat-english">${paper.country.toUpperCase()}</span></td>
                    <td><span style="font-weight: 600; color: var(--text-secondary);">${paper.city}</span></td>
                    <td><span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted);">${dObj.fileDate}</span></td>
                    <td class="cell-status">${statusPill}</td>
                    <td style="min-width: 140px;">
                        <div class="row-progress-container">
                            <div class="row-progress-bar" id="arabRowBar_${paper.id}" style="width: ${state.progress}%;"></div>
                        </div>
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);" id="arabRowPct_${paper.id}">${state.progress}%</span>
                    </td>
                    <td>
                        <span class="page-count-badge">${state.pages > 0 ? `${state.pages} pgs` : '16-32 pgs'}${state.sizeMb > 0 ? ` | ${state.sizeMb} MB` : ''}</span>
                    </td>
                    <td style="text-align: right;" class="cell-action">
                        ${actionBtn}
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml;

        // Update Stat Cards & Counts
        const lblTotal = document.getElementById('lblArabTotalCount');
        if (lblTotal) lblTotal.innerHTML = `${allArabPapers.length} <span class="stat-sub">Editions</span>`;

        const lblReady = document.getElementById('lblArabReadyCount');
        if (lblReady) lblReady.innerHTML = `${readyCount} <span class="stat-sub">Files</span>`;

        // Update Chip Badges
        const totalPapers = allArabPapers.length;
        const pdfReadyCount = readyCount;
        const pdfPendingCount = totalPapers - readyCount;
        const qatarCount = allArabPapers.filter(p => p.country === 'Qatar').length;
        const bahrainCount = allArabPapers.filter(p => p.country === 'Bahrain').length;
        const kuwaitCount = allArabPapers.filter(p => p.country === 'Kuwait').length;
        const saudiCount = allArabPapers.filter(p => p.country === 'Saudi Arabia').length;
        const othersCount = totalPapers - (qatarCount + bahrainCount + kuwaitCount + saudiCount);

        const chipAll = document.querySelector('[data-arab-filter="all"]');
        if (chipAll) chipAll.textContent = `All Editions (${totalPapers})`;

        const chipPdfReady = document.querySelector('[data-arab-filter="pdf_ready"]');
        if (chipPdfReady) chipPdfReady.textContent = `✓ PDF Generated (${pdfReadyCount})`;

        const chipPdfPending = document.querySelector('[data-arab-filter="pdf_pending"]');
        if (chipPdfPending) chipPdfPending.textContent = `⏳ PDF Pending (${pdfPendingCount})`;

        const chipQatar = document.querySelector('[data-arab-filter="qatar"]');
        if (chipQatar) chipQatar.textContent = `Qatar (${qatarCount})`;

        const chipBahrain = document.querySelector('[data-arab-filter="bahrain"]');
        if (chipBahrain) chipBahrain.textContent = `Bahrain (${bahrainCount})`;

        const chipKuwait = document.querySelector('[data-arab-filter="kuwait"]');
        if (chipKuwait) chipKuwait.textContent = `Kuwait (${kuwaitCount})`;

        const chipSaudi = document.querySelector('[data-arab-filter="saudi"]');
        if (chipSaudi) chipSaudi.textContent = `Saudi Arabia (${saudiCount})`;

        const chipOthers = document.querySelector('[data-arab-filter="others"]');
        if (chipOthers) chipOthers.textContent = `Oman & Regional (${othersCount})`;

        updateArabSelectionCounter();
    }

    function updateArabSelectionCounter() {
        const total = document.querySelectorAll('.chk-arab-select').length;
        const selected = document.querySelectorAll('.chk-arab-select:checked').length;
        const statSel = document.getElementById('lblArabSelectedCount');
        if (statSel) statSel.innerHTML = `${selected} <span class="stat-sub">Ready</span>`;
        const master = document.getElementById('chkArabMasterTable');
        if (master) {
            master.checked = total > 0 && selected === total;
            master.indeterminate = selected > 0 && selected < total;
        }
    }

    window.updateArabSelectionCounter = updateArabSelectionCounter;

    let arabBatchPollInterval = null;

    async function checkServerArabBatchStatus() {
        try {
            const res = await fetch('/api/arab/status', { headers: { 'Cache-Control': 'no-cache' } });
            const data = await res.json();
            if (data.success && data.state) {
                const state = data.state;
                isArabBatchRunning = state.isRunning;

                const btnRun = document.getElementById('btnRunArabBatch');
                const btnStop = document.getElementById('btnStopArabBatch');
                if (isArabBatchRunning) {
                    if (!arabBatchPollInterval) {
                        arabBatchPollInterval = setInterval(checkServerArabBatchStatus, 2000);
                    }
                    if (btnRun) btnRun.style.display = 'none';
                    if (btnStop) btnStop.style.display = 'inline-flex';
                } else {
                    if (btnRun) btnRun.style.display = 'inline-flex';
                    if (btnStop) btnStop.style.display = 'none';
                }

                if (state.itemStates) {
                    Object.keys(state.itemStates).forEach(id => {
                        const item = state.itemStates[id];
                        let pStatus = 'ready';
                        let pct = 0;
                        if (item.status === 'processing' || item.status === 'downloading') {
                            pStatus = 'downloading';
                            pct = state.percent > 0 ? state.percent : 15;
                        } else if (item.status === 'completed') {
                            pStatus = 'completed';
                            pct = 100;
                        } else if (item.status === 'failed') {
                            pStatus = 'failed';
                            pct = 0;
                        } else if (item.status === 'pending' && isArabBatchRunning) {
                            pStatus = 'ready';
                            pct = 0;
                        }
                        arabPaperStateMap.set(id, {
                            status: pStatus,
                            progress: pct,
                            pages: item.pages || 0,
                            sizeMb: item.sizeMb || '0.00',
                            fileUrl: item.url || '',
                            error: item.error || ''
                        });
                    });
                }

                renderArabTable();
                updateArabSelectionCounter();

                if (!state.isRunning) {
                    if (arabBatchPollInterval) {
                        clearInterval(arabBatchPollInterval);
                        arabBatchPollInterval = null;
                    }
                    await fetchArabFiles();
                    renderArabTable();
                    updateArabSelectionCounter();
                }
            }
        } catch (_) {}
    }

    function startArabBatchPolling() {
        if (!arabBatchPollInterval) {
            checkServerArabBatchStatus();
            arabBatchPollInterval = setInterval(checkServerArabBatchStatus, 2000);
        }
    }

    async function executeArabBatch(specificIds = null) {
        let targetIds = [];
        if (specificIds && Array.isArray(specificIds)) {
            targetIds = specificIds;
        } else {
            const selectedCheckboxes = document.querySelectorAll('#tableBodyArab .chk-arab-select:checked');
            targetIds = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-id')).filter(Boolean);
        }

        if (targetIds.length === 0) {
            showToast('Please select at least one Arab newspaper edition to process.', 'error');
            return;
        }

        const dObj = getSelectedArabDateObj();
        const dateStr = dObj.formatted;

        isArabBatchRunning = true;
        const btnRun = document.getElementById('btnRunArabBatch');
        const btnStop = document.getElementById('btnStopArabBatch');
        if (btnRun) btnRun.style.display = 'none';
        if (btnStop) btnStop.style.display = 'inline-flex';

        targetIds.forEach(id => {
            arabPaperStateMap.set(id, { status: 'downloading', progress: 5, pages: 0, sizeMb: '0.00' });
        });
        renderArabTable();

        showToast(`Starting Arab Batch (${targetIds.length} editions)...`, 'info');

        try {
            const res = await fetch('/api/arab/process-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: dateStr,
                    editions: targetIds,
                    papers: targetIds
                })
            });

            const data = await res.json();
            if (res.status === 409) {
                showToast('Arab News batch is already running in background! Syncing progress...', 'info');
            } else if (!res.ok || !data.success) {
                throw new Error(data.error || `Server HTTP error ${res.status}`);
            }

            startArabBatchPolling();
        } catch (err) {
            showToast(`Error starting Arab batch: ${err.message}`, 'error');
            isArabBatchRunning = false;
            if (btnRun) btnRun.style.display = 'inline-flex';
            if (btnStop) btnStop.style.display = 'none';
        }
    }

    async function stopArabBatch() {
        try {
            await fetch('/api/arab/stop', { method: 'POST' });
            showToast('Stop request sent to Arab batch engine.', 'info');
        } catch (_) {}
    }

    window.processSingleArabNewspaper = function(paperId) {
        executeArabBatch([paperId]);
    };


async function fetchFiles() {
        try {
            const res = await fetch('/api/files', { headers: { 'Cache-Control': 'no-cache' } });
            const data = await res.json();
            if (data.success && Array.isArray(data.files)) {
                generatedFilesList = data.files;
                if (data.fileCategoriesMap) {
                    window.fileCategoriesMap = data.fileCategoriesMap;
                }
                const navCount = document.getElementById('navCountFiles');
                if (navCount) navCount.textContent = generatedFilesList.length;

                renderFilesAccordion();
                renderNewspaperTable();
                renderKhalikTable();
                if (typeof renderMagazinesGrid === 'function' && isMagazinesInitialized) {
                    renderMagazinesGrid();
                }
                if (typeof renderForeignPaperGrid === 'function' && typeof loadedFpPapers !== 'undefined' && loadedFpPapers && loadedFpPapers.length > 0) {
                    renderForeignPaperGrid(loadedFpPapers);
                }
                if (typeof renderIndianPaperGrid === 'function' && typeof loadedIndPapers !== 'undefined' && loadedIndPapers && loadedIndPapers.length > 0) {
                    renderIndianPaperGrid(loadedIndPapers);
                }
                if (typeof renderArabTable === 'function' && typeof isArabInitialized !== 'undefined' && isArabInitialized) {
                    renderArabTable();
                }
            }
        } catch (err) {
            console.error('[fetchFiles error]', err);
        }
    }

    let currentFilesFilter = 'all';

    function getFileCategory(file) {
        if (typeof file === 'object' && file && file.category) {
            return file.category;
        }
        const fn = typeof file === 'string' ? file : (file ? (file.name || file.filename || '') : '');
        if (!fn) return 'magazines';

        if (window.fileCategoriesMap && window.fileCategoriesMap[fn]) {
            return window.fileCategoriesMap[fn];
        }

        const lower = fn.toLowerCase();

        // 0. Watermark Stamper check (Files generated via Watermark Stamper tool)
        if (lower.includes('watermark') || lower.includes('[watermarked]') || lower.includes('_watermarked') || lower.includes('-watermark') || lower.includes('watermarked_') || fn.includes('²⁴⁰⁹')) {
            return 'watermark';
        }

        // 1. Indian Newspapers check
        const isIndian = 
            lower.includes('hindu analysis') ||
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

        if (isIndian) return 'indianpaper';

        // 2. Arab Newspapers check
        const isArab = 
            lower.includes('gulf times') ||
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

        if (isArab) return 'arabnews';

        // 3. Khaliq Newspapers check
        const isKhaliq = 
            lower.includes('92 columns') ||
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

        if (isKhaliq) return 'khalik';

        // 4. Pakistani Newspaper Hub check
        const isNewspaperHub = 
            lower.includes('dawn') ||
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

        if (isNewspaperHub) return 'newspaper_hub';

        // 5. Foreign Paper check
        const isForeignPaper = 
            lower.includes('wall street journal') ||
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

        if (isForeignPaper) return 'foreignpaper';

        return 'magazines';
    }

    function renderFilesAccordion() {
        const container = document.getElementById('filesContainer');
        if (!container) return;

        // Calculate Category Counts
        let hubCount = 0;
        let magCount = 0;
        let khalikCount = 0;
        let fpCount = 0;
        let indCount = 0;
        let arabCount = 0;
        let watermarkCount = 0;

        generatedFilesList.forEach(file => {
            const cat = getFileCategory(file);
            if (cat === 'newspaper_hub') hubCount++;
            else if (cat === 'magazines') magCount++;
            else if (cat === 'khalik') khalikCount++;
            else if (cat === 'foreignpaper') fpCount++;
            else if (cat === 'indianpaper') indCount++;
            else if (cat === 'arabnews') arabCount++;
            else if (cat === 'watermark') watermarkCount++;
        });

        const btnAll = document.getElementById('btnFilesFilterAll');
        const btnHub = document.getElementById('btnFilesFilterHub');
        const btnMag = document.getElementById('btnFilesFilterMag');
        const btnKhalik = document.getElementById('btnFilesFilterKhalik');
        const btnFp = document.getElementById('btnFilesFilterForeignPaper');
        const btnInd = document.getElementById('btnFilesFilterIndianPaper');
        const btnArab = document.getElementById('btnFilesFilterArabNews');
        const btnWm = document.getElementById('btnFilesFilterWatermark');

        if (btnAll) btnAll.textContent = `All PDFs (${generatedFilesList.length})`;
        if (btnHub) btnHub.textContent = `📰 Newspaper Hub (${hubCount})`;
        if (btnMag) btnMag.textContent = `📚 Free Magazines (${magCount})`;
        if (btnKhalik) btnKhalik.textContent = `👑 خالق / Khaliq (${khalikCount})`;
        if (btnFp) btnFp.textContent = `🌐 Foreign Paper (${fpCount})`;
        if (btnInd) btnInd.textContent = `🇮🇳 Indian Newspaper (${indCount})`;
        if (btnArab) btnArab.textContent = `🇸🇦 Arab News (${arabCount})`;
        if (btnWm) btnWm.textContent = `📄 Watermark Stamper (${watermarkCount})`;

        // Filter files if filter selected
        let filesToDisplay = generatedFilesList;
        if (currentFilesFilter !== 'all') {
            filesToDisplay = generatedFilesList.filter(f => getFileCategory(f) === currentFilesFilter);
        }

        if (filesToDisplay.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <h4>No PDFs Found</h4>
                    <p>No generated PDF files found for the selected view.</p>
                </div>
            `;
            return;
        }

        // Group files by publication date prefix
        const dateGroups = new Map();

        filesToDisplay.forEach(file => {
            const fName = file.filename || file.name || '';
            let dateKey = 'Other Files';

            const ymdMatch = fName.match(/^(\d{4}-\d{2}-\d{2})/);
            const dmyMatch = fName.match(/^(\d{1,2}-\d{1,2}-\d{4})/);
            const textDateMatch = fName.match(/^(\d{1,2}\s+[A-Za-z]{3})/);

            if (ymdMatch) {
                dateKey = ymdMatch[1];
            } else if (dmyMatch) {
                dateKey = dmyMatch[1];
            } else if (textDateMatch) {
                dateKey = textDateMatch[1];
            }

            if (!dateGroups.has(dateKey)) {
                dateGroups.set(dateKey, []);
            }
            dateGroups.get(dateKey).push(file);
        });

        container.innerHTML = '';

        dateGroups.forEach((files, dateKey) => {
            const totalSizeMb = files.reduce((acc, f) => acc + (parseFloat(f.sizeMb) || 0), 0).toFixed(2);
            const fileListJson = JSON.stringify(files.map(f => f.name || f.filename));

            // Separate files by sub-category for this date
            const indFiles = files.filter(f => getFileCategory(f) === 'indianpaper');
            const arabFiles = files.filter(f => getFileCategory(f) === 'arabnews');
            const fpFiles = files.filter(f => getFileCategory(f) === 'foreignpaper');
            const hubFiles = files.filter(f => getFileCategory(f) === 'newspaper_hub');
            const khalikFiles = files.filter(f => getFileCategory(f) === 'khalik');
            const magFiles = files.filter(f => getFileCategory(f) === 'magazines');
            const watermarkFiles = files.filter(f => getFileCategory(f) === 'watermark');

            const card = document.createElement('div');
            card.className = 'date-folder-card';
            card.style.marginBottom = '24px';

            const renderSubSection = (title, icon, badgeBg, filesList, catKey) => {
                if (filesList.length === 0) return '';
                const subSize = filesList.reduce((acc, f) => acc + (parseFloat(f.sizeMb) || 0), 0).toFixed(2);
                const catJson = JSON.stringify(filesList.map(f => f.name || f.filename));

                return `
                    <div class="category-subsection" style="margin-top: 14px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; background: var(--bg-card);">
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 16px;">${icon}</span>
                                <strong style="font-size: 14px; color: var(--text-primary);">${title}</strong>
                                <span class="badge" style="background: ${badgeBg}; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 700;">${filesList.length} Files • ${subSize} MB</span>
                            </div>
                            <div>
                                <button type="button" class="btn btn-sm btn-emerald btn-download-cat-zip" data-date-key="${escapeHtml(dateKey)}" data-cat="${catKey}" data-files='${escapeHtml(catJson)}' style="font-size: 12px; padding: 4px 10px; font-weight: 700;">
                                    📦 Download ${title} ZIP
                                </button>
                            </div>
                        </div>
                        <div class="date-folder-body" style="padding: 0;">
                            <table class="file-items-table">
                                <tbody>
                                    ${filesList.map(f => {
                                        const fn = f.name || f.filename || 'Edition.pdf';
                                        const pktTime = f.timeOnly || (f.createdAt ? new Date(f.createdAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '');
                                        const timeStr = pktTime ? `${pktTime} PKT` : '';
                                        const formattedTimeBadge = timeStr ? `<span class="file-time-badge" title="Generated Time: ${escapeHtml(f.createdAtFormatted || timeStr)}">🕒 ${escapeHtml(timeStr)}</span>` : '';
                                        return `
                                        <tr>
                                            <td>
                                                <div class="file-name-cell">
                                                    <svg class="file-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                    <span>${escapeHtml(fn)}</span>
                                                </div>
                                            </td>
                                            <td>${formattedTimeBadge}</td>
                                            <td><span class="file-size-badge">${f.sizeMb || '0.00'} MB</span></td>
                                            <td class="file-actions-cell">
                                                <button type="button" class="btn-file-action btn-preview-pdf" data-url="${escapeHtml(f.url)}" data-filename="${escapeHtml(fn)}">👁 View</button>
                                                <a href="${escapeHtml(f.url)}" download="${escapeHtml(fn)}" class="btn-file-action">⬇ PDF</a>
                                                <button type="button" class="btn-file-action btn-file-delete btn-file-delete-single" data-filename="${escapeHtml(fn)}">🗑 Delete</button>
                                            </td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            };

            card.innerHTML = `
                <div class="date-folder-header" style="padding: 14px 18px;">
                    <div class="date-folder-title-wrap">
                        <span class="date-badge" style="font-size: 15px; padding: 4px 12px;">${escapeHtml(dateKey)}</span>
                        <span class="date-stats-text">${files.length} Publications Total • ${totalSizeMb} MB</span>
                    </div>
                    <div class="date-folder-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" class="btn btn-sm btn-emerald btn-download-date-zip" data-date-key="${escapeHtml(dateKey)}">
                            📦 Download Full Date ZIP
                        </button>
                        <button type="button" class="btn-delete-date-pkg" data-date-key="${escapeHtml(dateKey)}">
                            🗑️ Delete Date Package
                        </button>
                    </div>
                </div>
                <div style="padding: 0 16px 16px 16px;">
                    ${renderSubSection('Newspaper Hub', '📰', '#6366f1', hubFiles, 'newspaper_hub')}
                    ${renderSubSection('Khaliq Newspapers', '👑', '#10b981', khalikFiles, 'khalik')}
                    ${renderSubSection('Arab News', '🇸🇦', '#ec4899', arabFiles, 'arabnews')}
                    ${renderSubSection('Indian Newspaper', '🇮🇳', '#f59e0b', indFiles, 'indianpaper')}
                    ${renderSubSection('Foreign Paper', '🌐', '#3b82f6', fpFiles, 'foreignpaper')}
                    ${renderSubSection('Free Magazines', '📚', '#8b5cf6', magFiles, 'magazines')}
                    ${renderSubSection('Watermark Stamper', '📄', '#f59e0b', watermarkFiles, 'watermark')}
                </div>
            `;

            // Attach event listeners safely
            const btnZip = card.querySelector('.btn-download-date-zip');
            if (btnZip) {
                btnZip.addEventListener('click', () => downloadDateZip(dateKey, 'all', fileListJson));
            }

            card.querySelectorAll('.btn-download-cat-zip').forEach(btn => {
                btn.addEventListener('click', () => {
                    const cat = btn.getAttribute('data-cat');
                    const catFiles = btn.getAttribute('data-files');
                    downloadDateZip(dateKey, cat, catFiles);
                });
            });

            const btnDelPkg = card.querySelector('.btn-delete-date-pkg');
            if (btnDelPkg) {
                btnDelPkg.addEventListener('click', () => executeDeleteDatePackage(dateKey, fileListJson));
            }

            card.querySelectorAll('.btn-preview-pdf').forEach(btn => {
                btn.addEventListener('click', () => {
                    previewPdfFile(btn.dataset.url, btn.dataset.filename);
                });
            });

            card.querySelectorAll('.btn-file-delete-single').forEach(btn => {
                btn.addEventListener('click', () => {
                    executeDeleteSingleFile(btn.dataset.filename);
                });
            });

            container.appendChild(card);
        });
    }

    // Attach event listeners for Category Filter Chips in tab-files
    document.querySelectorAll('[data-files-filter]').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('[data-files-filter]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilesFilter = chip.getAttribute('data-files-filter');
            renderFilesAccordion();
        });
    });

    // ── DELETE ACTIONS ───────────────────────────────────────────────────────
    window.executeDeleteDatePackage = async function(dateStr, encodedFilenames = '') {
        if (!dateStr) return;
        const confirmMsg = `Are you sure you want to delete all generated PDF files for "${dateStr}"?\n\nThis action cannot be undone.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            showToast(`Deleting PDF package for ${dateStr}...`, 'info');
            const filenames = encodedFilenames ? JSON.parse(decodeURIComponent(encodedFilenames)) : [];
            const res = await fetch(`/api/dates/${encodeURIComponent(dateStr)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
                body: JSON.stringify({ filenames })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✓ Deleted ${data.count || 0} PDF files for ${dateStr}.`, 'success');
                await fetchFiles();
                renderNewspaperTable();
            } else {
                showToast(data.error || 'Failed to delete date package', 'error');
            }
        } catch (err) {
            showToast(`Error deleting package: ${err.message}`, 'error');
        }
    };

    window.executeDeleteSingleFile = async function(filename) {
        if (!filename) return;
        if (!window.confirm(`Delete "${filename}"?`)) return;

        try {
            showToast(`Deleting ${filename}...`, 'info');
            const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✓ Deleted ${filename}`, 'success');
                await fetchFiles();
                renderNewspaperTable();
            } else {
                showToast(data.error || 'Failed to delete file', 'error');
            }
        } catch (err) {
            showToast(`Error deleting file: ${err.message}`, 'error');
        }
    };

    window.downloadDateZip = function(dateStr, category = 'all', filenamesParam = '') {
        let url = `/api/download-zip?date=${encodeURIComponent(dateStr)}&category=${encodeURIComponent(category)}`;
        if (filenamesParam) {
            const paramVal = typeof filenamesParam === 'string' ? filenamesParam : JSON.stringify(filenamesParam);
            url += `&filenames=${encodeURIComponent(paramVal)}`;
        }
        window.location.href = url;
    };

    window.previewPdfFile = function(url, encodedName) {
        const modal = document.getElementById('previewModal');
        const iframe = document.getElementById('pdfPreviewIframe');
        const titleLbl = document.getElementById('modalFileName');
        const downloadBtn = document.getElementById('modalDownloadBtn');

        if (titleLbl) titleLbl.textContent = decodeURIComponent(encodedName);
        if (iframe) iframe.src = url;
        if (downloadBtn) {
            downloadBtn.href = url;
            downloadBtn.download = decodeURIComponent(encodedName);
        }
        if (modal) modal.classList.add('open');
    };

    function closePdfModal() {
        const modal = document.getElementById('previewModal');
        const iframe = document.getElementById('pdfPreviewIframe');
        if (modal) modal.classList.remove('open');
        if (iframe) iframe.src = '';
    }

    // ── BROADSHEET CANVAS PREVIEW ────────────────────────────────────────────
    function drawBroadsheetMockup() {
        const canvas = document.getElementById('mockupCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Broadsheet Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(0, 0, w, h);

        const bannerText = document.getElementById('inputWatermarkText')?.value || 'Social Media Pakistan 0342-4938217';
        const enableTop = document.getElementById('chkEnableTop')?.checked !== false;
        const enableBottom = document.getElementById('chkEnableBottom')?.checked !== false;
        const enableDiagonal = document.getElementById('chkEnableDiagonal')?.checked === true;

        // Top Banner Margin
        if (enableTop) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, w, 32);
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 11px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('PAKISTAN E-PAPER MASTER  •  DAILY BROADSHEET', w / 2, 20);
        }

        // Mockup Newspaper Columns
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 16px Outfit, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('PRIME MINISTER ADDRESSES NATIONAL ASSEMBLY', 20, 65);

        ctx.fillStyle = '#64748b';
        ctx.fillRect(20, 80, 160, 90);

        ctx.fillStyle = '#94a3b8';
        for (let i = 0; i < 6; i++) {
            ctx.fillRect(195, 80 + (i * 16), 185, 8);
        }

        for (let col = 0; col < 3; col++) {
            for (let row = 0; row < 14; row++) {
                ctx.fillRect(20 + (col * 125), 190 + (row * 14), 110, 6);
            }
        }

        // Diagonal Watermark
        if (enableDiagonal) {
            ctx.save();
            ctx.translate(w / 2, h / 2);
            ctx.rotate(-Math.PI / 4);
            ctx.fillStyle = 'rgba(79, 70, 229, 0.15)';
            ctx.font = 'bold 22px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(bannerText, 0, 0);
            ctx.restore();
        }

        // Bottom WhatsApp Margin
        if (enableBottom) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, h - 34, w, 34);
            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 12px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(bannerText, w / 2, h - 13);
        }
    }

// ═══════════════════════════════════════════════════════════════════════════
    // FREE MAGAZINES ENGINE (FREEMAGAZINES.TOP)
    // ═══════════════════════════════════════════════════════════════════════════
    let currentMagDate = null;
    let loadedMagazines = [];
    let selectedMagTitles = new Set();
    let magCache = {};
    let currentModalMag = null;
    let isMagazinesInitialized = false;
    let isMagBatchRunning = false;
    let abortMagBatch = false;

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function updateMagazineSelectionUI() {
        const catSelect = document.getElementById('magCategorySelect');
        const searchBox = document.getElementById('magSearchBox');
        const selectedCat = catSelect ? catSelect.value : 'all';
        const query = searchBox ? searchBox.value.trim().toLowerCase() : '';

        const visibleMags = loadedMagazines.filter(m => {
            const matchCat = (selectedCat === 'all' || m.category === selectedCat);
            const matchQuery = (!query || m.title.toLowerCase().includes(query) || (m.category && m.category.toLowerCase().includes(query)));
            return matchCat && matchQuery;
        });

        const selectedInVisible = visibleMags.filter(m => selectedMagTitles.has(m.title)).length;

        const countLabel = document.getElementById('magSelectedCountLabel');
        if (countLabel) {
            countLabel.textContent = `${selectedMagTitles.size} Selected`;
        }

        const chkSelectAll = document.getElementById('chkSelectAllMagazines');
        if (chkSelectAll) {
            chkSelectAll.checked = visibleMags.length > 0 && selectedInVisible === visibleMags.length;
            chkSelectAll.indeterminate = selectedInVisible > 0 && selectedInVisible < visibleMags.length;
        }

        const btnDownloadAll = document.getElementById('btnDownloadAllMagazines');
        if (btnDownloadAll && !isMagBatchRunning) {
            if (selectedMagTitles.size === 0) {
                btnDownloadAll.innerHTML = `⚡ Download Selected (0)`;
            } else if (selectedMagTitles.size === loadedMagazines.length) {
                btnDownloadAll.innerHTML = `⚡ Download All (${loadedMagazines.length})`;
            } else {
                btnDownloadAll.innerHTML = `⚡ Download Selected (${selectedMagTitles.size})`;
            }
        }
    }

    function initMagazinesSection() { console.log("[Magazines] initMagazinesSection called!");
        if (typeof fetchFiles === 'function') {
            fetchFiles();
        }
        if (!currentMagDate) {
            const now = new Date();
            currentMagDate = now.toISOString().slice(0, 10);
        }

        const datePicker = document.getElementById('magDatePicker');
        if (datePicker && !datePicker.value) {
            datePicker.value = currentMagDate;
        }

        renderRecentArchiveList();

        if (!isMagazinesInitialized) {
            setupMagazineEvents();
            isMagazinesInitialized = true;
        }

        loadMagazinesForDate(currentMagDate);
    }

    function renderRecentArchiveList() {
        const listEl = document.getElementById('magArchiveList');
        if (!listEl) return;

        listEl.innerHTML = '';
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dIso = d.toISOString().slice(0, 10);
            const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });

            const row = document.createElement('div');
            row.className = `mag-archive-item ${dIso === currentMagDate ? 'active' : ''}`;
            row.innerHTML = `
                <span>${label}</span>
                <span class="mag-archive-badge">${i === 0 ? 'Latest' : (i === 1 ? 'Yesterday' : `${i}d ago`)}</span>
            `;
            row.addEventListener('click', () => {
                const picker = document.getElementById('magDatePicker');
                if (picker) picker.value = dIso;
                loadMagazinesForDate(dIso);
            });
            listEl.appendChild(row);
        }
    }

    function setupMagazineEvents() {
        const picker = document.getElementById('magDatePicker');
        if (picker) {
            picker.addEventListener('change', (e) => {
                if (e.target.value) {
                    loadMagazinesForDate(e.target.value);
                }
            });
        }

        const btnToday = document.getElementById('btnMagToday');
        if (btnToday) {
            btnToday.addEventListener('click', () => {
                const d = new Date().toISOString().slice(0, 10);
                if (picker) picker.value = d;
                loadMagazinesForDate(d);
            });
        }

        const btnYesterday = document.getElementById('btnMagYesterday');
        if (btnYesterday) {
            btnYesterday.addEventListener('click', () => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                const dIso = d.toISOString().slice(0, 10);
                if (picker) picker.value = dIso;
                loadMagazinesForDate(dIso);
            });
        }

        const btnPrevDay = document.getElementById('btnMagPrevDay');
        if (btnPrevDay) {
            btnPrevDay.addEventListener('click', () => {
                const d = new Date();
                d.setDate(d.getDate() - 2);
                const dIso = d.toISOString().slice(0, 10);
                if (picker) picker.value = dIso;
                loadMagazinesForDate(dIso);
            });
        }

        const btnRefresh = document.getElementById('btnRefreshMagazines');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                if (currentMagDate) {
                    delete magCache[currentMagDate];
                    loadMagazinesForDate(currentMagDate);
                }
            });
        }

        const catSelect = document.getElementById('magCategorySelect');
        if (catSelect) {
            catSelect.addEventListener('change', () => {
                renderMagazinesGrid();
            });
        }

        const searchBox = document.getElementById('magSearchBox');
        if (searchBox) {
            searchBox.addEventListener('input', () => {
                renderMagazinesGrid();
            });
        }

        const chkSelectAll = document.getElementById('chkSelectAllMagazines');
        if (chkSelectAll) {
            chkSelectAll.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const catSel = document.getElementById('magCategorySelect');
                const srchBox = document.getElementById('magSearchBox');
                const selectedCat = catSel ? catSel.value : 'all';
                const query = srchBox ? srchBox.value.trim().toLowerCase() : '';

                const visibleMags = loadedMagazines.filter(m => {
                    const matchCat = (selectedCat === 'all' || m.category === selectedCat);
                    const matchQuery = (!query || m.title.toLowerCase().includes(query) || (m.category && m.category.toLowerCase().includes(query)));
                    return matchCat && matchQuery;
                });

                if (isChecked) {
                    visibleMags.forEach(m => selectedMagTitles.add(m.title));
                } else {
                    visibleMags.forEach(m => selectedMagTitles.delete(m.title));
                }

                renderMagazinesGrid();
                updateMagazineSelectionUI();
            });
        }

        const btnDownloadAll = document.getElementById('btnDownloadAllMagazines');
        if (btnDownloadAll) {
            btnDownloadAll.addEventListener('click', () => {
                if (isMagBatchRunning) {
                    abortMagBatch = true;
                    btnDownloadAll.innerHTML = '⏳ Stopping...';
                } else {
                    startMagazinesBatchDownload();
                }
            });
        }

        const btnStopBatch = document.getElementById('btnStopMagBatch');
        if (btnStopBatch) {
            btnStopBatch.addEventListener('click', () => {
                abortMagBatch = true;
                const bAll = document.getElementById('btnDownloadAllMagazines');
                if (bAll) bAll.innerHTML = '⏳ Stopping...';
            });
        }

        // Modal controls
        const modalOverlay = document.getElementById('magazineModalOverlay');
        const btnClose = document.getElementById('btnMagModalClose');
        if (btnClose) {
            btnClose.addEventListener('click', () => {
                if (modalOverlay) modalOverlay.style.display = 'none';
            });
        }
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    modalOverlay.style.display = 'none';
                }
            });
        }

        const btnModalDownload = document.getElementById('btnMagModalDownload');
        if (btnModalDownload) {
            btnModalDownload.addEventListener('click', () => {
                if (currentModalMag) {
                    triggerDownload(currentModalMag, btnModalDownload, document.getElementById('magModalDownloadStatus'), document.getElementById('btnMagModalOpenPdf'));
                }
            });
        }
    }

    async function loadMagazinesForDate(dateStr) { console.log("[Magazines] loadMagazinesForDate called for", dateStr);
        currentMagDate = dateStr;
        renderRecentArchiveList();

        const grid = document.getElementById('magazinesGrid');
        const countLabel = document.getElementById('magTotalCountLabel');
        const dateLabel = document.getElementById('magCurrentDateLabel');
        const noticeBanner = document.getElementById('magNoticeBanner');
        const statusBadge = document.getElementById('magStatusBadge');

        if (dateLabel) dateLabel.textContent = dateStr;
        if (statusBadge) {
            statusBadge.className = 'badge-status badge-warning';
            statusBadge.textContent = 'Loading...';
        }

        if (grid) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
                    <div class="empty-icon">📚</div>
                    <h4>Loading Magazines for ${dateStr}...</h4>
                    <p>Connecting to FreeMagazines.top live feed and fetching cover thumbnails.</p>
                </div>
            `;
        }

        if (noticeBanner) noticeBanner.style.display = 'none';

        if (magCache[dateStr]) {
            loadedMagazines = magCache[dateStr];
            finalizeMagazinesRender(loadedMagazines, dateStr, false);
            return;
        }

        try {
            const res = await fetch(`/api/magazines/by-date?date=${encodeURIComponent(dateStr)}`);
            const data = await res.json();

            if (data.success && Array.isArray(data.magazines)) {
                loadedMagazines = data.magazines;
                magCache[data.date] = loadedMagazines;
                
                const usedFallback = data.requestedDate && data.requestedDate !== data.date;
                if (usedFallback && noticeBanner) {
                    noticeBanner.innerHTML = `ℹ️ No magazines were published for <strong>${data.requestedDate}</strong> yet. Automatically displaying the latest available publication archive (<strong>${data.date}</strong>) with ${data.magazines.length} issues.`;
                    noticeBanner.style.display = 'block';
                    currentMagDate = data.date;
                    const picker = document.getElementById('magDatePicker');
                    if (picker) picker.value = data.date;
                }

                finalizeMagazinesRender(loadedMagazines, data.date, usedFallback);
            } else {
                throw new Error(data.error || 'Failed to load magazines.');
            }
        } catch (err) {
            console.error('[FreeMagazines] Error:', err);
            if (grid) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
                        <div class="empty-icon" style="color: #ef4444;">⚠️</div>
                        <h4>Failed to Load Magazines</h4>
                        <p>${err.message}</p>
                        <button type="button" class="btn btn-secondary btn-sm" style="margin-top: 12px;" onclick="loadMagazinesForDate('${dateStr}')">Retry</button>
                    </div>
                `;
            }
            if (statusBadge) {
                statusBadge.className = 'badge-status badge-danger';
                statusBadge.textContent = 'Error';
            }
        }
    }

    function finalizeMagazinesRender(mags, dateStr, isFallback) {
        const countLabel = document.getElementById('magTotalCountLabel');
        const dateLabel = document.getElementById('magCurrentDateLabel');
        const statusBadge = document.getElementById('magStatusBadge');
        const navCount = document.getElementById('navCountMagazines');

        if (dateLabel) dateLabel.textContent = dateStr;
        if (countLabel) countLabel.textContent = `${mags.length} Issues`;
        if (navCount) navCount.textContent = mags.length;

        selectedMagTitles = new Set(mags.map(m => m.title));
        updateMagazineSelectionUI();

        if (statusBadge) {
            statusBadge.className = 'badge-status badge-success';
            statusBadge.textContent = 'Ready';
        }

        // Populate Categories in dropdown
        const catSelect = document.getElementById('magCategorySelect');
        if (catSelect) {
            const currentCat = catSelect.value;
            const categories = Array.from(new Set(mags.map(m => m.category || 'General'))).sort();
            catSelect.innerHTML = '<option value="all">All Categories (All Magazines)</option>';
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = `${cat} (${mags.filter(m => m.category === cat).length})`;
                catSelect.appendChild(opt);
            });
            if (categories.includes(currentCat)) {
                catSelect.value = currentCat;
            }
        }

        renderMagazinesGrid();
    }

    function createMagazineCoverHtml(mag) {
        const cat = (mag.category || 'General').toLowerCase();
        let grad = 'linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #334155 100%)';
        let accent = '#94a3b8';
        let icon = '📖';

        if (cat.includes('decor') || cat.includes('home') || cat.includes('architect')) {
            grad = 'linear-gradient(145deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)';
            accent = '#a5b4fc';
            icon = '🏛️';
        } else if (cat.includes('truck') || cat.includes('car') || cat.includes('auto')) {
            grad = 'linear-gradient(145deg, #450a0a 0%, #7f1d1d 60%, #991b1b 100%)';
            accent = '#fca5a5';
            icon = '🚗';
        } else if (cat.includes('bike') || cat.includes('motorcycle') || cat.includes('cycle')) {
            grad = 'linear-gradient(145deg, #431407 0%, #7c2d12 60%, #9a3412 100%)';
            accent = '#fdba74';
            icon = '🏍️';
        } else if (cat.includes('woman') || cat.includes('fashion') || cat.includes('lifestyle')) {
            grad = 'linear-gradient(145deg, #500724 0%, #831843 60%, #9d174d 100%)';
            accent = '#f9a8d4';
            icon = '✨';
        } else if (cat.includes('tech') || cat.includes('computer') || cat.includes('science')) {
            grad = 'linear-gradient(145deg, #082f49 0%, #0369a1 60%, #0284c7 100%)';
            accent = '#7dd3fc';
            icon = '💻';
        } else if (cat.includes('food') || cat.includes('cook') || cat.includes('baking')) {
            grad = 'linear-gradient(145deg, #451a03 0%, #78350f 60%, #92400e 100%)';
            accent = '#fcd34d';
            icon = '';
        } else if (cat.includes('music') || cat.includes('audio')) {
            grad = 'linear-gradient(145deg, #3b0764 0%, #581c87 60%, #6b21a8 100%)';
            accent = '#d8b4fe';
            icon = '🎵';
        } else if (cat.includes('sport')) {
            grad = 'linear-gradient(145deg, #064e3b 0%, #065f46 60%, #047857 100%)';
            accent = '#6ee7b7';
            icon = '⚽';
        }

        const titleEsc = escapeHtml(mag.title);
        const catEsc = escapeHtml(mag.category || 'Digital Edition');

        const fallback = '<div class="mag-cover-fallback" style="background: ' + grad + '; position: absolute; inset: 0; padding: 18px 14px; display: flex; flex-direction: column; justify-content: space-between; text-align: left; box-sizing: border-box; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">' +
            '<div style="display: flex; justify-content: space-between; align-items: flex-start; z-index: 1;">' +
                '<span style="font-size: 0.65rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: ' + accent + '; background: rgba(0,0,0,0.3); padding: 3px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">' + catEsc + '</span>' +
                '<span style="font-size: 1.25rem;">' + icon + '</span>' +
            '</div>' +
            '<div style="z-index: 1; margin: auto 0;">' +
                '<div style="font-size: 0.65rem; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">DIGITAL MAGAZINE</div>' +
                '<div style="font-size: 1.02rem; font-weight: 800; line-height: 1.25; color: #ffffff; text-shadow: 0 2px 8px rgba(0,0,0,0.8);">' + titleEsc + '</div>' +
            '</div>' +
            '<div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 8px; z-index: 1;">' +
                '<span style="font-size: 0.68rem; color: rgba(255,255,255,0.8); font-weight: 600;">' + (mag.pages ? mag.pages + ' pages' : 'Complete') + '</span>' +
                '<span style="font-size: 0.68rem; font-weight: 700; color: #34d399; background: rgba(16,185,129,0.2); padding: 2px 6px; border-radius: 4px;">True PDF</span>' +
            '</div>' +
        '</div>';

        if (mag.coverImage) {
            return '<img src="' + mag.coverImage + '" class="mag-cover-img" alt="' + titleEsc + '" loading="lazy" onerror="this.style.display=\'none\'; const fb = this.parentElement.querySelector(\'.mag-cover-fallback\'); if(fb) fb.style.display=\'flex\';">' + 
                   fallback.replace('display: flex;', 'display: none;');
        } else {
            return fallback;
        }
    }
    function findMatchingGeneratedPdf(mag, fileList, expectedCategory) {
        if (!Array.isArray(fileList) || fileList.length === 0 || !mag || !mag.title) {
            return null;
        }

        let candidateList = fileList;
        if (expectedCategory) {
            candidateList = fileList.filter(f => getFileCategory(f) === expectedCategory);
        } else {
            candidateList = fileList.filter(f => getFileCategory(f) !== 'watermark');
        }

        const cleanT = mag.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!cleanT) return null;

        // 1. Direct substring match on normalized filename (exact normalized title sequence)
        let match = candidateList.find(f => {
            const fn = (f.filename || f.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return fn.includes(cleanT);
        });
        if (match) return match;

        // 2. Reverse match: normalized filename (without date & extension) is contained in normalized title
        match = candidateList.find(f => {
            const fnClean = (f.filename || f.name || '')
                .toLowerCase()
                .replace(/\.pdf$/i, '')
                .replace(/^\d{2,4}[-._]?\d{2}[-._]?\d{2,4}\s*/, '')
                .replace(/[^a-z0-9]/g, '');
            return fnClean.length > 8 && cleanT.includes(fnClean);
        });
        if (match) return match;

        // 3. Strict Word Overlap: ALL significant words from mag.title must be present in the candidate filename
        const stopWords = new Set(['the', 'and', 'for', 'magazine', 'pdf', 'digital', 'issue', 'a', 'an', 'of', 'in', 'on', 'with', 'by']);
        const words = mag.title.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 2 && !stopWords.has(w));
        
        if (words.length > 0) {
            match = candidateList.find(f => {
                const fnLower = (f.filename || f.name || '').toLowerCase();
                return words.every(w => fnLower.includes(w));
            });
        }
        return match || null;
    }

    function renderMagazinesGrid() {
        const grid = document.getElementById('magazinesGrid');
        if (!grid) return;

        const catSelect = document.getElementById('magCategorySelect');
        const searchBox = document.getElementById('magSearchBox');

        const selectedCat = catSelect ? catSelect.value : 'all';
        const query = searchBox ? searchBox.value.trim().toLowerCase() : '';

        let filtered = loadedMagazines.filter(m => {
            const matchCat = (selectedCat === 'all' || m.category === selectedCat);
            const matchQuery = (!query || m.title.toLowerCase().includes(query) || (m.category && m.category.toLowerCase().includes(query)));
            return matchCat && matchQuery;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
                    <div class="empty-icon">🔍</div>
                    <h4>No Magazines Found</h4>
                    <p>No magazine issues match your selected category or search term for this date.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        filtered.forEach(mag => {
            const card = document.createElement('div');
            card.className = 'magazine-card';
            card.dataset.magTitle = mag.title;

            const downloadedPdf = findMatchingGeneratedPdf(mag, generatedFilesList, 'magazines');
            const isDownloaded = !!downloadedPdf;

            const coverImg = createMagazineCoverHtml(mag);
            const isSelected = selectedMagTitles.has(mag.title);

            const metaText = [
                mag.pages ? `${mag.pages} pages` : null,
                mag.size ? mag.size : null
            ].filter(Boolean).join(' • ') || 'Complete Issue';

            const alreadyGeneratedBadgeHtml = isDownloaded ? `
                <div class="mag-already-generated-badge" style="position: absolute; top: 10px; right: 10px; z-index: 10; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4); display: flex; align-items: center; gap: 4px; border: 1px solid rgba(255,255,255,0.3);">
                    <span>✓ PDF Already Generated</span>
                </div>
            ` : '';

            const alreadyInPdfLibBannerHtml = isDownloaded ? `
                <div style="font-size: 0.75rem; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.25); padding: 4px 8px; border-radius: 6px; margin-top: 6px; display: flex; align-items: center; gap: 5px;">
                    <span>⚡ File in Generated PDFs Library (${downloadedPdf.sizeMb ? downloadedPdf.sizeMb + ' MB' : 'Ready'})</span>
                </div>
            ` : '';

            card.innerHTML = `
                <div class="mag-cover-container" style="position: relative;">
                    <div class="mag-card-checkbox-wrap" style="position: absolute; top: 10px; left: 10px; z-index: 10;">
                        <input type="checkbox" class="mag-item-checkbox" data-mag-title="${escapeHtml(mag.title)}" ${isSelected ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: #10b981; box-shadow: 0 2px 8px rgba(0,0,0,0.6);">
                    </div>
                    ${alreadyGeneratedBadgeHtml}
                    ${coverImg}
                    <span class="mag-cover-badge" style="${isDownloaded ? 'background:#059669; color:#fff;' : ''}">
                        ${isDownloaded ? '✓ Generated PDF' : 'True PDF'}
                    </span>
                </div>
                <div class="mag-card-body">
                    <div>
                        <span class="mag-badge">${escapeHtml(mag.category || 'General')}</span>
                    </div>
                    <h4 class="mag-card-title" title="${escapeHtml(mag.title)}">${escapeHtml(mag.title)}</h4>
                    <div class="mag-card-meta">
                        <span>📅 ${mag.date || currentMagDate}</span>
                        <span>📄 ${metaText}</span>
                    </div>
                    ${alreadyInPdfLibBannerHtml}
                    <div class="mag-card-footer">
                        <button type="button" class="btn-magazine-download" style="${isDownloaded ? 'background:#059669; color:#ffffff; font-weight: 700; border: none; box-shadow: 0 2px 8px rgba(5,150,105,0.3);' : ''}">
                            ${isDownloaded ? `✓ PDF Already Generated (${downloadedPdf.sizeMb ? downloadedPdf.sizeMb + ' MB' : 'Ready'})` : '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download PDF'}
                        </button>
                    </div>
                </div>
            `;

            // Checkbox change handler
            const chkItem = card.querySelector('.mag-item-checkbox');
            if (chkItem) {
                chkItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                chkItem.addEventListener('change', (e) => {
                    e.stopPropagation();
                    if (e.target.checked) {
                        selectedMagTitles.add(mag.title);
                    } else {
                        selectedMagTitles.delete(mag.title);
                    }
                    updateMagazineSelectionUI();
                });
            }

            // Clicking cover or title opens modal
            const coverEl = card.querySelector('.mag-cover-container');
            const titleEl = card.querySelector('.mag-card-title');
            [coverEl, titleEl].forEach(el => {
                el.addEventListener('click', () => openMagazineModal(mag));
            });

            // Clicking download button directly
            const dlBtn = card.querySelector('.btn-magazine-download');
            dlBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                triggerDownload(mag, dlBtn);
            });

            grid.appendChild(card);
        });

        updateMagazineSelectionUI();
    }

    function openMagazineModal(mag) {
        currentModalMag = mag;
        const modal = document.getElementById('magazineModalOverlay');
        if (!modal) return;

        const downloadedPdf = findMatchingGeneratedPdf(mag, generatedFilesList, 'magazines');
        const isDownloaded = !!downloadedPdf;

        const coverWrap = document.querySelector('.mag-modal-cover-wrap');
        const titleEl = document.getElementById('magModalTitle');
        const catEl = document.getElementById('magModalCategory');
        const dateEl = document.getElementById('magModalDate');
        const pagesEl = document.getElementById('magModalPages');
        const sizeEl = document.getElementById('magModalSize');
        const btnDl = document.getElementById('btnMagModalDownload');
        const btnOpen = document.getElementById('btnMagModalOpenPdf');
        const statusEl = document.getElementById('magModalDownloadStatus');

        if (coverWrap) {
            coverWrap.innerHTML = createMagazineCoverHtml(mag);
        }
        if (titleEl) titleEl.textContent = mag.title;
        if (catEl) catEl.textContent = mag.category || 'General';
        if (dateEl) dateEl.textContent = mag.date || currentMagDate;
        if (pagesEl) pagesEl.textContent = mag.pages ? `${mag.pages} broadsheet pages` : 'Complete Edition';
        if (sizeEl) sizeEl.textContent = mag.size || 'Digital PDF';

        if (btnDl) {
            btnDl.disabled = false;
            if (isDownloaded) {
                btnDl.className = 'btn btn-emerald btn-lg';
                btnDl.innerHTML = `✓ PDF Already Generated (${downloadedPdf.sizeMb ? downloadedPdf.sizeMb + ' MB' : 'In Library'})`;
            } else {
                btnDl.className = 'btn btn-emerald btn-lg';
                btnDl.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download PDF Magazine`;
            }
        }

        if (btnOpen) {
            if (isDownloaded && downloadedPdf.url) {
                btnOpen.href = downloadedPdf.url;
                btnOpen.style.display = 'inline-flex';
                btnOpen.innerHTML = `📂 View Existing PDF (${downloadedPdf.sizeMb || ''} MB)`;
            } else {
                btnOpen.style.display = 'none';
            }
        }
        if (statusEl) {
            if (isDownloaded) {
                statusEl.style.display = 'block';
                const statusTxt = statusEl.querySelector('#magModalDownloadStatusText');
                if (statusTxt) statusTxt.innerHTML = `✅ <strong>${escapeHtml(downloadedPdf.name || downloadedPdf.filename || mag.title)}</strong> is already generated and saved in Generated PDFs Library!`;
            } else {
                statusEl.style.display = 'none';
            }
        }

        modal.style.display = 'flex';
    }

    async function triggerDownload(mag, btnEl, statusEl = null, openBtnEl = null) {
        if (!mag.downloadUrl) {
            alert('No download link found for this issue.');
            return;
        }

        const originalHtml = btnEl.innerHTML;
        btnEl.disabled = true;
        btnEl.classList.add('downloading');
        btnEl.innerHTML = `<span class="spinner-small" style="display:inline-block;width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Downloading PDF...`;

        if (statusEl) {
            statusEl.style.display = 'block';
            const statusTxt = statusEl.querySelector('#magModalDownloadStatusText');
            if (statusTxt) statusTxt.textContent = `Connecting to LimeWire & downloading ${mag.title}...`;
        }

        try {
            const res = await fetch('/api/magazines/download-issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: mag.title,
                    downloadUrl: mag.downloadUrl,
                    coverImage: mag.coverImage,
                    date: mag.date || currentMagDate
                })
            });

            const data = await res.json();
            if (data.success && data.url) {
                btnEl.className = 'btn btn-primary btn-lg';
                btnEl.innerHTML = `✓ Download Complete (${data.sizeMb} MB)`;
                btnEl.disabled = false;

                if (statusEl) {
                    const statusTxt = statusEl.querySelector('#magModalDownloadStatusText');
                    if (statusTxt) statusTxt.innerHTML = `✅ <strong>${escapeHtml(data.filename)}</strong> downloaded successfully (${data.sizeMb} MB)!`;
                }

                if (openBtnEl) {
                    openBtnEl.href = data.url;
                    openBtnEl.style.display = 'inline-flex';
                }

                // Automatic file trigger for direct user saving
                const tempLink = document.createElement('a');
                tempLink.href = data.url;
                tempLink.download = data.filename;
                document.body.appendChild(tempLink);
                tempLink.click();
                document.body.removeChild(tempLink);

                // Update Generated PDFs count
                if (typeof fetchFiles === 'function') fetchFiles();
            } else {
                throw new Error(data.error || 'Download failed');
            }
        } catch (err) {
            console.error('[Download Error]:', err);
            btnEl.disabled = false;
            btnEl.classList.remove('downloading');
            btnEl.innerHTML = `⚠️ Download Failed (Retry)`;
            if (statusEl) {
                const statusTxt = statusEl.querySelector('#magModalDownloadStatusText');
                if (statusTxt) statusTxt.textContent = `Error: ${err.message}`;
            }
        }
    }


    function findMagazineCardButton(title) {
        if (!title) return null;
        const cards = document.querySelectorAll('.magazine-card');
        const norm = title.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const c of cards) {
            const cardT = c.dataset.magTitle || '';
            if (cardT === title || (cardT && cardT.toLowerCase().replace(/[^a-z0-9]/g, '') === norm)) {
                return c.querySelector('.btn-magazine-download');
            }
        }
        return null;
    }

    let magPollInterval = null;
    let batchPollInterval = null;

    async function checkServerMagBatchStatus() {
        try {
            const res = await fetch('/api/magazines/status', { headers: { 'Cache-Control': 'no-cache' } });
            const data = await res.json();
            if (data.success && data.state) {
                const state = data.state;
                const banner = document.getElementById('magBatchProgressBanner');
                const currentTitleEl = document.getElementById('magBatchCurrentTitle');
                const counterEl = document.getElementById('magBatchCounter');
                const barEl = document.getElementById('magBatchProgressBar');
                const btnAll = document.getElementById('btnDownloadAllMagazines');

                if (state.isRunning) {
                    isMagBatchRunning = true;
                    if (banner) banner.style.display = 'block';
                    if (currentTitleEl) currentTitleEl.textContent = state.currentTitle ? `Downloading: ${state.currentTitle}` : 'Downloading magazines in background...';
                    if (counterEl) counterEl.textContent = `${state.completedCount} / ${state.total}`;
                    if (barEl) barEl.style.width = `${state.percent}%`;
                    if (btnAll) {
                        btnAll.className = 'btn btn-warning';
                        btnAll.innerHTML = `⏹️ Stop (${state.completedCount}/${state.total})`;
                    }

                    if (state.itemStates) {
                        Object.keys(state.itemStates).forEach(title => {
                            const item = state.itemStates[title];
                            const cardBtn = findMagazineCardButton(title);
                            if (cardBtn) {
                                if (item.status === 'downloading') {
                                    cardBtn.disabled = true;
                                    cardBtn.innerHTML = '<span class="spinner-small" style="display:inline-block;width:12px;height:12px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Downloading...';
                                } else if (item.status === 'completed') {
                                    cardBtn.className = 'btn-magazine-download success';
                                    cardBtn.style.background = '#059669';
                                    cardBtn.style.color = '#ffffff';
                                    cardBtn.innerHTML = `✓ Ready (${item.sizeMb || 'PDF'})`;
                                    cardBtn.disabled = false;
                                } else if (item.status === 'failed') {
                                    cardBtn.disabled = false;
                                    cardBtn.innerHTML = '⚠️ Retry';
                                }
                            }
                        });
                    }

                    if (!magPollInterval) {
                        magPollInterval = setInterval(checkServerMagBatchStatus, 2000);
                    }
                } else {
                    if (isMagBatchRunning) {
                        isMagBatchRunning = false;
                        if (banner && state.total > 0) {
                            if (currentTitleEl) currentTitleEl.innerHTML = `🎉 <strong>Complete!</strong> Downloaded ${state.completedCount}/${state.total} magazine PDFs.`;
                            if (barEl) barEl.style.width = '100%';
                        }
                        if (typeof fetchFiles === 'function') fetchFiles();
                        updateMagazineSelectionUI();
                    }
                    if (magPollInterval) {
                        clearInterval(magPollInterval);
                        magPollInterval = null;
                    }
                }
            }
        } catch (_) {}
    }

    async function stopServerMagBatch() {
        try {
            await fetch('/api/magazines/stop', { method: 'POST' });
            showToast('Stop request sent to magazine download engine.', 'info');
        } catch (_) {}
    }

    async function startMagazinesBatchDownload() {
        if (isMagBatchRunning) {
            stopServerMagBatch();
            return;
        }

        const magsToDownload = loadedMagazines.filter(m => selectedMagTitles.has(m.title));
        if (!magsToDownload || magsToDownload.length === 0) {
            alert('Please select at least one magazine issue to download.');
            return;
        }

        try {
            showToast(`Initiating background download for ${magsToDownload.length} magazine issue(s)...`, 'info');
            const res = await fetch('/api/magazines/process-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: currentMagDate,
                    magazines: magsToDownload
                })
            });
            const data = await res.json();
            if (data.success) {
                isMagBatchRunning = true;
                checkServerMagBatchStatus();
                if (!magPollInterval) {
                    magPollInterval = setInterval(checkServerMagBatchStatus, 2000);
                }
            } else {
                showToast(data.error || 'Failed to start magazine batch download', 'error');
            }
        } catch (err) {
            showToast(`Error starting magazine batch: ${err.message}`, 'error');
        }
    }

    async function checkServerBatchStatus() {
        try {
            const res = await fetch('/api/batch/status', { headers: { 'Cache-Control': 'no-cache' } });
            const data = await res.json();
            if (data.success && data.state) {
                const state = data.state;
                if (state.isRunning) {
                    isBatchRunning = true;
                    const btnStart = document.getElementById('btnStartBatch');
                    const btnStop = document.getElementById('btnStopBatch');
                    const mainBar = document.getElementById('mainProgressBar');
                    const lblPct = document.getElementById('lblProgressPercent');
                    const consoleBox = document.getElementById('consoleBox');

                    if (btnStart) btnStart.style.display = 'none';
                    if (btnStop) btnStop.style.display = 'inline-flex';
                    if (mainBar) mainBar.style.width = `${state.percent || 0}%`;
                    if (lblPct) lblPct.textContent = `${state.percent || 0}%`;

                    if (consoleBox && Array.isArray(state.logs) && state.logs.length > 0) {
                        consoleBox.innerHTML = '';
                        state.logs.forEach(log => {
                            const div = document.createElement('div');
                            div.className = `console-line ${log.status === 'success' ? 'text-success' : (log.status === 'error' ? 'text-error' : '')}`;
                            div.textContent = `[${log.time || new Date().toLocaleTimeString()}] ${log.message}`;
                            consoleBox.appendChild(div);
                        });
                        consoleBox.scrollTop = consoleBox.scrollHeight;
                    }

                    if (state.paperStates) {
                        Object.keys(state.paperStates).forEach(paperId => {
                            paperStateMap.set(paperId, state.paperStates[paperId]);
                        });
                    }
                    renderNewspaperTable();

                    if (!batchPollInterval) {
                        batchPollInterval = setInterval(checkServerBatchStatus, 2000);
                    }
                } else {
                    if (isBatchRunning) {
                        isBatchRunning = false;
                        const btnStart = document.getElementById('btnStartBatch');
                        const btnStop = document.getElementById('btnStopBatch');
                        if (btnStart) btnStart.style.display = 'inline-flex';
                        if (btnStop) btnStop.style.display = 'none';
                        await fetchFiles();
                        renderNewspaperTable();
                    }
                    if (batchPollInterval) {
                        clearInterval(batchPollInterval);
                        batchPollInterval = null;
                    }
                }
            }
        } catch (_) {}
    }

    function initPinLockSystem() {
        const overlay = document.getElementById('pinLockOverlay');
        const form = document.getElementById('pinLockForm');
        const input = document.getElementById('inputPinCode');
        const errorMsg = document.getElementById('pinErrorMsg');
        const btnLock = document.getElementById('btnLockApp');

        function checkUnlockState() {
            const unlocked = localStorage.getItem('appPinUnlocked') === 'true';
            if (unlocked) {
                if (overlay) overlay.style.display = 'none';
            } else {
                if (overlay) {
                    overlay.style.display = 'flex';
                    if (input) setTimeout(() => input.focus(), 100);
                }
            }
        }

        if (form && input) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const pin = input.value.trim();
                if (pin === '5712') {
                    localStorage.setItem('appPinUnlocked', 'true');
                    if (errorMsg) errorMsg.style.display = 'none';
                    if (overlay) {
                        overlay.style.opacity = '0';
                        overlay.style.transition = 'opacity 0.3s ease';
                        setTimeout(() => {
                            overlay.style.display = 'none';
                            overlay.style.opacity = '1';
                        }, 300);
                    }
                    showToast('🔓 PIN Verified. Hub Unlocked!', 'success');
                } else {
                    if (errorMsg) errorMsg.style.display = 'block';
                    input.style.borderColor = '#f43f5e';
                    input.value = '';
                    setTimeout(() => { input.style.borderColor = ''; }, 1500);
                }
            });
        }

        if (btnLock) {
            btnLock.addEventListener('click', () => {
                localStorage.removeItem('appPinUnlocked');
                if (input) input.value = '';
                if (errorMsg) errorMsg.style.display = 'none';
                checkUnlockState();
                showToast('🔒 Application Locked', 'info');
            });
        }

        checkUnlockState();
    }

    // ── INITIALIZATION ON DOM READY ──────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        // 1. Setup Publication Date Picker
        const inputDate = document.getElementById('inputDate');
        if (inputDate) {
            inputDate.value = formatDateYMD(currentSelectedDate);
            inputDate.addEventListener('change', () => {
                const parts = inputDate.value.split('-');
                if (parts.length === 3) {
                    currentSelectedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                }
                const btnToday = document.getElementById('btnDateToday');
                const btnYesterday = document.getElementById('btnDateYesterday');
                if (btnToday) btnToday.classList.remove('active');
                if (btnYesterday) btnYesterday.classList.remove('active');
                renderNewspaperTable();
                renderKhalikTable();
                loadArabCatalog();
                fetchFiles();
            });
        }

        // Today / Yesterday Buttons
        const btnToday = document.getElementById('btnDateToday');
        const btnYesterday = document.getElementById('btnDateYesterday');

        if (btnToday) {
            btnToday.addEventListener('click', () => {
                btnToday.classList.add('active');
                if (btnYesterday) btnYesterday.classList.remove('active');
                currentSelectedDate = new Date();
                if (inputDate) inputDate.value = formatDateYMD(currentSelectedDate);
                renderNewspaperTable();
                renderKhalikTable();
                loadArabCatalog();
                fetchFiles();
            });
        }

        if (btnYesterday) {
            btnYesterday.addEventListener('click', () => {
                btnYesterday.classList.add('active');
                if (btnToday) btnToday.classList.remove('active');
                const d = new Date();
                d.setDate(d.getDate() - 1);
                currentSelectedDate = d;
                if (inputDate) inputDate.value = formatDateYMD(currentSelectedDate);
                renderNewspaperTable();
                renderKhalikTable();
                fetchFiles();
            });
        }

        // 2. Navigation Tab Switching
        document.querySelectorAll('.sidebar-nav a[data-tab]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = a.getAttribute('data-tab');
                switchTab(tab);
            });
        });

        // 3. Category Filter Chips
        document.querySelectorAll('.tab-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.tab-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentCategoryFilter = chip.getAttribute('data-filter') || 'all';
                renderNewspaperTable();
            });
        });

        // 4. Select All / Clear
        const chkMaster = document.getElementById('chkMasterTable');
        if (chkMaster) {
            chkMaster.addEventListener('change', () => {
                document.querySelectorAll('#tableBodyNewspapers tr').forEach(tr => {
                    if (tr.style.display !== 'none') {
                        const c = tr.querySelector('.chk-paper-select');
                        if (c) c.checked = chkMaster.checked;
                    }
                });
                updateSelectionCounter();
            });
        }

        const btnSelAll = document.getElementById('btnSelectAll');
        if (btnSelAll) {
            btnSelAll.addEventListener('click', () => {
                document.querySelectorAll('#tableBodyNewspapers tr').forEach(tr => {
                    if (tr.style.display !== 'none') {
                        const c = tr.querySelector('.chk-paper-select');
                        if (c) c.checked = true;
                    }
                });
                if (chkMaster) chkMaster.checked = true;
                updateSelectionCounter();
            });
        }

        const btnDeselAll = document.getElementById('btnDeselectAll');
        if (btnDeselAll) {
            btnDeselAll.addEventListener('click', () => {
                document.querySelectorAll('#tableBodyNewspapers tr').forEach(tr => {
                    if (tr.style.display !== 'none') {
                        const c = tr.querySelector('.chk-paper-select');
                        if (c) c.checked = false;
                    }
                });
                if (chkMaster) chkMaster.checked = false;
                updateSelectionCounter();
            });
        }

        // 5. Batch & Header Buttons
        const btnRunArab = document.getElementById('btnRunArabBatch');
        if (btnRunArab) {
            btnRunArab.addEventListener('click', () => {
                executeArabBatch();
            });
        }

        const btnStopArab = document.getElementById('btnStopArabBatch');
        if (btnStopArab) {
            btnStopArab.addEventListener('click', () => {
                stopArabBatch();
            });
        }

        const searchArab = document.getElementById('searchInputArab');
        if (searchArab) {
            searchArab.addEventListener('input', () => {
                renderArabTable();
            });
        }

        const dateArab = document.getElementById('dateSelectArab');
        if (dateArab) {
            dateArab.addEventListener('change', () => {
                renderArabTable();
            });
        }

        const tbodyArab = document.getElementById('tableBodyArab');
        if (tbodyArab) {
            tbodyArab.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-process-arab');
                if (btn) {
                    const id = btn.getAttribute('data-id');
                    if (id) executeArabBatch([id]);
                }
            });
        }

        const btnStart = document.getElementById('btnStartBatch');
        if (btnStart) btnStart.addEventListener('click', () => executeBatch());

        const btnSidebarBatch = document.getElementById('btnSidebarRunBatch');
        if (btnSidebarBatch) {
            btnSidebarBatch.addEventListener('click', () => {
                const activePane = document.querySelector('.tab-pane.active');
                if (activePane && activePane.id === 'tab-khalik') {
                    executeKhalikBatch();
                } else {
                    switchTab('tab-hub');
                    executeBatch();
                }
            });
        }

        const handleStopBatch = async () => {
            try {
                await fetch('/api/batch/stop', { method: 'POST' });
                showToast('Stopping batch engine...', 'info');
            } catch (_) {}
        };

        const btnStop = document.getElementById('btnStopBatch');
        if (btnStop) btnStop.addEventListener('click', handleStopBatch);

        const btnStopKhalik = document.getElementById('btnStopKhalikBatch');
        if (btnStopKhalik) btnStopKhalik.addEventListener('click', handleStopBatch);

        // Topbar & Files Tab Delete Date ZIP
        const btnDelTop = document.getElementById('btnDeleteDateZipTop');
        if (btnDelTop) {
            btnDelTop.addEventListener('click', () => {
                const dObj = getSelectedDateObj();
                executeDeleteDatePackage(dObj.fileDate || dObj.formatted);
            });
        }

        const btnDelZipFiles = document.getElementById('btnDeleteZipFromFiles');
        if (btnDelZipFiles) {
            btnDelZipFiles.addEventListener('click', () => {
                const dObj = getSelectedDateObj();
                executeDeleteDatePackage(dObj.fileDate || dObj.formatted);
            });
        }

        // Topbar & Files Tab Download Date ZIP
        const btnDlTop = document.getElementById('btnDownloadZipTop');
        if (btnDlTop) {
            btnDlTop.addEventListener('click', () => {
                const dObj = getSelectedDateObj();
                downloadDateZip(dObj.fileDate || dObj.formatted);
            });
        }

        const btnDlZipFiles = document.getElementById('btnDownloadZipFromFiles');
        if (btnDlZipFiles) {
            btnDlZipFiles.addEventListener('click', () => {
                const dObj = getSelectedDateObj();
                downloadDateZip(dObj.fileDate || dObj.formatted);
            });
        }

        // Purge Older Dates
        const btnPurge = document.getElementById('btnPurgeOldFiles');
        if (btnPurge) {
            btnPurge.addEventListener('click', async () => {
                const dObj = getSelectedDateObj();
                const keepDate = dObj.fileDate || dObj.formatted;
                if (!window.confirm(`Are you sure you want to purge all older PDF files and keep only "${keepDate}"?\n\nThis frees up server disk space.`)) return;

                try {
                    showToast(`Purging older dates...`, 'info');
                    const res = await fetch('/api/purge-previous-days', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ keepDate })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast(`✓ Purged ${data.count || 0} older files.`, 'success');
                        await fetchFiles();
                        renderNewspaperTable();
                    } else {
                        showToast(data.error || 'Failed to purge files', 'error');
                    }
                } catch (err) {
                    showToast(`Purge error: ${err.message}`, 'error');
                }
            });
        }

        // Refresh Buttons
        const btnRefresh = document.getElementById('btnRefreshFiles');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                showToast('Refreshing catalog & files...', 'info');
                fetchFiles();
                renderNewspaperTable();
            });
        }

        
        // Branding Live Preview Listeners
        ['inputWatermarkText', 'chkEnableTop', 'chkEnableBottom', 'chkEnableDiagonal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', drawBroadsheetMockup);
            if (el) el.addEventListener('change', drawBroadsheetMockup);
        });

        const btnResetWatermark = document.getElementById('btnResetWatermark');
        if (btnResetWatermark) {
            btnResetWatermark.addEventListener('click', () => {
                const inp = document.getElementById('inputWatermarkText');
                if (inp) inp.value = 'Social Media Pakistan 0342-4938217';
                const chkTop = document.getElementById('chkEnableTop');
                if (chkTop) chkTop.checked = true;
                const chkBot = document.getElementById('chkEnableBottom');
                if (chkBot) chkBot.checked = true;
                const chkDiag = document.getElementById('chkEnableDiagonal');
                if (chkDiag) chkDiag.checked = false;
                drawBroadsheetMockup();
            });
        }

        // Theme Toggle
        const btnTheme = document.getElementById('btnThemeToggle');
        if (btnTheme) {
            btnTheme.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                btnTheme.textContent = newTheme === 'light' ? '☀️' : '🌙';
            });
        }

        // Open Server Folder
        const btnFolder = document.getElementById('btnOpenFolder');
        if (btnFolder) {
            btnFolder.addEventListener('click', async () => {
                try {
                    await fetch('/api/open-folder', { method: 'POST' });
                    showToast('Opened server output folder', 'info');
                } catch (_) {}
            });
        }

        // Modal Close
        const modalClose = document.getElementById('modalCloseBtn');
        if (modalClose) modalClose.addEventListener('click', closePdfModal);

        const modalOverlay = document.getElementById('previewModal');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) closePdfModal();
            });
        }


        // Khalik Section Event Listeners
        document.querySelectorAll('[data-khalik-filter]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('[data-khalik-filter]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentKhalikFilter = chip.getAttribute('data-khalik-filter') || 'all';
                renderKhalikTable();
            });
        });

        const chkKhalikMaster = document.getElementById('chkKhalikMasterTable');
        if (chkKhalikMaster) {
            chkKhalikMaster.addEventListener('change', () => {
                document.querySelectorAll('#tableBodyKhalik tr').forEach(tr => {
                    if (tr.style.display !== 'none') {
                        const c = tr.querySelector('.chk-khalik-paper-select');
                        if (c) c.checked = chkKhalikMaster.checked;
                    }
                });
                updateKhalikSelectionCounter();
            });
        }

        const btnKhalikSelectAll = document.getElementById('btnKhalikSelectAll');
        if (btnKhalikSelectAll) {
            btnKhalikSelectAll.addEventListener('click', () => {
                document.querySelectorAll('#tableBodyKhalik tr').forEach(tr => {
                    if (tr.style.display !== 'none') {
                        const c = tr.querySelector('.chk-khalik-paper-select');
                        if (c) c.checked = true;
                    }
                });
                if (chkKhalikMaster) chkKhalikMaster.checked = true;
                updateKhalikSelectionCounter();
            });
        }

        const btnKhalikDeselectAll = document.getElementById('btnKhalikDeselectAll');
        if (btnKhalikDeselectAll) {
            btnKhalikDeselectAll.addEventListener('click', () => {
                document.querySelectorAll('#tableBodyKhalik tr').forEach(tr => {
                    if (tr.style.display !== 'none') {
                        const c = tr.querySelector('.chk-khalik-paper-select');
                        if (c) c.checked = false;
                    }
                });
                if (chkKhalikMaster) chkKhalikMaster.checked = false;
                updateKhalikSelectionCounter();
            });
        }

        const btnStartKhalik = document.getElementById('btnStartKhalikBatch');
        if (btnStartKhalik) {
            btnStartKhalik.addEventListener('click', () => {
                executeKhalikBatch();
            });
        }

        function checkAllBackgroundBatches() {
            checkServerBatchStatus();
            checkServerMagBatchStatus();
            if (typeof checkServerArabBatchStatus === 'function') checkServerArabBatchStatus();
            if (typeof checkFpBatchStatus === 'function') checkFpBatchStatus();
            if (typeof checkIndBatchStatus === 'function') checkIndBatchStatus();
        }

        // Initialize PIN Lock Security, Custom PDF Stamper & Background Batch Sync
        initCustomPdfStamper();
        initPinLockSystem();
        checkAllBackgroundBatches();

        renderNewspaperTable();
        renderKhalikTable();
        loadArabCatalog();
        
        fetchFiles().then(() => {
            renderNewspaperTable();
            renderKhalikTable();
            renderArabTable();
        });
    });

    // ── BULK CUSTOM PDF WATERMARK & PROMO STAMPER UI ENGINE ──────────────────
    let selectedCustomPdfs = [];

    function initCustomPdfStamper() {
        const dropzone = document.getElementById('customPdfDropzone');
        const fileInput = document.getElementById('customPdfFileInput');
        const itemsContainer = document.getElementById('customPdfItemsContainer');
        const filesListDiv = document.getElementById('customPdfFilesList');
        const countSpan = document.getElementById('customPdfSelectedCount');
        const btnClear = document.getElementById('btnClearCustomPdfs');
        const btnProcess = document.getElementById('btnProcessCustomPdfs');
        const statusMsg = document.getElementById('customPdfStatusMsg');
        const resultsSection = document.getElementById('customPdfResultsSection');
        const resultsTbody = document.getElementById('customPdfResultsTableBody');

        const chkDateOption = document.getElementById('chkCustomDateOption');
        const inputCustomDate = document.getElementById('inputCustomPdfDate');
        if (chkDateOption && inputCustomDate) {
            chkDateOption.addEventListener('change', () => {
                inputCustomDate.disabled = !chkDateOption.checked;
                inputCustomDate.style.opacity = chkDateOption.checked ? '1' : '0.5';
            });
        }

        // Trigger file browser on click
        dropzone.addEventListener('click', (e) => {
            if (e.target !== fileInput) fileInput.click();
        });

        // Drag & Drop visual state handlers
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.style.background = 'rgba(79, 70, 229, 0.1)';
                dropzone.style.borderColor = 'var(--accent-emerald)';
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.style.background = 'rgba(79, 70, 229, 0.03)';
                dropzone.style.borderColor = 'var(--primary)';
            });
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                addCustomPdfFiles(dt.files);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                addCustomPdfFiles(fileInput.files);
            }
        });

        function addCustomPdfFiles(files) {
            Array.from(files).forEach(f => {
                if (f.name.toLowerCase().endsWith('.pdf')) {
                    if (!selectedCustomPdfs.some(existing => existing.name === f.name && existing.size === f.size)) {
                        selectedCustomPdfs.push(f);
                    }
                }
            });
            renderCustomPdfFilesList();
        }

        function renderCustomPdfFilesList() {
            if (selectedCustomPdfs.length === 0) {
                filesListDiv.style.display = 'none';
                itemsContainer.innerHTML = '';
                countSpan.textContent = '0';
                return;
            }

            filesListDiv.style.display = 'block';
            countSpan.textContent = selectedCustomPdfs.length;

            itemsContainer.innerHTML = selectedCustomPdfs.map((f, idx) => `
                <div style="background: var(--bg-primary); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 12px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <span style="color: #ef4444; font-weight: 700;">📕</span>
                            <span style="font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.name}</span>
                            <span style="color: var(--text-muted); font-size: 11px;">(${(f.size / (1024 * 1024)).toFixed(2)} MB)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="custom-file-pct" style="font-size: 11px; font-weight: 700; color: var(--text-muted);">Ready</span>
                            <button type="button" class="btn-remove-file" data-idx="${idx}" style="background: none; border: none; color: #ef4444; font-weight: 800; cursor: pointer; padding: 2px 6px; font-size: 14px;">✕</button>
                        </div>
                    </div>
                    <div style="margin-top: 6px; background: rgba(0,0,0,0.06); height: 4px; border-radius: 2px; overflow: hidden;">
                        <div class="custom-file-bar-fill" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.2s ease;"></div>
                    </div>
                </div>
            `).join('');

            itemsContainer.querySelectorAll('.btn-remove-file').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const i = parseInt(btn.getAttribute('data-idx'), 10);
                    if (!isNaN(i)) {
                        selectedCustomPdfs.splice(i, 1);
                        renderCustomPdfFilesList();
                    }
                });
            });
        }

        if (btnClear) {
            btnClear.addEventListener('click', () => {
                selectedCustomPdfs = [];
                fileInput.value = '';
                renderCustomPdfFilesList();
                if (resultsSection) resultsSection.style.display = 'none';
                if (statusMsg) statusMsg.textContent = '';
            });
        }

        if (btnProcess) {
            btnProcess.addEventListener('click', async () => {
                if (selectedCustomPdfs.length === 0) {
                    showToast('Please select or drop at least one PDF file.', 'error');
                    return;
                }

                btnProcess.disabled = true;
                btnProcess.style.opacity = '0.6';

                const totalFiles = selectedCustomPdfs.length;
                let successCount = 0;

                resultsSection.style.display = 'block';
                resultsTbody.innerHTML = '';

                // Reset progress UI elements
                itemsContainer.querySelectorAll('.custom-file-pct').forEach(el => {
                    el.textContent = 'Ready';
                    el.style.color = 'var(--text-muted)';
                });
                itemsContainer.querySelectorAll('.custom-file-bar-fill').forEach(el => {
                    el.style.width = '0%';
                    el.style.background = 'var(--primary)';
                });

                // Helper to upload & watermark a single file using 1MB chunked streams (Bypasses Cloudflare payload throttling)
                const processSingleFileDirect = async (fileIdx) => {
                    const file = selectedCustomPdfs[fileIdx];
                    const itemPctEl = itemsContainer.querySelectorAll('.custom-file-pct')[fileIdx];
                    const itemBarEl = itemsContainer.querySelectorAll('.custom-file-bar-fill')[fileIdx];

                    if (itemPctEl) {
                        itemPctEl.textContent = '⏳ Uploading 0%';
                        itemPctEl.style.color = 'var(--primary)';
                    }

                    const watermarkText = document.getElementById('inputCustomPdfWatermark')?.value || 'Social Media Pakistan 0342-4938217';
                    const enableTopBanner = document.getElementById('chkCustomTopBanner')?.checked ? 'true' : 'false';
                    const enableBottomBanner = document.getElementById('chkCustomBottomBanner')?.checked ? 'true' : 'false';
                    const enableDiagonal = document.getElementById('chkCustomDiagonal')?.checked ? 'true' : 'false';
                    const appendPromoPages = document.getElementById('chkCustomPromoPages')?.checked ? 'true' : 'false';
                    const enableCleanFilename = document.getElementById('chkCustomCleanFilename')?.checked ? 'true' : 'false';
                    const enableDateOption = document.getElementById('chkCustomDateOption')?.checked ? 'true' : 'false';
                    const customDate = document.getElementById('inputCustomPdfDate')?.value?.trim() || '';

                    let resultData = null;

                    // Small files (<= 2MB): Direct fast upload
                    if (file.size <= 2 * 1024 * 1024) {
                        const formData = new FormData();
                        formData.append('pdfFiles', file, file.name);
                        formData.append('watermarkText', watermarkText);
                        formData.append('enableTopBanner', enableTopBanner);
                        formData.append('enableBottomBanner', enableBottomBanner);
                        formData.append('enableDiagonal', enableDiagonal);
                        formData.append('appendPromoPages', appendPromoPages);
                        formData.append('enableCleanFilename', enableCleanFilename);
                        formData.append('enableDateOption', enableDateOption);
                        formData.append('customDate', customDate);

                        let uploadStartTime = 0;
                        resultData = await new Promise((resolve) => {
                            const xhr = new XMLHttpRequest();
                            xhr.open('POST', '/api/custom-pdf/watermark-batch', true);

                            xhr.upload.addEventListener('progress', (e) => {
                                if (e.lengthComputable && e.total > 0) {
                                    if (!uploadStartTime) uploadStartTime = Date.now();
                                    const loaded = e.loaded;
                                    const total = e.total;
                                    const pct = Math.min(99, Math.round((loaded / total) * 100));
                                    const elapsedSec = Math.max(0.01, (Date.now() - uploadStartTime) / 1000);
                                    const speedMbVal = (loaded / (1024 * 1024)) / elapsedSec;
                                    const speedText = speedMbVal >= 1.0 ? `${speedMbVal.toFixed(1)} MB/s` : `${Math.round(speedMbVal * 1024)} KB/s`;

                                    if (itemPctEl) itemPctEl.textContent = `⏳ Uploading ${pct}% (${speedText})`;
                                    if (itemBarEl) itemBarEl.style.width = `${pct}%`;
                                }
                            });

                            xhr.addEventListener('load', () => {
                                if (xhr.status === 200 && !xhr.responseText.trim().startsWith('<')) {
                                    try {
                                        const data = JSON.parse(xhr.responseText);
                                        if (data.success && Array.isArray(data.results) && data.results.length > 0) {
                                            resolve(data.results[0]);
                                            return;
                                        }
                                    } catch (_) {}
                                }
                                resolve({ success: false, originalName: file.name, error: 'Server upload error' });
                            });

                            xhr.addEventListener('error', () => {
                                resolve({ success: false, originalName: file.name, error: 'Network error' });
                            });

                            xhr.send(formData);
                        });
                    } else {
                        // Files > 2MB: 2MB Chunked Upload Engine for maximum TCP throughput
                        const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB chunks
                        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
                        const uploadId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

                        let uploadStartTime = Date.now();
                        let totalBytesUploaded = 0;
                        let uploadSuccess = true;

                        for (let c = 0; c < totalChunks; c++) {
                            const start = c * CHUNK_SIZE;
                            const end = Math.min(file.size, start + CHUNK_SIZE);
                            const chunkBlob = file.slice(start, end);

                            const formData = new FormData();
                            formData.append('chunk', chunkBlob, file.name);
                            formData.append('uploadId', uploadId);
                            formData.append('chunkIndex', c.toString());
                            formData.append('totalChunks', totalChunks.toString());

                            const chunkResult = await new Promise((resolve) => {
                                const xhr = new XMLHttpRequest();
                                xhr.open('POST', '/api/custom-pdf/upload-chunk', true);

                                xhr.upload.addEventListener('progress', (e) => {
                                    if (e.lengthComputable && e.total > 0) {
                                        const currentUploaded = totalBytesUploaded + e.loaded;
                                        const pct = Math.min(99, Math.round((currentUploaded / file.size) * 100));
                                        const elapsedSec = Math.max(0.01, (Date.now() - uploadStartTime) / 1000);
                                        const speedMbVal = (currentUploaded / (1024 * 1024)) / elapsedSec;
                                        const speedText = speedMbVal >= 1.0 ? `${speedMbVal.toFixed(1)} MB/s` : `${Math.round(speedMbVal * 1024)} KB/s`;

                                        if (itemPctEl) itemPctEl.textContent = `⏳ Uploading ${pct}% (${speedText})`;
                                        if (itemBarEl) itemBarEl.style.width = `${pct}%`;
                                    }
                                });

                                xhr.addEventListener('load', () => {
                                    if (xhr.status === 200) {
                                        try {
                                            const res = JSON.parse(xhr.responseText);
                                            if (res.success) {
                                                totalBytesUploaded += (end - start);
                                                resolve(true);
                                                return;
                                            }
                                        } catch (_) {}
                                    }
                                    resolve(false);
                                });

                                xhr.addEventListener('error', () => resolve(false));
                                xhr.send(formData);
                            });

                            if (!chunkResult) {
                                uploadSuccess = false;
                                break;
                            }
                        }

                        if (!uploadSuccess) {
                            resultData = { success: false, originalName: file.name, error: 'Chunk upload failed' };
                        } else {
                            if (itemPctEl) {
                                itemPctEl.textContent = `⚙️ Watermarking...`;
                                itemPctEl.style.color = '#d97706';
                            }
                            if (itemBarEl) itemBarEl.style.width = `100%`;

                            try {
                                const procRes = await fetch('/api/custom-pdf/process-watermark-chunked', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        uploadId,
                                        totalChunks,
                                        originalName: file.name,
                                        watermarkText,
                                        enableTopBanner,
                                        enableBottomBanner,
                                        enableDiagonal,
                                        appendPromoPages,
                                        enableCleanFilename,
                                        enableDateOption,
                                        customDate
                                    })
                                });
                                const procData = await procRes.json();
                                if (procData.success && Array.isArray(procData.results) && procData.results.length > 0) {
                                    resultData = procData.results[0];
                                } else {
                                    resultData = { success: false, originalName: file.name, error: procData.message || 'Processing failed' };
                                }
                            } catch (err) {
                                resultData = { success: false, originalName: file.name, error: err.message || 'Server error' };
                            }
                        }
                    }

                    if (resultData && resultData.success) {
                        successCount++;
                        if (itemPctEl) {
                            itemPctEl.textContent = `✓ Completed (100%)`;
                            itemPctEl.style.color = '#10b981';
                        }
                        if (itemBarEl) itemBarEl.style.background = '#10b981';

                        resultsTbody.innerHTML += `
                            <tr>
                                <td>
                                    <div style="font-weight: 700; color: var(--text-primary);">${resultData.filename}</div>
                                    <div style="font-size: 11px; color: var(--text-muted);">Original: ${resultData.originalName}</div>
                                </td>
                                <td><span class="page-count-badge">${resultData.pages} pgs</span></td>
                                <td><span class="page-count-badge">${resultData.sizeMb} MB</span></td>
                                <td><span class="status-pill st-completed">✓ Completed</span></td>
                                <td style="text-align: right;">
                                    <div class="newspaper-actions-group">
                                        <button type="button" class="btn-action-view" onclick="previewPdfFile('${resultData.url}', '${encodeURIComponent(resultData.filename)}')" title="Preview PDF">👁 View</button>
                                        <a href="${resultData.url}" download class="btn-action-download" title="Download PDF">⬇ Download PDF</a>
                                    </div>
                                </td>
                            </tr>
                        `;
                    } else {
                        if (itemPctEl) {
                            itemPctEl.textContent = `⚠️ Error`;
                            itemPctEl.style.color = '#ef4444';
                        }
                        if (itemBarEl) itemBarEl.style.background = '#ef4444';

                        resultsTbody.innerHTML += `
                            <tr>
                                <td>
                                    <div style="font-weight: 700; color: var(--text-primary);">${resultData ? (resultData.originalName || file.name) : file.name}</div>
                                </td>
                                <td>-</td>
                                <td>-</td>
                                <td><span class="status-pill st-failed">⚠️ ${resultData ? (resultData.error || 'Error') : 'Error'}</span></td>
                                <td style="text-align: right;">-</td>
                            </tr>
                        `;
                    }
                };

                // Managed Batch Concurrency: 2 files at a time to ensure 800-900 KB/s upload speed per file
                const CONCURRENCY_LIMIT = 2;
                let currentFileIdx = 0;

                const fileWorker = async () => {
                    while (currentFileIdx < totalFiles) {
                        const idx = currentFileIdx++;
                        if (statusMsg) {
                            statusMsg.innerHTML = `<span style="color: var(--primary);">⚙️ Uploading & processing file ${idx + 1} of ${totalFiles}...</span>`;
                        }
                        await processSingleFileDirect(idx);
                    }
                };

                const workers = [];
                for (let c = 0; c < Math.min(CONCURRENCY_LIMIT, totalFiles); c++) {
                    workers.push(fileWorker());
                }
                await Promise.all(workers);

                btnProcess.disabled = false;
                btnProcess.style.opacity = '1';

                if (statusMsg) {
                    statusMsg.innerHTML = `<span style="color: #10b981;">✓ Done! Processed ${successCount} of ${totalFiles} PDF files successfully.</span>`;
                }
                showToast(`Successfully watermarked ${successCount} of ${totalFiles} PDFs!`, successCount > 0 ? 'success' : 'error');

                fetchFiles();
            });
        }
    }

    // ── PASSPORT SIZE PHOTO CREATOR BY KHALIQ ENGINE ─────────────────────────
    let passportState = {
        initialized: false,
        uploadedImg: null,
        smoothing: 0,
        brightness: 0,
        contrast: 0,
        zoom: 100,
        offsetY: 0
    };

    function initPassportPhotoSection() {
        if (passportState.initialized) return;
        passportState.initialized = true;

        const dropzone = document.getElementById('passportDropzone');
        const fileInput = document.getElementById('passportFileInput');
        const btnBrowse = document.getElementById('btnBrowsePassport');

        const sliderSmoothing = document.getElementById('sliderSmoothing');
        const sliderBrightness = document.getElementById('sliderBrightness');
        const sliderContrast = document.getElementById('sliderContrast');
        const sliderZoom = document.getElementById('sliderZoom');
        const sliderOffsetY = document.getElementById('sliderOffsetY');
        const btnResetCrop = document.getElementById('btnResetCrop');

        const btnDownloadSheet = document.getElementById('btnDownloadSheet');

        // File upload event handlers
        if (btnBrowse && fileInput) {
            btnBrowse.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.click();
            });
        }

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handlePassportFileUpload(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    handlePassportFileUpload(e.target.files[0]);
                }
            });
        }

        // Live sliders
        if (sliderSmoothing) {
            sliderSmoothing.addEventListener('input', (e) => {
                passportState.smoothing = parseInt(e.target.value, 10);
                const el = document.getElementById('valSmoothing');
                if (el) el.textContent = `${passportState.smoothing}%`;
                renderPassportSheet();
            });
        }

        if (sliderBrightness) {
            sliderBrightness.addEventListener('input', (e) => {
                passportState.brightness = parseInt(e.target.value, 10);
                const el = document.getElementById('valBrightness');
                if (el) el.textContent = `${passportState.brightness > 0 ? '+' : ''}${passportState.brightness}%`;
                renderPassportSheet();
            });
        }

        if (sliderContrast) {
            sliderContrast.addEventListener('input', (e) => {
                passportState.contrast = parseInt(e.target.value, 10);
                const el = document.getElementById('valContrast');
                if (el) el.textContent = `${passportState.contrast > 0 ? '+' : ''}${passportState.contrast}%`;
                renderPassportSheet();
            });
        }

        if (sliderZoom) {
            sliderZoom.addEventListener('input', (e) => {
                passportState.zoom = parseInt(e.target.value, 10);
                const el = document.getElementById('valZoom');
                if (el) el.textContent = `${passportState.zoom}%`;
                renderPassportSheet();
            });
        }

        if (sliderOffsetY) {
            sliderOffsetY.addEventListener('input', (e) => {
                passportState.offsetY = parseInt(e.target.value, 10);
                const el = document.getElementById('valOffsetY');
                if (el) el.textContent = `${passportState.offsetY}px`;
                renderPassportSheet();
            });
        }

        if (btnResetCrop) {
            btnResetCrop.addEventListener('click', () => {
                passportState.zoom = 100;
                passportState.offsetY = 0;
                passportState.smoothing = 0;
                passportState.brightness = 0;
                passportState.contrast = 0;
                if (sliderZoom) sliderZoom.value = 100;
                if (sliderOffsetY) sliderOffsetY.value = 0;
                if (sliderSmoothing) sliderSmoothing.value = 0;
                if (sliderBrightness) sliderBrightness.value = 0;
                if (sliderContrast) sliderContrast.value = 0;
                document.getElementById('valZoom').textContent = '100%';
                document.getElementById('valOffsetY').textContent = '0px';
                document.getElementById('valSmoothing').textContent = '0%';
                document.getElementById('valBrightness').textContent = '0%';
                document.getElementById('valContrast').textContent = '0%';
                renderPassportSheet();
            });
        }

        // Sheet download
        if (btnDownloadSheet) {
            btnDownloadSheet.addEventListener('click', () => {
                const canvas = document.getElementById('passportCanvasSheet');
                if (!canvas) return;
                const link = document.createElement('a');
                link.download = 'passport_photo_sheet_8_khaliq.jpg';
                link.href = canvas.toDataURL('image/jpeg', 0.95);
                link.click();
                showToast('Downloaded 8-photo print sheet (A6)!', 'success');
            });
        }
    }

    function handlePassportFileUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('Please upload a valid image file (JPG, PNG, WEBP).', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
            const img = new Image();
            img.onload = function() {
                passportState.uploadedImg = img;
                renderPassportSheet();
                showToast('8-Photo Print Sheet ready!', 'success');
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    }

    function renderPassportSheet() {
        if (!passportState.uploadedImg) return;

        const canvasSheet = document.getElementById('passportCanvasSheet');
        const placeholderSheet = document.getElementById('placeholderSheet');
        const btnDownloadSheet = document.getElementById('btnDownloadSheet');

        if (!canvasSheet) return;

        // 1. Create single photo crop canvas (413 x 531 px @ 3.5x4.5 ratio)
        const sw = 413;
        const sh = 531;
        const singleCanvas = document.createElement('canvas');
        singleCanvas.width = sw;
        singleCanvas.height = sh;

        const ctxS = singleCanvas.getContext('2d');
        ctxS.clearRect(0, 0, sw, sh);

        const img = passportState.uploadedImg;
        const ew = img.naturalWidth || img.width;
        const eh = img.naturalHeight || img.height;

        const zoomFactor = passportState.zoom / 100;
        const scale = Math.max(sw / ew, sh / eh) * zoomFactor;

        const renderW = ew * scale;
        const renderH = eh * scale;
        const renderX = (sw - renderW) / 2;
        const renderY = (sh - renderH) / 2 + passportState.offsetY;

        ctxS.save();
        const bFilter = 100 + passportState.brightness;
        const cFilter = 100 + passportState.contrast;
        ctxS.filter = `brightness(${bFilter}%) contrast(${cFilter}%)`;

        // Draw image onto single canvas
        if (passportState.smoothing > 0) {
            ctxS.drawImage(img, renderX, renderY, renderW, renderH);
            ctxS.save();
            ctxS.globalAlpha = (passportState.smoothing / 100) * 0.35;
            ctxS.filter = `blur(${Math.round(passportState.smoothing / 25)}px) brightness(${bFilter}%) contrast(${cFilter}%)`;
            ctxS.drawImage(img, renderX, renderY, renderW, renderH);
            ctxS.restore();
        } else {
            ctxS.drawImage(img, renderX, renderY, renderW, renderH);
        }
        ctxS.restore();

        // Draw black border around single photo canvas
        ctxS.strokeStyle = '#000000';
        ctxS.lineWidth = 4;
        ctxS.strokeRect(0, 0, sw, sh);

        // 2. Render 8-Photo Print Sheet (1800 x 1200 px @ A6 / 4x6" Grid)
        const sheetW = 1800;
        const sheetH = 1200;
        canvasSheet.width = sheetW;
        canvasSheet.height = sheetH;

        const ctxSheet = canvasSheet.getContext('2d');
        ctxSheet.clearRect(0, 0, sheetW, sheetH);

        // Pure white sheet background
        ctxSheet.fillStyle = '#ffffff';
        ctxSheet.fillRect(0, 0, sheetW, sheetH);

        // 8-Photo Grid Layout Parameters (2 rows x 4 columns)
        const photoW = 415;
        const photoH = 543;
        const gapX = 14; // Perfect gap for scissors to cut through without extra trimming
        const gapY = 14;
        const marginX = (sheetW - (4 * photoW + 3 * gapX)) / 2; // ~49px outer margin (halved)
        const marginY = (sheetH - (2 * photoH + 1 * gapY)) / 2; // ~50px outer margin (halved)

        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 4; col++) {
                const posX = marginX + col * (photoW + gapX);
                const posY = marginY + row * (photoH + gapY);

                // Draw passport photo box
                ctxSheet.drawImage(singleCanvas, posX, posY, photoW, photoH);

                // Draw crisp black border around each passport photo (doubled thickness)
                ctxSheet.strokeStyle = '#000000';
                ctxSheet.lineWidth = 6;
                ctxSheet.strokeRect(posX, posY, photoW, photoH);
            }
        }

        // Show sheet preview and enable download button
        if (placeholderSheet) placeholderSheet.style.display = 'none';
        if (btnDownloadSheet) btnDownloadSheet.disabled = false;
    }

    // ── ARAB NEWS SECTION EVENT HANDLERS ──────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-arab-filter]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('[data-arab-filter]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentArabCategoryFilter = chip.getAttribute('data-arab-filter');
                renderArabTable();
            });
        });

        const btnArabSelectAll = document.getElementById('btnArabSelectAll');
        if (btnArabSelectAll) {
            btnArabSelectAll.addEventListener('click', () => {
                document.querySelectorAll('.chk-arab-select').forEach(cb => cb.checked = true);
                const master = document.getElementById('chkArabMasterTable');
                if (master) master.checked = true;
                updateArabSelectionCounter();
            });
        }

        const btnArabDeselectAll = document.getElementById('btnArabDeselectAll');
        if (btnArabDeselectAll) {
            btnArabDeselectAll.addEventListener('click', () => {
                document.querySelectorAll('.chk-arab-select').forEach(cb => cb.checked = false);
                const master = document.getElementById('chkArabMasterTable');
                if (master) master.checked = false;
                updateArabSelectionCounter();
            });
        }

        const chkArabMaster = document.getElementById('chkArabMasterTable');
        if (chkArabMaster) {
            chkArabMaster.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                document.querySelectorAll('.chk-arab-select').forEach(cb => cb.checked = isChecked);
                updateArabSelectionCounter();
            });
        }
    });

    // ═════════════════════════════════════════════════════════════════════════
    // FOREIGN PAPER MODULE CLIENT LOGIC (MOBILISM F=123)
    // ═════════════════════════════════════════════════════════════════════════
    let loadedFpPapers = [];
    let fpCache = {};
    let currentFpDate = '';
    let fpBatchPollInterval = null;

    async function initForeignPaperSection() {
        const picker = document.getElementById('fpDatePicker');
        const todayStr = new Date().toISOString().slice(0, 10);
        if (picker && !picker.value) {
            picker.value = todayStr;
        }

        currentFpDate = (picker && picker.value) ? picker.value : todayStr;
        await loadForeignPaperCatalog(currentFpDate);
        initForeignPaperEvents();
        checkFpBatchStatus();
    }

    async function loadForeignPaperCatalog(dateStr) {
        const grid = document.getElementById('foreignpaperGrid');
        const countLabel = document.getElementById('fpTotalCountLabel');
        const dateLabel = document.getElementById('fpCurrentDateLabel');
        const noticeBanner = document.getElementById('fpNoticeBanner');
        const statusBadge = document.getElementById('fpStatusBadge');

        if (dateLabel) dateLabel.textContent = dateStr;
        if (statusBadge) {
            statusBadge.className = 'badge-status badge-warning';
            statusBadge.textContent = 'Loading...';
        }

        if (grid) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
                    <div class="empty-icon">🌐</div>
                    <h4>Loading Foreign Papers for ${dateStr}...</h4>
                    <p>Connecting to Mobilism forum feed and fetching newspaper covers.</p>
                </div>
            `;
        }

        if (noticeBanner) noticeBanner.style.display = 'none';

        if (fpCache[dateStr]) {
            loadedFpPapers = fpCache[dateStr];
            finalizeFpRender(loadedFpPapers, dateStr, false);
            return;
        }

        try {
            const res = await fetch(`/api/foreignpaper/by-date?date=${encodeURIComponent(dateStr)}`);
            const data = await res.json();

            if (data.success && Array.isArray(data.papers)) {
                loadedFpPapers = data.papers;
                fpCache[data.date] = loadedFpPapers;

                const usedFallback = data.requestedDate && data.requestedDate !== data.date;
                if (usedFallback && noticeBanner) {
                    noticeBanner.innerHTML = `ℹ️ No foreign papers found for <strong>${data.requestedDate}</strong>. Displaying latest available archive (<strong>${data.date}</strong>) with ${data.papers.length} issues.`;
                    noticeBanner.style.display = 'block';
                    currentFpDate = data.date;
                    const picker = document.getElementById('fpDatePicker');
                    if (picker) picker.value = data.date;
                }

                finalizeFpRender(loadedFpPapers, data.date, usedFallback);
            } else {
                throw new Error(data.error || 'Failed to load foreign papers.');
            }
        } catch (err) {
            console.error('[ForeignPaper] Error loading catalog:', err);
            if (grid) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
                        <div class="empty-icon" style="color: #ef4444;">⚠️</div>
                        <h4>Failed to Load Foreign Papers</h4>
                        <p>${err.message}</p>
                        <button type="button" class="btn btn-outline" style="margin-top: 12px;" onclick="loadForeignPaperCatalog('${dateStr}')">Retry Fetching</button>
                    </div>
                `;
            }
            if (statusBadge) {
                statusBadge.className = 'badge-status badge-danger';
                statusBadge.textContent = 'Error';
            }
        }
    }

    function finalizeFpRender(papers, dateStr, usedFallback) {
        const grid = document.getElementById('foreignpaperGrid');
        const countLabel = document.getElementById('fpTotalCountLabel');
        const dateLabel = document.getElementById('fpCurrentDateLabel');
        const statusBadge = document.getElementById('fpStatusBadge');

        if (dateLabel) dateLabel.textContent = dateStr;
        if (countLabel) countLabel.textContent = `${papers.length} Issues`;

        if (statusBadge) {
            statusBadge.className = 'badge-status badge-success';
            statusBadge.textContent = usedFallback ? 'Archive Loaded' : 'Live Ready';
        }

        renderForeignPaperGrid(papers);
    }

    function renderForeignPaperGrid(papers) {
        const grid = document.getElementById('foreignpaperGrid');
        const searchInput = document.getElementById('fpSearchBox');
        if (!grid) return;

        const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
        let filtered = papers;

        if (searchTerm) {
            filtered = filtered.filter(p => (p.title || '').toLowerCase().includes(searchTerm));
        }

        // Sort descending by numeric topic ID so latest uploaded paper is ALWAYS at the top
        filtered.sort((a, b) => (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0));

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
                    <div class="empty-icon">🔍</div>
                    <h4>No Papers Matched Filter</h4>
                    <p>Try searching for a different newspaper title or date.</p>
                </div>
            `;
            updateFpSelectionCounter();
            return;
        }

        grid.innerHTML = filtered.map((paper) => {
            const downloadedPdf = findMatchingGeneratedPdf(paper, generatedFilesList, 'foreignpaper');
            const isDownloaded = !!downloadedPdf;
            const coverSrc = paper.coverImage || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80';
            const downloadedBadge = isDownloaded ? `<span class="mag-category-badge" style="background: rgba(16, 185, 129, 0.95); right: 10px; left: auto; padding: 4px 8px; border-radius: 4px; font-weight: 700;">✅ Already Generated</span>` : '';
            const pdfFileUrl = downloadedPdf ? (downloadedPdf.url || ('/output/' + encodeURIComponent(downloadedPdf.filename || downloadedPdf.name))) : '';

            return `
                <div class="mag-card" data-paper-id="${escapeHtml(paper.id)}">
                    <div class="mag-card-cover-wrap">
                        <img src="${escapeHtml(coverSrc)}" alt="${escapeHtml(paper.title)}" class="mag-card-cover" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80'">
                        <div class="mag-card-checkbox-wrap">
                            <input type="checkbox" class="chk-fp-item" data-id="${escapeHtml(paper.id)}" checked style="width: 20px; height: 20px; cursor: pointer; accent-color: #3b82f6;">
                        </div>
                        <span class="mag-category-badge" style="background: rgba(59, 130, 246, 0.9);">Foreign Paper</span>
                        ${downloadedBadge}
                    </div>
                    <div class="mag-card-content">
                        <h3 class="mag-card-title">${escapeHtml(paper.title)}</h3>
                        <div class="mag-card-meta">
                            <span>📅 ${escapeHtml(paper.date)}</span>
                            <span>💾 ${escapeHtml(paper.size || 'PDF')}</span>
                        </div>
                        <div class="mag-card-actions" style="display: flex; gap: 6px;">
                            <button type="button" class="btn btn-primary btn-sm btn-fp-download" data-id="${escapeHtml(paper.id)}" style="flex: 1; font-weight: 700;">
                                📥 ${isDownloaded ? 'Re-Download PDF' : 'Download PDF'}
                            </button>
                            ${isDownloaded ? `<a href="${escapeHtml(pdfFileUrl)}" download class="btn btn-success btn-sm" style="font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; padding: 4px 10px; background: #059669; color: #fff; border-radius: 6px;" onclick="event.stopPropagation();">👁 View PDF</a>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.chk-fp-item').forEach(chk => {
            chk.addEventListener('change', updateFpSelectionCounter);
            chk.addEventListener('click', (e) => e.stopPropagation());
        });

        grid.querySelectorAll('.mag-card').forEach(card => {
            const id = card.getAttribute('data-paper-id');
            const paper = loadedFpPapers.find(p => p.id === id);
            if (!paper) return;

            const coverWrap = card.querySelector('.mag-card-cover-wrap');
            const titleEl = card.querySelector('.mag-card-title');
            [coverWrap, titleEl].forEach(el => {
                if (el) {
                    el.style.cursor = 'pointer';
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openForeignPaperModal(paper);
                    });
                }
            });
        });

        grid.querySelectorAll('.btn-fp-download').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const p = loadedFpPapers.find(item => item.id === id);
                if (p) openForeignPaperModal(p);
            });
        });

        updateFpSelectionCounter();
    }

    let currentModalFp = null;

    function openForeignPaperModal(paper) {
        currentModalFp = paper;
        const modal = document.getElementById('fpModalOverlay');
        if (!modal) return;

        const downloadedPdf = findMatchingGeneratedPdf(paper, generatedFilesList, 'foreignpaper');
        const isDownloaded = !!downloadedPdf;

        const coverEl = document.getElementById('fpModalCover');
        const titleEl = document.getElementById('fpModalTitle');
        const dateEl = document.getElementById('fpModalDate');
        const sizeEl = document.getElementById('fpModalSize');
        const btnDl = document.getElementById('btnFpModalDownload');
        const btnOpen = document.getElementById('btnFpModalOpenPdf');
        const statusEl = document.getElementById('fpModalDownloadStatus');
        const linksList = document.getElementById('fpModalLinksList');

        if (coverEl) coverEl.src = paper.coverImage || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80';
        if (titleEl) titleEl.textContent = paper.title;
        if (dateEl) dateEl.textContent = paper.date || currentFpDate;
        if (sizeEl) sizeEl.textContent = paper.size || 'PDF Edition';

        if (linksList) {
            linksList.innerHTML = '';
            let links = paper.allDownloadUrls || [];
            if (links.length === 0 && paper.downloadUrl) links = [paper.downloadUrl];

            if (links.length === 0) {
                linksList.innerHTML = '<div style="font-size: 0.82rem; color: #94a3b8; font-style: italic;">No direct mirror links found. Primary automatic download will be used.</div>';
            } else {
                links.forEach((linkUrl, idx) => {
                    let hostName = 'Server ' + (idx + 1);
                    const u = linkUrl.toLowerCase();
                    if (u.includes('usersdrive') || u.includes('userdriver')) hostName = '⚡ UsersDrive (Recommended High Speed)';
                    else if (u.includes('userupload')) hostName = '🚀 UserUpload (Fast Mirror)';
                    else if (u.includes('dropapk')) hostName = '📦 DropAPK Mirror';
                    else if (u.includes('uploady')) hostName = '☁️ Uploady Mirror';
                    else if (u.includes('rapidgator')) hostName = '🐢 Rapidgator (Slow Mirror)';
                    else if (u.endsWith('.pdf')) hostName = '🎯 Direct PDF File';

                    const linkBtn = document.createElement('button');
                    linkBtn.type = 'button';
                    linkBtn.className = 'btn btn-outline btn-sm';
                    linkBtn.style.cssText = 'display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; padding: 10px 14px; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; background: rgba(30,41,59,0.7); cursor: pointer; font-size: 0.88rem; transition: all 0.2s;';
                    linkBtn.innerHTML = `
                        <span style="font-weight: 700; color: #f8fafc;">${hostName}</span>
                        <span style="font-size: 0.75rem; color: #38bdf8; background: rgba(56,189,248,0.15); padding: 3px 8px; border-radius: 4px; font-weight: 600;">📥 Click to Generate PDF</span>
                    `;
                    linkBtn.addEventListener('click', () => {
                        const customPaper = { ...paper, downloadUrl: linkUrl };
                        singleDownloadFpIssue(customPaper, linkBtn);
                    });
                    linksList.appendChild(linkBtn);
                });
            }
        }

        if (btnDl) {
            btnDl.disabled = false;
            if (isDownloaded) {
                btnDl.innerHTML = `✓ PDF Already Generated (${downloadedPdf.sizeMb ? downloadedPdf.sizeMb + ' MB' : 'Ready'})`;
            } else {
                btnDl.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download Primary Mirror PDF`;
            }
        }

        if (btnOpen) {
            if (isDownloaded && downloadedPdf.url) {
                btnOpen.href = downloadedPdf.url;
                btnOpen.style.display = 'inline-flex';
            } else {
                btnOpen.style.display = 'none';
            }
        }

        if (statusEl) statusEl.style.display = 'none';
        modal.style.display = 'flex';
    }

    function updateFpSelectionCounter() {
        const checked = document.querySelectorAll('.chk-fp-item:checked').length;
        const total = document.querySelectorAll('.chk-fp-item').length;
        const label = document.getElementById('fpSelectedCountLabel');
        const masterChk = document.getElementById('chkSelectAllFp');
        const btnBatch = document.getElementById('btnDownloadAllFp');

        if (label) label.textContent = `${checked} Selected`;
        if (masterChk) masterChk.checked = (total > 0 && checked === total);
        if (btnBatch) btnBatch.textContent = `⚡ Download Selected (${checked})`;
    }

    async function singleDownloadFpIssue(paper, btnEl) {
        if (!paper) return;

        const origHtml = btnEl ? btnEl.innerHTML : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = `⏳ Generating PDF...`;
        }

        const banner = document.getElementById('fpBatchProgressBanner');
        const currentTitleEl = document.getElementById('fpBatchCurrentTitle');
        const counterEl = document.getElementById('fpBatchCounter');
        const barEl = document.getElementById('fpBatchProgressBar');
        const modalStatusEl = document.getElementById('fpModalDownloadStatus');
        const modalStatusTxt = document.getElementById('fpModalDownloadStatusText');

        if (banner) banner.style.display = 'block';
        if (currentTitleEl) currentTitleEl.textContent = `Generating PDF: ${paper.title}...`;
        if (counterEl) counterEl.textContent = `1 / 1`;
        if (barEl) barEl.style.width = `25%`;

        if (modalStatusEl) modalStatusEl.style.display = 'block';
        if (modalStatusTxt) modalStatusTxt.textContent = `Downloading & assembling PDF for ${paper.title}...`;

        showToast(`Generating PDF for ${paper.title}...`, 'info');

        try {
            const res = await fetch('/api/foreignpaper/download-single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paper })
            });
            const data = await res.json();
            if (data.success && data.url) {
                if (barEl) barEl.style.width = `100%`;
                if (currentTitleEl) currentTitleEl.textContent = `✅ Completed: ${data.filename} (${data.sizeMb} MB)`;
                if (modalStatusTxt) modalStatusTxt.innerHTML = `✅ <strong>${escapeHtml(data.filename)}</strong> downloaded successfully (${data.sizeMb} MB)!`;

                showToast(`Downloaded ${paper.title} successfully!`, 'success');

                const btnOpenModal = document.getElementById('btnFpModalOpenPdf');
                if (btnOpenModal) {
                    btnOpenModal.href = data.url;
                    btnOpenModal.style.display = 'inline-flex';
                }

                // Trigger direct file download in browser
                const downloadLink = document.createElement('a');
                downloadLink.href = data.url;
                downloadLink.download = data.filename || `${paper.title}.pdf`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);

                if (typeof fetchFiles === 'function') {
                    fetchFiles();
                }

                if (btnEl) {
                    btnEl.disabled = false;
                    btnEl.innerHTML = `✅ PDF Generated (${data.sizeMb} MB)`;
                }

                setTimeout(() => {
                    if (banner && !fpBatchPollInterval) banner.style.display = 'none';
                }, 4000);
            } else {
                throw new Error(data.error || 'Failed to generate PDF.');
            }
        } catch (err) {
            console.error('[ForeignPaper Download Error]:', err);
            if (currentTitleEl) currentTitleEl.textContent = `⚠️ Error: ${err.message}`;
            if (modalStatusTxt) modalStatusTxt.textContent = `Error: ${err.message}`;
            showToast(`Download failed: ${err.message}`, 'error');
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = origHtml;
            }
            setTimeout(() => {
                if (banner && !fpBatchPollInterval) banner.style.display = 'none';
            }, 6000);
        }
    }

    function initForeignPaperEvents() {
        const picker = document.getElementById('fpDatePicker');
        if (picker && !picker.hasAttribute('data-bound')) {
            picker.setAttribute('data-bound', 'true');
            picker.addEventListener('change', (e) => {
                currentFpDate = e.target.value;
                loadForeignPaperCatalog(currentFpDate);
            });
        }

        const btnRefresh = document.getElementById('btnRefreshFp');
        if (btnRefresh && !btnRefresh.hasAttribute('data-bound')) {
            btnRefresh.setAttribute('data-bound', 'true');
            btnRefresh.addEventListener('click', () => {
                delete fpCache[currentFpDate];
                loadForeignPaperCatalog(currentFpDate);
            });
        }

        const searchInput = document.getElementById('fpSearchBox');
        if (searchInput && !searchInput.hasAttribute('data-bound')) {
            searchInput.setAttribute('data-bound', 'true');
            searchInput.addEventListener('input', () => {
                renderForeignPaperGrid(loadedFpPapers);
            });
        }

        const masterChk = document.getElementById('chkSelectAllFp');
        if (masterChk && !masterChk.hasAttribute('data-bound')) {
            masterChk.setAttribute('data-bound', 'true');
            masterChk.addEventListener('change', (e) => {
                const checked = e.target.checked;
                document.querySelectorAll('.chk-fp-item').forEach(c => c.checked = checked);
                updateFpSelectionCounter();
            });
        }

        const btnDownloadAll = document.getElementById('btnDownloadAllFp');
        if (btnDownloadAll && !btnDownloadAll.hasAttribute('data-bound')) {
            btnDownloadAll.setAttribute('data-bound', 'true');
            btnDownloadAll.addEventListener('click', startFpBatchDownload);
        }

        const btnStopBatch = document.getElementById('btnStopFpBatch');
        if (btnStopBatch && !btnStopBatch.hasAttribute('data-bound')) {
            btnStopBatch.setAttribute('data-bound', 'true');
            btnStopBatch.addEventListener('click', async () => {
                await fetch('/api/foreignpaper/stop', { method: 'POST' });
                showToast('Foreign Paper batch download cancelled.', 'info');
            });
        }

        // Bind Foreign Paper Modal close and download button events
        const fpModal = document.getElementById('fpModalOverlay');
        const btnFpClose = document.getElementById('btnFpModalClose');
        if (btnFpClose && !btnFpClose.hasAttribute('data-bound')) {
            btnFpClose.setAttribute('data-bound', 'true');
            btnFpClose.addEventListener('click', () => {
                if (fpModal) fpModal.style.display = 'none';
            });
        }
        if (fpModal && !fpModal.hasAttribute('data-bound')) {
            fpModal.setAttribute('data-bound', 'true');
            fpModal.addEventListener('click', (e) => {
                if (e.target === fpModal) fpModal.style.display = 'none';
            });
        }
        const btnFpModalDl = document.getElementById('btnFpModalDownload');
        if (btnFpModalDl && !btnFpModalDl.hasAttribute('data-bound')) {
            btnFpModalDl.setAttribute('data-bound', 'true');
            btnFpModalDl.addEventListener('click', () => {
                if (currentModalFp) singleDownloadFpIssue(currentModalFp, btnFpModalDl);
            });
        }
    }

    async function startFpBatchDownload() {
        const checkedBoxes = Array.from(document.querySelectorAll('.chk-fp-item:checked'));
        if (checkedBoxes.length === 0) {
            showToast('Please select at least one foreign paper to download.', 'warning');
            return;
        }

        const selectedIds = checkedBoxes.map(c => c.getAttribute('data-id'));
        const papersToDownload = loadedFpPapers.filter(p => selectedIds.includes(p.id));

        showToast(`Starting download of ${papersToDownload.length} foreign paper(s)...`, 'info');

        try {
            const res = await fetch('/api/foreignpaper/process-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: currentFpDate,
                    papers: papersToDownload
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Background batch started for ${papersToDownload.length} paper(s).`, 'success');
                startFpBatchPolling();
            } else {
                showToast(data.error || 'Failed to start batch download.', 'error');
            }
        } catch (err) {
            showToast(`Batch download error: ${err.message}`, 'error');
        }
    }

    let lastFpCompletedCount = 0;
    function startFpBatchPolling() {
        if (fpBatchPollInterval) clearInterval(fpBatchPollInterval);
        fpBatchPollInterval = setInterval(checkFpBatchStatus, 1000);
        checkFpBatchStatus();
    }

    async function checkFpBatchStatus() {
        try {
            const res = await fetch('/api/foreignpaper/status', { headers: { 'Cache-Control': 'no-cache' } });
            const data = await res.json();

            if (data.success && data.state) {
                const state = data.state;
                const banner = document.getElementById('fpBatchProgressBanner');
                const currentTitleEl = document.getElementById('fpBatchCurrentTitle');
                const counterEl = document.getElementById('fpBatchCounter');
                const barEl = document.getElementById('fpBatchProgressBar');

                if (state.isRunning) {
                    if (!fpBatchPollInterval) {
                        fpBatchPollInterval = setInterval(checkFpBatchStatus, 1500);
                    }
                    if (banner) banner.style.display = 'block';
                    if (currentTitleEl) currentTitleEl.textContent = state.currentTitle ? `Downloading: ${state.currentTitle}` : 'Processing batch...';
                    if (counterEl) counterEl.textContent = `${state.completedCount + state.failedCount} / ${state.total}`;
                    if (barEl) barEl.style.width = `${Math.max(5, state.percent || 0)}%`;

                    if (Array.isArray(state.results) && state.results.length > lastFpCompletedCount) {
                        const newResults = state.results.slice(lastFpCompletedCount);
                        lastFpCompletedCount = state.results.length;
                        newResults.forEach(r => {
                            if (r && r.url) {
                                const downloadLink = document.createElement('a');
                                downloadLink.href = r.url;
                                downloadLink.download = r.filename || 'newspaper.pdf';
                                document.body.appendChild(downloadLink);
                                downloadLink.click();
                                document.body.removeChild(downloadLink);
                            }
                        });
                        fetchFiles();
                    }
                } else {
                    if (fpBatchPollInterval) {
                        clearInterval(fpBatchPollInterval);
                        fpBatchPollInterval = null;
                        lastFpCompletedCount = 0;
                        fetchFiles();

                        if (state.completedCount > 0) {
                            if (currentTitleEl) currentTitleEl.textContent = `✅ Batch Complete! Downloaded ${state.completedCount} issue(s).`;
                            if (barEl) barEl.style.width = '100%';
                            setTimeout(() => { if (banner) banner.style.display = 'none'; }, 4000);
                        } else {
                            if (banner) banner.style.display = 'none';
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[ForeignPaper Batch Status Error]:', err);
        }
    }

    // ── INDIAN NEWSPAPER SECTION CONTROLLER ──────────────────────────
    let currentIndDate = formatDateYMD(new Date());
    let loadedIndPapers = [];
    let indCache = {};
    let indBatchPollInterval = null;

    function initIndianPaperSection() {
        const dateInput = document.getElementById('indDatePicker');
        if (dateInput && !dateInput.value) {
            dateInput.value = currentIndDate;
        } else if (dateInput && dateInput.value) {
            currentIndDate = dateInput.value;
        }

        initIndianPaperEvents();
        loadIndianPaperCatalog(currentIndDate);
        checkIndBatchStatus();
    }

    async function loadIndianPaperCatalog(dateStr) {
        const grid = document.getElementById('indGridContainer');
        const emptyState = document.getElementById('indEmptyState');
        const countLabel = document.getElementById('indTotalCountLabel');
        const dateLabel = document.getElementById('indCurrentDateLabel');

        if (dateLabel) dateLabel.textContent = dateStr;

        if (indCache[dateStr]) {
            loadedIndPapers = indCache[dateStr];
            renderIndianPaperGrid(loadedIndPapers);
            if (countLabel) countLabel.textContent = `${loadedIndPapers.length} Papers Available`;
            return;
        }

        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    <div class="spinner" style="margin: 0 auto 16px auto;"></div>
                    <p style="font-size: 15px; font-weight: 600;">Fetching Indian Newspapers for ${dateStr}...</p>
                </div>
            `;
        }

        try {
            const res = await fetch(`/api/indianpaper/by-date?date=${encodeURIComponent(dateStr)}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.papers)) {
                loadedIndPapers = data.papers;
                indCache[dateStr] = loadedIndPapers;
                renderIndianPaperGrid(loadedIndPapers);
                if (countLabel) countLabel.textContent = `${loadedIndPapers.length} Papers Available`;
            } else {
                throw new Error(data.error || 'Failed to fetch Indian newspaper catalog.');
            }
        } catch (err) {
            console.error('[IndianPaper Catalog Error]:', err);
            if (grid) grid.innerHTML = '';
            if (emptyState) {
                emptyState.style.display = 'block';
                const p = emptyState.querySelector('p');
                if (p) p.textContent = `Error loading newspapers: ${err.message}`;
            }
            showToast(`Catalog error: ${err.message}`, 'error');
        }
    }

    function renderIndianPaperGrid(papers) {
        const grid = document.getElementById('indGridContainer');
        const emptyState = document.getElementById('indEmptyState');
        const searchInput = document.getElementById('indSearchBox');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        if (!grid) return;

        let filtered = papers;
        if (query) {
            filtered = papers.filter(p => (p.title || '').toLowerCase().includes(query) || (p.edition || '').toLowerCase().includes(query));
        }

        if (filtered.length === 0) {
            grid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            updateIndSelectionCounter();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        grid.innerHTML = filtered.map(paper => {
            const cleanTitle = (paper.title || '').toLowerCase();
            const cleanEdition = (paper.edition || '').toLowerCase();
            const isDownloaded = generatedFilesList.some(f => {
                if (getFileCategory(f) !== 'indianpaper') return false;
                const fname = (f.name || f.filename || '').toLowerCase();
                const matchesDate = fname.includes(currentIndDate) || fname.includes(currentIndDate.replace(/-/g, ''));
                if (!matchesDate) return false;
                
                // Match title fragments
                if (cleanTitle.includes('times of india') && fname.includes('times of india')) return true;
                if (cleanTitle.includes('hindustan times') && fname.includes('hindustan times')) return true;
                if (cleanTitle.includes('the hindu') && fname.includes('the hindu')) return true;
                if (cleanTitle.includes('financial express') && fname.includes('financial express')) return true;
                if (cleanTitle.includes('indian express') && fname.includes('indian express')) return true;
                if (cleanTitle.includes('telegraph') && fname.includes('telegraph')) return true;
                if (cleanTitle.includes('deccan herald') && fname.includes('deccan herald')) return true;
                if (cleanTitle.includes('deccan chronicle') && fname.includes('deccan chronicle')) return true;
                if (cleanTitle.includes('tribune') && fname.includes('tribune')) return true;
                if ((cleanTitle.includes('freepress') || cleanTitle.includes('free press')) && (fname.includes('freepress') || fname.includes('free press'))) return true;
                if (cleanTitle.includes('pioneer') && fname.includes('pioneer')) return true;
                if (cleanTitle.includes('statesman') && fname.includes('statesman')) return true;
                if (cleanTitle.includes('economic times') && fname.includes('economic times')) return true;
                if (cleanTitle.includes('business standard') && fname.includes('business standard')) return true;
                if (cleanTitle.includes('business line') && fname.includes('business line')) return true;
                if (cleanTitle.includes('mint') && fname.includes('mint')) return true;
                
                return false;
            });

            const downloadedBadge = isDownloaded ? `<span class="mag-category-badge" style="background: rgba(16, 185, 129, 0.9); left: auto; right: 12px;">✅ Downloaded</span>` : '';

            return `
                <div class="mag-card" data-id="${escapeHtml(paper.id)}">
                    <div style="position: absolute; top: 12px; left: 12px; z-index: 10;">
                        <input type="checkbox" class="chk-ind-item" data-id="${escapeHtml(paper.id)}" style="width: 20px; height: 20px; cursor: pointer;">
                    </div>
                    <div class="mag-card-cover" style="height: 180px; background: linear-gradient(135deg, #1e293b, #0f172a); display: flex; align-items: center; justify-content: center; flex-direction: column; color: #fff; padding: 15px; text-align: center;">
                        <span style="font-size: 40px; margin-bottom: 8px;">🇮🇳</span>
                        <div style="font-weight: 700; font-size: 16px;">${escapeHtml(paper.title)}</div>
                        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${escapeHtml(paper.edition ? paper.edition + ' Edition' : 'National')}</div>
                        <span class="mag-category-badge" style="background: rgba(245, 158, 11, 0.9);">Indian Paper</span>
                        ${downloadedBadge}
                    </div>
                    <div class="mag-card-content">
                        <h3 class="mag-card-title">${escapeHtml(paper.title)}</h3>
                        <div class="mag-card-meta">
                            <span>📅 ${escapeHtml(paper.date)}</span>
                            <span>📍 ${escapeHtml(paper.edition || 'English')}</span>
                        </div>
                        <div class="mag-card-actions">
                            <button type="button" class="btn btn-primary btn-sm btn-ind-download" data-id="${escapeHtml(paper.id)}" style="flex: 1; font-weight: 700;">
                                📥 ${isDownloaded ? 'Re-Download PDF' : 'Download PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.chk-ind-item').forEach(chk => {
            chk.addEventListener('change', updateIndSelectionCounter);
        });

        grid.querySelectorAll('.btn-ind-download').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const p = loadedIndPapers.find(item => item.id === id);
                if (p) singleDownloadIndIssue(p, btn);
            });
        });

        updateIndSelectionCounter();
    }

    function updateIndSelectionCounter() {
        const checked = document.querySelectorAll('.chk-ind-item:checked').length;
        const total = document.querySelectorAll('.chk-ind-item').length;
        const label = document.getElementById('indSelectedCountLabel');
        const masterChk = document.getElementById('chkSelectAllInd');
        const btnBatch = document.getElementById('btnDownloadAllInd');

        if (label) label.textContent = `${checked} Selected`;
        if (masterChk) masterChk.checked = (total > 0 && checked === total);
        if (btnBatch) btnBatch.textContent = `⚡ Download Selected (${checked})`;
    }

    async function singleDownloadIndIssue(paper, btnEl) {
        if (!paper) return;

        const origHtml = btnEl ? btnEl.innerHTML : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = `⏳ Downloading...`;
        }

        showToast(`Started downloading ${paper.title}...`, 'info');

        try {
            const res = await fetch('/api/indianpaper/process-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: paper.date || currentIndDate,
                    papers: [paper]
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Downloading ${paper.title} in background. Check Generated PDFs when ready.`, 'success');
                startIndBatchPolling();
            } else {
                throw new Error(data.error || 'Failed to start download.');
            }
        } catch (err) {
            showToast(`Download failed: ${err.message}`, 'error');
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = origHtml;
            }
        }
    }

    function initIndianPaperEvents() {
        const picker = document.getElementById('indDatePicker');
        if (picker && !picker.hasAttribute('data-bound')) {
            picker.setAttribute('data-bound', 'true');
            picker.addEventListener('change', (e) => {
                currentIndDate = e.target.value;
                loadIndianPaperCatalog(currentIndDate);
            });
        }

        const btnRefresh = document.getElementById('btnRefreshInd');
        if (btnRefresh && !btnRefresh.hasAttribute('data-bound')) {
            btnRefresh.setAttribute('data-bound', 'true');
            btnRefresh.addEventListener('click', () => {
                delete indCache[currentIndDate];
                loadIndianPaperCatalog(currentIndDate);
            });
        }

        const searchInput = document.getElementById('indSearchBox');
        if (searchInput && !searchInput.hasAttribute('data-bound')) {
            searchInput.setAttribute('data-bound', 'true');
            searchInput.addEventListener('input', () => {
                renderIndianPaperGrid(loadedIndPapers);
            });
        }

        const masterChk = document.getElementById('chkSelectAllInd');
        if (masterChk && !masterChk.hasAttribute('data-bound')) {
            masterChk.setAttribute('data-bound', 'true');
            masterChk.addEventListener('change', (e) => {
                const checked = e.target.checked;
                document.querySelectorAll('.chk-ind-item').forEach(c => c.checked = checked);
                updateIndSelectionCounter();
            });
        }

        const btnDownloadAll = document.getElementById('btnDownloadAllInd');
        if (btnDownloadAll && !btnDownloadAll.hasAttribute('data-bound')) {
            btnDownloadAll.setAttribute('data-bound', 'true');
            btnDownloadAll.addEventListener('click', startIndBatchDownload);
        }

        const btnStopBatch = document.getElementById('btnStopIndBatch');
        if (btnStopBatch && !btnStopBatch.hasAttribute('data-bound')) {
            btnStopBatch.setAttribute('data-bound', 'true');
            btnStopBatch.addEventListener('click', async () => {
                await fetch('/api/indianpaper/stop', { method: 'POST' });
                showToast('Indian Newspaper batch download cancelled.', 'info');
            });
        }
    }

    async function startIndBatchDownload() {
        const checkedBoxes = Array.from(document.querySelectorAll('.chk-ind-item:checked'));
        if (checkedBoxes.length === 0) {
            showToast('Please select at least one Indian newspaper to download.', 'warning');
            return;
        }

        const selectedIds = checkedBoxes.map(c => c.getAttribute('data-id'));
        const papersToDownload = loadedIndPapers.filter(p => selectedIds.includes(p.id));

        showToast(`Starting download of ${papersToDownload.length} Indian newspaper(s)...`, 'info');

        try {
            const res = await fetch('/api/indianpaper/process-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: currentIndDate,
                    papers: papersToDownload
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Background batch started for ${papersToDownload.length} paper(s).`, 'success');
                startIndBatchPolling();
            } else {
                showToast(data.error || 'Failed to start batch download.', 'error');
            }
        } catch (err) {
            showToast(`Batch download error: ${err.message}`, 'error');
        }
    }

    function startIndBatchPolling() {
        if (indBatchPollInterval) clearInterval(indBatchPollInterval);
        indBatchPollInterval = setInterval(checkIndBatchStatus, 3000);
        checkIndBatchStatus();
    }

    async function checkIndBatchStatus() {
        try {
            const res = await fetch('/api/indianpaper/status', { headers: { 'Cache-Control': 'no-cache' } });
            const data = await res.json();

            if (data.success && data.state) {
                const state = data.state;
                const banner = document.getElementById('indBatchProgressBanner');
                const currentTitleEl = document.getElementById('indBatchCurrentTitle');
                const counterEl = document.getElementById('indBatchCounter');
                const barEl = document.getElementById('indBatchProgressBar');

                if (state.isRunning) {
                    if (!indBatchPollInterval) {
                        indBatchPollInterval = setInterval(checkIndBatchStatus, 2000);
                    }
                    if (banner) banner.style.display = 'block';
                    if (currentTitleEl) currentTitleEl.textContent = state.currentTitle ? `Downloading: ${state.currentTitle}` : 'Processing batch...';
                    if (counterEl) counterEl.textContent = `${state.completedCount + state.failedCount} / ${state.total}`;
                    if (barEl) barEl.style.width = `${state.percent || 0}%`;
                } else {
                    if (banner) banner.style.display = 'none';
                    if (indBatchPollInterval) {
                        clearInterval(indBatchPollInterval);
                        indBatchPollInterval = null;
                        fetchFiles();
                    }
                }
            }
        } catch (err) {
            console.error('[IndianPaper Batch Status Error]:', err);
        }
    }

})();

