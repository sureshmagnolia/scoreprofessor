document.addEventListener('DOMContentLoaded', () => {
    // --- State & Constants ---
    let state = {
        applicantName: '',
        facultyType: 'science', // 'science' or 'humanities'
        items: {
            cat1: [], cat2: [], cat3: [], cat4: [], cat5: [], cat6: []
        }
    };

    // --- Scoring Rubrics ---
    const getScoreDetail = (category, itemData, faculty) => {
        const isSci = faculty === 'science';
        let detail = { score: 0, breakdown: '' };

        switch (category) {
            case 'cat1': // Research Papers
                const base = isSci ? 8 : 10;
                let aug = 0;
                let impactText = 'No Impact Factor';
                if (itemData.impact === 'none') { aug = 5; impactText = 'Refereed'; }
                if (itemData.impact === 'less1') { aug = 10; impactText = 'IF < 1'; }
                if (itemData.impact === '1to2') { aug = 15; impactText = 'IF 1-2'; }
                if (itemData.impact === '2to5') { aug = 20; impactText = 'IF 2-5'; }
                if (itemData.impact === '5to10') { aug = 25; impactText = 'IF 5-10'; }
                if (itemData.impact === 'gt10') { aug = 30; impactText = 'IF > 10'; }

                let totalForPaper = base + aug;
                let breakdownStr = `Base (${base}) + ${impactText} (${aug}) = ${totalForPaper}`;

                // Authorship division
                if (itemData.authorship === 'two' || itemData.authorship === 'principal') {
                    detail.score = totalForPaper * 0.7;
                    detail.breakdown = `${breakdownStr} | 70% Authorship = ${detail.score.toFixed(2)}`;
                } else if (itemData.authorship === 'joint') {
                    detail.score = totalForPaper * 0.3;
                    detail.breakdown = `${breakdownStr} | 30% Authorship = ${detail.score.toFixed(2)}`;
                } else {
                    detail.score = totalForPaper;
                    detail.breakdown = `${breakdownStr} | Single Author = ${detail.score.toFixed(2)}`;
                }
                return detail;

            case 'cat2': // Publications
                const pubPts = { book_intl: 12, book_natl: 10, chapter: 5, editor_intl: 10, editor_natl: 8, trans_chapter: 3, trans_book: 8 };
                detail.score = pubPts[itemData.pubType] || 0;
                detail.breakdown = `Base = ${detail.score}`;
                return detail;

            case 'cat3': // ICT
                const ictPts = { pedagogy: 5, curricula: 2, mooc_complete: 20, mooc_module: 5, mooc_writer: 2, mooc_coord: 8, econtent_course: 12, econtent_module: 5, econtent_contrib: 2, econtent_editor: 10 };
                detail.score = ictPts[itemData.ictType] || 0;
                detail.breakdown = `Base = ${detail.score}`;
                return detail;

            case 'cat4': // Research Guidance
                const resPts = { phd_awarded: 10, phd_submitted: 5, mphil_awarded: 2, proj_comp_gt10: 10, proj_comp_lt10: 5, proj_ong_gt10: 5, proj_ong_lt10: 2, consultancy: 3 };
                let resBase = resPts[itemData.resType] || 0;

                if (itemData.role === 'joint' && !['mphil_awarded', 'consultancy'].includes(itemData.resType)) {
                    if (itemData.resType.startsWith('phd')) {
                        detail.score = 7;
                        detail.breakdown = `Base (${resBase}) | Joint Supervisor = ${detail.score}`;
                    } else {
                        detail.score = resBase * 0.5;
                        detail.breakdown = `Base (${resBase}) | Joint Investigator (50%) = ${detail.score}`;
                    }
                } else {
                    detail.score = resBase;
                    detail.breakdown = `Base = ${detail.score}`;
                }
                return detail;

            case 'cat5': // Patents/Policy/Awards
                const patPts = { pat_intl: 10, pat_natl: 7, pol_intl: 10, pol_natl: 7, pol_state: 4, award_intl: 7, award_natl: 5 };
                detail.score = patPts[itemData.patType] || 0;
                detail.breakdown = `Base = ${detail.score}`;
                return detail;

            case 'cat6': // Invited Lectures
                const lecPts = { lec_intl_abroad: 7, lec_intl_within: 5, lec_natl: 3, lec_state: 2 };
                detail.score = lecPts[itemData.lecType] || 0;
                detail.breakdown = `Base = ${detail.score}`;
                return detail;
        }
        return detail;
    };

    // --- DOM Elements ---
    const nameInput = document.getElementById('applicant-name');
    const facultySelect = document.getElementById('faculty-type');
    const calcBtn = document.getElementById('btn-calculate');
    const exportBtn = document.getElementById('btn-export');
    const importInput = document.getElementById('file-import');
    const verdictBanner = document.getElementById('verdict-banner');
    const verdictTitle = document.getElementById('verdict-title');
    const verdictText = document.getElementById('verdict-text');
    const activeCatDisplay = document.getElementById('active-categories');
    const printBtn = document.getElementById('btn-print');
    const printArea = document.getElementById('print-area');

    // --- Initialization & Setup ---
    nameInput.addEventListener('input', (e) => {
        state.applicantName = e.target.value;
        saveToLocal();
    });

    facultySelect.addEventListener('change', (e) => {
        state.facultyType = e.target.value;
        calculateTotal();
    });

    document.querySelectorAll('.add-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const catNum = e.target.getAttribute('data-category');
            addItem(`cat${catNum}`);
        });
    });

    calcBtn.addEventListener('click', calculateTotal);
    exportBtn.addEventListener('click', exportJSON);
    importInput.addEventListener('change', importJSON);
    printBtn.addEventListener('click', generatePrintReport);

    // --- Dynamic Form Logic ---
    function updateIndices(catId) {
        const container = document.getElementById(`${catId}-items`);
        const rows = container.querySelectorAll('.item-row');
        rows.forEach((row, index) => {
            const h3 = row.querySelector('.row-header h3');
            if (h3) {
                const baseText = h3.textContent.split(' #')[0];
                h3.textContent = `${baseText} #${index + 1}`;
            }
        });
    }

    function addItem(catId, existingData = null) {
        const container = document.getElementById(`${catId}-items`);
        const template = document.getElementById(`tpl-${catId}`);
        const clone = template.content.cloneNode(true);
        const row = clone.querySelector('.item-row');

        const itemId = existingData ? existingData.id : Date.now().toString() + Math.random().toString(36).substr(2, 5);
        row.setAttribute('data-id', itemId);

        // Pre-fill if loading from JSON
        if (existingData) {
            for (const key in existingData) {
                if (key !== 'id') {
                    const input = row.querySelector(`[name="${key}"]`);
                    if (input) input.value = existingData[key];
                }
            }
        }

        // Specific category logic bindings
        if (catId === 'cat4') {
            const resTypeSelect = row.querySelector('[name="resType"]');
            const jointWrapper = row.querySelector('#joint-wrapper');
            const updateJointVisibility = () => {
                const val = resTypeSelect.value;
                if (val === 'mphil_awarded' || val === 'consultancy') {
                    jointWrapper.style.display = 'none';
                    row.querySelector('[name="role"]').value = 'sole';
                } else {
                    jointWrapper.style.display = 'block';
                }
            };
            resTypeSelect.addEventListener('change', updateJointVisibility);
            if (existingData) updateJointVisibility(); // trigger on load
        }

        row.querySelector('.btn-remove').addEventListener('click', () => {
            row.remove();
            updateIndices(catId);
            // recalculate immediately
            calculateTotal();
        });

        // Add auto-recalculate on any select change inside this newly added row
        row.querySelectorAll('select, input').forEach(el => {
            el.addEventListener('change', calculateTotal);
        });

        container.appendChild(clone);
        updateIndices(catId);
        if (!existingData) calculateTotal(); // auto calc when adding new empty
    }

    // --- Core Calculation Logic ---
    function calculateTotal() {
        state.items = { cat1: [], cat2: [], cat3: [], cat4: [], cat5: [], cat6: [] };

        // 1. Rebuild state from DOM
        for (let i = 1; i <= 6; i++) {
            const catId = `cat${i}`;
            const rows = document.getElementById(`${catId}-items`).querySelectorAll('.item-row');

            rows.forEach(row => {
                const itemData = { id: row.getAttribute('data-id') };
                row.querySelectorAll('select, input').forEach(input => {
                    itemData[input.name] = input.value;
                });
                state.items[catId].push(itemData);
            });
        }

        // 2. Calculate category scores
        let scores = { cat1: 0, cat2: 0, cat3: 0, cat4: 0, cat5: 0, cat6: 0 };
        let cat5bTotal = 0; // Track policy docs specifically for capping

        for (let i = 1; i <= 6; i++) {
            const catId = `cat${i}`;
            state.items[catId].forEach(item => {
                // Find the specific row to inject the breakdown
                const rowElem = document.querySelector(`.item-row[data-id="${item.id}"]`);

                const detail = getScoreDetail(catId, item, state.facultyType);
                scores[catId] += detail.score;

                // Inject score detail into the UI
                if (rowElem) {
                    let scoreDisplay = rowElem.querySelector('.item-score-display');
                    if (!scoreDisplay) {
                        scoreDisplay = document.createElement('div');
                        scoreDisplay.className = 'item-score-display';
                        rowElem.appendChild(scoreDisplay);
                    }
                    scoreDisplay.innerHTML = `<strong>Item Score: <span class="text-accent">${detail.score.toFixed(2)}</span></strong><br><span class="text-muted small-text">${detail.breakdown}</span>`;
                }

                // Special tracking for 5(b) - Policy Docs
                if (catId === 'cat5' && item.patType && item.patType.startsWith('pol_')) {
                    cat5bTotal += detail.score;
                }
            });
            document.getElementById(`${catId}-score`).textContent = scores[catId].toFixed(2);
        }

        // 3. Apply 30% Capping Rule
        // Capping applies to Category 5(b) + Category 6 combined
        const nonCappedScoreTotal = scores.cat1 + scores.cat2 + scores.cat3 + scores.cat4 + (scores.cat5 - cat5bTotal);
        const cappedRawTotal = cat5bTotal + scores.cat6;

        let finalCappedVal = cappedRawTotal;
        const potentialGrandTotal = nonCappedScoreTotal + cappedRawTotal;

        // The rule: (5b+6) cannot exceed 30% of the TOTAL research score.
        // Let X = Non-capped, Y = Raw Capped. Total = X + min(Y, 0.3 * Total)
        // Max allowable Y = 0.3 * Total => Max Y = 0.3 * (X + Max Y) => 0.7 * Max Y = 0.3 * X => Max Y = (0.3 / 0.7) * X
        const maxAllowableCapped = (0.3 / 0.7) * nonCappedScoreTotal;

        if (cappedRawTotal > maxAllowableCapped && nonCappedScoreTotal > 0) {
            finalCappedVal = maxAllowableCapped;
        } else if (nonCappedScoreTotal === 0 && cappedRawTotal > 0) {
            // Edge case: if they ONLY have capped items, their score is 0.
            finalCappedVal = 0;
        }

        const grandTotal = nonCappedScoreTotal + finalCappedVal;

        // 4. Update UI
        document.getElementById('base-score').textContent = nonCappedScoreTotal.toFixed(2);

        const cappedDisplay = document.getElementById('capped-score');
        cappedDisplay.textContent = finalCappedVal.toFixed(2);
        if (cappedRawTotal > finalCappedVal) {
            cappedDisplay.style.color = 'var(--warning)';
            cappedDisplay.title = `Capped from original ${cappedRawTotal.toFixed(2)}`;
        } else {
            cappedDisplay.style.color = '#e2e8f0';
            cappedDisplay.title = '';
        }

        document.getElementById('grand-total').textContent = grandTotal.toFixed(2);

        // 5. Calculate Verdict
        let activeCategoryCount = 0;
        for (let i = 1; i <= 6; i++) {
            if (scores[`cat${i}`] > 0) activeCategoryCount++;
        }
        activeCatDisplay.textContent = `${activeCategoryCount} / 6`;

        verdictBanner.className = 'verdict-banner'; // reset classes
        if (grandTotal === 0) {
            verdictTitle.textContent = "Pending";
            verdictText.textContent = "Waiting for data input...";
        } else if (grandTotal >= 110 && activeCategoryCount >= 3) {
            verdictBanner.classList.add('verdict-success');
            verdictTitle.textContent = "Qualified ✅";
            verdictText.textContent = `Score: ${grandTotal.toFixed(2)} (>= 110) | Active Categories: ${activeCategoryCount} (>= 3)`;
        } else {
            verdictBanner.classList.add('verdict-fail');
            verdictTitle.textContent = "Not Qualified ❌";

            let failReasons = [];
            if (grandTotal < 110) failReasons.push(`Score: ${grandTotal.toFixed(2)} (Target: 110)`);
            if (activeCategoryCount < 3) failReasons.push(`Active Categories: ${activeCategoryCount} (Target: 3)`);

            verdictText.textContent = failReasons.join(" AND ");
        }

        saveToLocal();
    }

    // --- JSON Export/Import & Local Storage ---
    function saveToLocal() {
        localStorage.setItem('cas_score_state', JSON.stringify(state));
    }

    function loadFromLocal() {
        const saved = localStorage.getItem('cas_score_state');
        if (saved) {
            try {
                const parsedState = JSON.parse(saved);
                restoreState(parsedState);
            } catch (e) {
                console.error("Local storage parse error", e);
                addItem('cat1');
            }
        } else {
            addItem('cat1');
        }
    }

    function restoreState(parsedState) {
        state.facultyType = parsedState.facultyType || 'science';
        state.applicantName = parsedState.applicantName || '';

        nameInput.value = state.applicantName;
        facultySelect.value = state.facultyType;

        for (let i = 1; i <= 6; i++) {
            document.getElementById(`cat${i}-items`).innerHTML = '';
            state.items[`cat${i}`] = [];
        }

        for (let i = 1; i <= 6; i++) {
            const arr = parsedState.items[`cat${i}`] || [];
            arr.forEach(itemData => addItem(`cat${i}`, itemData));
        }

        calculateTotal();
    }

    function exportJSON() {
        calculateTotal();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const dlAnchorElem = document.createElement('a');

        // Dynamic Filename
        const dateStr = new Date().toISOString().split('T')[0];
        const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        const safeName = state.applicantName ? state.applicantName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'applicant';
        const filename = `cas_score_${safeName}_${dateStr}_${timeStr}.json`;

        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", filename);
        dlAnchorElem.click();
    }

    function importJSON(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
            try {
                const parsedState = JSON.parse(evt.target.result);
                if (!parsedState.facultyType || !parsedState.items) {
                    throw new Error("Invalid JSON format");
                }
                restoreState(parsedState);
            } catch (err) {
                alert("Error loading backup: " + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // --- Print Report Generation ---
    function generatePrintReport() {
        calculateTotal(); // Ensure scores are up to date

        const dateStr = new Date().toLocaleDateString();
        const timeStr = new Date().toLocaleTimeString();
        const facultyName = state.facultyType === 'science'
            ? 'Sciences/Engineering/Agriculture/Medical/Veterinary'
            : 'Languages/Humanities/Arts/Social Sciences/Library/Education/Physical Education/Commerce/Management';

        // Get Summary Scores
        const baseScore = document.getElementById('base-score').textContent;
        const cappedScore = document.getElementById('capped-score').textContent;
        const grandTotal = document.getElementById('grand-total').textContent;
        const activeCategories = document.getElementById('active-categories').textContent;
        const verdictTitleText = verdictTitle.textContent;
        const verdictMsg = verdictText.textContent;

        const catNames = {
            cat1: "1. Research Papers in Peer-Reviewed or UGC listed Journals",
            cat2: "2. Publications (other than Research papers)",
            cat3: "3. Creation of ICT mediated Teaching Learning pedagogy and content and development of new and innovative courses and curricula",
            cat4: "4. Research guidance / Research Projects Completed / Research Projects Ongoing / Consultancy",
            cat5: "5. Patents / Policy Document / Awards/Fellowship",
            cat6: "6. *Invited lectures / Resource Person/ paper presentation in Seminars/ Conferences/full paper in Conference Proceedings"
        };

        const getHeaderHTML = () => `
            <div class="print-header">
                <h2>Academic/Research Score Calculator Report</h2>
                <p>Based on UGC Regulations 2018 (Annexure II, Table 2)</p>
            </div>
            
            <div class="print-meta">
                <div><strong>Applicant Name:</strong> ${state.applicantName || 'N/A'}</div>
                <div><strong>Generated On:</strong> ${dateStr} ${timeStr}</div>
            </div>
            
            <div style="margin-bottom: 20px; font-size: 14px;">
                <strong>Faculty Type:</strong> ${facultyName}
            </div>
        `;

        let reportHTML = '';

        for (let i = 1; i <= 6; i++) {
            const catId = `cat${i}`;
            const items = state.items[catId];

            if (items && items.length > 0) {
                reportHTML += `
                <div class="print-page-section">
                    ${getHeaderHTML()}
                    <table class="print-table">
                        <thead>
                            <tr class="print-category-header">
                                <th colspan="5" style="text-align: left; font-size: 14px; font-weight: bold; background-color: #ddd;">${catNames[catId]}</th>
                            </tr>
                            <tr>
                                <th width="5%">#</th>
                                <th width="45%">Details / Citation</th>
                                <th width="20%">Type / Metrics</th>
                                <th width="20%">Breakdown</th>
                                <th width="10%">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                items.forEach((item, index) => {
                    const rowElem = document.querySelector(`.item-row[data-id="${item.id}"]`);
                    let metricsArr = [];
                    rowElem.querySelectorAll('select option:checked').forEach(opt => {
                        metricsArr.push(opt.textContent);
                    });

                    let detailsStr = item.details || 'N/A';
                    if (catId === 'cat1') {
                        let linksHtml = [];
                        if (item.paperUrl) linksHtml.push(`<a href="${item.paperUrl}" target="_blank" style="color: #3b82f6; text-decoration: underline;">Paper/DOI</a>`);
                        if (item.webOfScienceUrl) linksHtml.push(`<a href="${item.webOfScienceUrl}" target="_blank" style="color: #3b82f6; text-decoration: underline;">WoS/Scopus</a>`);
                        if (linksHtml.length > 0) {
                            detailsStr += `<div style="margin-top: 4px; font-size: 0.85em;"><strong>Links:</strong> ${linksHtml.join(' | ')}</div>`;
                        }
                    }
                    const metricsStr = metricsArr.join(', ');
                    const detailScore = getScoreDetail(catId, item, state.facultyType);

                    reportHTML += `
                    <tr>
                        <td style="text-align:center; font-weight:bold;">${index + 1}</td>
                        <td>${detailsStr}</td>
                        <td>${metricsStr}</td>
                        <td style="font-size:10px;">${detailScore.breakdown}</td>
                        <td style="font-weight:bold;">${detailScore.score.toFixed(2)}</td>
                    </tr>
                    `;
                });

                reportHTML += `
                        </tbody>
                    </table>
                </div>`;
            }
        }

        reportHTML += `
            <div class="print-page-section">
                ${getHeaderHTML()}
                <table class="print-summary-table" style="width: 100%; margin-left: 0;">
                    <tr><th colspan="2" style="background:#eee; text-align:center;">Score Summary</th></tr>
                    <tr><td>Base Score:</td><td style="font-weight:bold; text-align:right;">${baseScore}</td></tr>
                    <tr><td>Capped Items (5b+6):</td><td style="font-weight:bold; text-align:right;">${cappedScore}</td></tr>
                    <tr><td>Total Research Score:</td><td style="font-weight:bold; text-align:right; font-size:16px;">${grandTotal}</td></tr>
                    <tr><td>Active Categories:</td><td style="text-align:right;">${activeCategories}</td></tr>
                </table>

                <div class="print-verdict-box">
                    <div style="font-size: 18px; margin-bottom: 5px;">${verdictTitleText}</div>
                    <div style="font-size: 14px; font-weight: normal;">${verdictMsg}</div>
                </div>
            </div>
        `;

        printArea.innerHTML = reportHTML;
        window.print();
    }

    // Initialize
    loadFromLocal();
});
