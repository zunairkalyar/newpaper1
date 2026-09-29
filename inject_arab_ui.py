import re

# 1. Update index.html
with open("/www/wwwroot/newspaper.kalyartraders.com/public/index.html", "r") as f:
    html = f.read()

# Add sidebar nav link under Newspaper Hub
sidebar_arab_nav = """
                <a href="#arab" class="nav-item" data-tab="tab-arab">
                    <svg class="nav-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    <span class="nav-label">Arab News</span>
                    <span class="nav-pill pill-accent" id="navCountArab">15</span>
                </a>
"""

if 'data-tab="tab-arab"' not in html:
    html = html.replace(
        'data-tab="tab-hub">\n                    <svg class="nav-icon"',
        'data-tab="tab-hub">\n                    <svg class="nav-icon"'
    )
    # Insert after data-tab="tab-hub" anchor
    hub_anchor_end = html.find('</a>', html.find('data-tab="tab-hub"')) + 4
    html = html[:hub_anchor_end] + sidebar_arab_nav + html[hub_anchor_end:]

# Add tab-arab section inside main
tab_arab_section = """
            <!-- ================= ARAB NEWSPAPERS HUB ================= -->
            <section class="tab-pane" id="tab-arab">
                <div class="page-heading">
                    <div class="heading-left">
                        <h1 class="page-title">Arab &amp; Middle East Newspapers Hub</h1>
                        <p class="page-desc">Daily broadsheet &amp; PDF publications from Qatar, Saudi Arabia, Kuwait, Bahrain, Oman &amp; Regional Middle East.</p>
                    </div>
                    <div class="heading-right">
                        <div class="date-selector-container">
                            <span class="date-picker-label">Publication Date:</span>
                            <div class="date-picker-wrapper">
                                <input type="text" id="arabPublicationDate" class="custom-date-input" readonly placeholder="Select Date">
                                <svg class="calendar-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                            </div>
                            <button type="button" class="btn btn-secondary btn-sm" id="btnArabDateToday">Today</button>
                            <button type="button" class="btn btn-secondary btn-sm" id="btnArabDateYesterday">Yesterday</button>
                        </div>
                    </div>
                </div>

                <!-- Quick Stats -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon-wrap stat-icon-purple">
                            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="2" y1="12" x2="22" y2="12"></line>
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                            </svg>
                        </div>
                        <div class="stat-info">
                            <span class="stat-label">Total Arab Newspapers</span>
                            <span class="stat-value" id="statArabTotal">15 <span class="stat-unit">Editions</span></span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon-wrap stat-icon-green">
                            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div class="stat-info">
                            <span class="stat-label">Selected for Batch</span>
                            <span class="stat-value" id="statArabSelected">15 <span class="stat-unit">Selected</span></span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon-wrap stat-icon-orange">
                            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                            </svg>
                        </div>
                        <div class="stat-info">
                            <span class="stat-label">Ready Arab PDFs</span>
                            <span class="stat-value" id="statArabReady">0 <span class="stat-unit">Files</span></span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon-wrap stat-icon-blue">
                            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                        </div>
                        <div class="stat-info">
                            <span class="stat-label">Publication Date</span>
                            <span class="stat-value" id="statArabDateDisplay">--</span>
                        </div>
                    </div>
                </div>

                <!-- Table Container -->
                <div class="card table-card">
                    <div class="card-header-actions">
                        <div class="filter-chips" id="arabCategoryFilters">
                            <button type="button" class="chip active" data-filter="all">All Arab Editions (15)</button>
                            <button type="button" class="chip" data-filter="qatar">Qatar (4)</button>
                            <button type="button" class="chip" data-filter="saudi">Saudi Arabia (2)</button>
                            <button type="button" class="chip" data-filter="kuwait">Kuwait (3)</button>
                            <button type="button" class="chip" data-filter="bahrain">Bahrain (2)</button>
                            <button type="button" class="chip" data-filter="regional">Regional &amp; Oman (4)</button>
                        </div>
                        <div class="batch-action-buttons">
                            <div class="selection-tools">
                                <button type="button" class="btn-link" id="btnArabSelectAll">Select All</button>
                                <span class="bullet">•</span>
                                <button type="button" class="btn-link" id="btnArabClearAll">Clear</button>
                            </div>
                            <button type="button" class="btn btn-primary" id="btnRunArabBatch">
                                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                </svg>
                                <span>Run Arab Batch</span>
                            </button>
                            <button type="button" class="btn btn-danger" id="btnStopArabBatch" style="display: none; background: #dc2626; color: white;">
                                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                                </svg>
                                <span>Stop Batch</span>
                            </button>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="data-table" id="arabNewspapersTable">
                            <thead>
                                <tr>
                                    <th width="40" class="th-checkbox">
                                        <input type="checkbox" id="checkArabMaster" checked>
                                    </th>
                                    <th>EDITION / NEWSPAPER</th>
                                    <th>COUNTRY</th>
                                    <th>LANGUAGE</th>
                                    <th>DATE</th>
                                    <th>STATUS</th>
                                    <th width="160">PROGRESS (%)</th>
                                    <th>PAGES / SIZE</th>
                                    <th width="120" class="text-right">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody id="arabTableBody">
                                <!-- Populated dynamically by app.js -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
"""

if 'id="tab-arab"' not in html:
    main_end = html.find('</main>')
    html = html[:main_end] + tab_arab_section + "\n" + html[main_end:]

with open("/www/wwwroot/newspaper.kalyartraders.com/public/index.html", "w") as f:
    f.write(html)

print("Injected Arab UI into index.html successfully!")
