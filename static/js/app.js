let selectedFile = null;
let historyPage = 0;
const PAGE_SIZE = 20;
let historyLoaded = false;
let dashboardLoaded = false;

document.addEventListener('DOMContentLoaded', init);

function init() {
    setupTabs();
    setupClassifyForm();
    checkHealth();
    setInterval(checkHealth, 60000);
    setupDropZone();
    setupBatchForm();
    setupHistoryPagination();
    setupExportCsv();
}

function setupTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(tabName) {
    //Deactivate all tabs and buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });

    //Activate selected tab and button
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
    const section = document.getElementById('tab-' + tabName);
    section.classList.remove('hidden');
    section.classList.add('active');

    // Lazy-load data (always refresh on tab switch)
    if (tabName === 'history') { historyPage = 0; loadHistory(); }
    if (tabName === 'dashboard') loadStats();
}

async function checkHealth() {
    const dot = document.getElementById('healthDot');
    const text = document.getElementById('healthText');
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (data.status === 'healthy') {
            dot.className = 'health-dot healthy';
            text.textContent = 'API Connected';
        } else {
            dot.className = 'health-dot unhealthy';
            text.textContent = 'API Unhealthy';
        }
    } catch {
        dot.className = 'health-dot unhealthy';
        text.textContent = 'API Unreachable';
    }
}

const EXAMPLE_EMAILS = [
    "Hi Team,\n\nPlease find attached the Q4 compliance audit report for review. We need sign-off from all department heads by end of week. The key findings are summarized on page 3.\n\nRegards,\nSarah Chen\nCompliance Department",
    "CONGRATULATIONS!!! You've been selected as our LUCKY WINNER! Claim your $10,000 prize NOW by clicking here! This offer expires in 24 HOURS! Act fast! Forward to 10 friends for BONUS prizes!!!",
    "Dear Accounts Team,\n\nI wanted to follow up on invoice #4521 for the advisory services rendered in February. Our records show this is still outstanding. Could you please confirm the payment status and expected processing date?\n\nThank you,\nMichael Torres\nFinance Operations"
];

function setupClassifyForm() {
    const textarea = document.getElementById('classifyText');
    const charCount = document.getElementById('classifyCharCount');

    document.getElementById('classifyForm').addEventListener('submit', classifySingle);

    // Character count
    textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        charCount.textContent = len.toLocaleString() + ' character' + (len !== 1 ? 's' : '');
    });

    // Ctrl+Enter to submit
    textarea.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('classifyForm').requestSubmit();
        }
    });

    // Clear
    document.getElementById('classifyClearBtn').addEventListener('click', () => {
        textarea.value = '';
        charCount.textContent = '0 characters';
        document.getElementById('singleResult').classList.add('hidden');
        selectedFile = null;
        const input = document.getElementById('fileInput');
        if (input) input.value = '';
        document.getElementById('fileInfo').classList.add('hidden');
        document.getElementById('dropZoneContent').classList.remove('hidden');
    });

    // Try an example
    document.getElementById('tryExampleBtn').addEventListener('click', () => {
        const example = EXAMPLE_EMAILS[Math.floor(Math.random() * EXAMPLE_EMAILS.length)];
        textarea.value = example;
        charCount.textContent = example.length.toLocaleString() + ' characters';
        textarea.focus();
    });
}

async function classifySingle(e) {
    e.preventDefault();
    const text = document.getElementById('classifyText').value.trim();
    if (!text && !selectedFile) {
        showToast('Please enter email text or select a file to classify', 'error');
        return;
    }

    setLoading('classifyBtn', true);
    try {
        const formData = new FormData();
        if (text) formData.append('text', text);
        if (selectedFile) formData.append('file', selectedFile);

        const res = await fetch('/api/classify', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Classification failed', 'error');
            return;
        }

        renderSingleResult(data);
        showToast('Classification successful', 'success');
        setTimeout(() => {
            document.getElementById('singleResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } catch {
        showToast('Network error occurred. Is the server running?', 'error');
    } finally {
        setLoading('classifyBtn', false);
    }
}

function renderSingleResult(data) {
    const container = document.getElementById('singleResult');
    const cls = data.classification === 'Productive' ? 'productive' : 'non-productive';
    const clsBadge = cls === 'productive' ? 'badge-productive' : 'badge-non-productive';
    const confBadge = 'badge-' + data.confidence.toLowerCase();

    container.innerHTML = `
        <div class="result-card ${cls}">
            <div class="result-header">
                <span class="badge ${clsBadge}">${escapeHtml(data.classification)}</span>
                <span class="badge ${confBadge}">${escapeHtml(data.confidence)} confidence</span>
            </div>
            <div class="result-section">
                <div class="result-label">Reasoning</div>
                <div class="result-text">${escapeHtml(data.reasoning)}</div>
            </div>
            <div class="result-section">
                <div class="result-label">Suggested Response</div>
                <div class="suggested-reply">
                    <button class="copy-btn" data-text="${escapeHtml(data.suggested_reply)}">Copy</button>
                    <div class="result-text reply-text">${escapeHtml(data.suggested_reply)}</div>
                </div>
            </div>
        </div>
    `;
    container.classList.remove('hidden');
}

function copyReply(btn) {
    const text = btn.parentElement.querySelector('.reply-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
        showToast('Suggested reply copied to clipboard', 'success');
    });
}

function showToast(message, type = 'error') {
    const container =document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => container.removeChild(toast), 300);
    }, 4000);
}

function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    btn.disabled = loading;
    btn.querySelector('.btn-text').classList.toggle('hidden', loading);
    btn.querySelector('.spinner').classList.toggle('hidden', !loading);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function setupDropZone() {
    const zone = document.getElementById('dropZone');
    const input = document.getElementById('fileInput');

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', e => { e.preventDefault(); zone.classList.remove('drag-over'); });
    zone.addEventListener('dragenter', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {if (input.files.length) handleFile(input.files[0]); });

    document.getElementById('fileRemoveBtn').addEventListener('click', e => {
        e.stopPropagation();
        selectedFile = null;
        input.value = '';
        document.getElementById('fileInfo').classList.add('hidden');
        document.getElementById('dropZoneContent').classList.remove('hidden');
    });
}

function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'pdf'].includes(ext)) {
        showToast('Only .txt and .pdf files are supported', 'error');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be under 5MB', 'error');
        return;
    }

    selectedFile = file;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
    document.getElementById('fileInfo').classList.remove('hidden');
    document.getElementById('dropZoneContent').classList.add('hidden');
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function setupBatchForm() {
    const textEl = document.getElementById('batchText');
    const delimEl = document.getElementById('batchDelimiter');
    const countEl = document.getElementById('emailCount');

    function updateCount() {
        const count = splitBatch().length;
        countEl.textContent = count + ' email' + (count !== 1 ? 's' : '') + ' detected';
    }

    textEl.addEventListener('input', updateCount);
    delimEl.addEventListener('input', updateCount);

    document.getElementById('batchForm').addEventListener('submit', classifyBatch);
    document.getElementById('batchClearBtn').addEventListener('click', () => {
        textEl.value = '';
        document.getElementById('batchResults').classList.add('hidden');
        updateCount();
    });

    document.getElementById('tryBatchExampleBtn').addEventListener('click', () => {
        const delim = delimEl.value || '---';
        textEl.value = EXAMPLE_EMAILS.join('\n' + delim + '\n');
        updateCount();
        textEl.focus();
    });
}

function splitBatch() {
    const text = document.getElementById('batchText').value;
    const delim = document.getElementById('batchDelimiter').value || '---';
    return text.split(delim).map(s => s.trim()).filter(s => s.length > 0);
}

async function classifyBatch(e) {
    e.preventDefault();
    const emails = splitBatch();
    if (emails.length === 0) {
        showToast('No emails to classify.', 'error');
        return;
    }
    if (emails.length > 20) {
        showToast('Maximum 20 emails per batch.', 'error');
        return;
    }

    setLoading('batchBtn', true);
    try {
        const res = await fetch('/api/classify/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({ emails })
        });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.detail || 'Batch classification failed', 'error');
            return;
        }

        renderBatchResult(data);
        showToast(`Classified ${data.count} emails.`, 'success');
        setTimeout(() => {
            document.getElementById('batchResults').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } catch {
        showToast('Network error occurred. Is the server running?', 'error');
    } finally {
        setLoading('batchBtn', false);
    }
}

function renderBatchResult(data) {
    const container = document.getElementById('batchResults');
    const productive = data.results.filter(r => r.classification === 'Productive').length;
    const nonProductive = data.results.filter(r => r.classification === 'Non-Productive').length;

    let html = `<div class="batch-summary">
        <span>Total: ${data.count}</span>
        <span style="color: #6ee7b7">Productive: ${productive}</span>
        <span style="color: #fca5a5">Non-Productive: ${nonProductive}</span>
    </div>`;

    data.results.forEach((result, i) => {
        const cls = result.classification === 'Productive' ? 'productive' : 'non-productive';
        const clsBadge = cls === 'productive' ? 'badge-productive' : 'badge-non-productive';
        const confBadge = result.confidence ? 'badge-' + result.confidence.toLowerCase() : '';

        html += `
        <div class="result-card ${cls}">
            <div class="result-header">
                <strong>Email ${i + 1}</strong>
                <span class="badge ${clsBadge}">${escapeHtml(result.classification)}</span>
                ${result.confidence ? `<span class="badge ${confBadge}">${escapeHtml(result.confidence)}</span>` : ''}
            </div>
            <div class="result-section">
                <div class="result-text">${escapeHtml(result.reasoning)}</div>
            </div>
            ${result.suggested_reply ? `
                <div class="result-section">
                    <div class="result-label">Suggested Response</div>
                    <div class="suggested-reply">
                        <button class="copy-btn" onclick="copyReply(this)">Copy</button>
                        <div class="result-text reply-text">${escapeHtml(result.suggested_reply)}</div>
                    </div>
                </div>
            ` : ''}
        </div>
        `;
    });

    container.innerHTML = html;
    container.classList.remove('hidden');
}

// History
function skeletonRows(count) {
    return Array(count).fill('').map(() => `<tr>
        <td><div class="skeleton skeleton-cell skeleton-cell--md"></div></td>
        <td><div class="skeleton skeleton-cell skeleton-cell--sm"></div></td>
        <td><div class="skeleton skeleton-cell skeleton-cell--sm"></div></td>
        <td><div class="skeleton skeleton-cell skeleton-cell--lg"></div></td>
        <td><div class="skeleton skeleton-cell skeleton-cell--sm"></div></td>
    </tr>`).join('');
}

async function loadHistory() {
    const body = document.getElementById('historyBody');
    body.innerHTML = skeletonRows(5);

    try {
        const res = await fetch(`/api/history?limit=${PAGE_SIZE}&offset=${historyPage * PAGE_SIZE}`);
        const data = await res.json();

        if (data.length === 0 && historyPage === 0) {
            body.innerHTML = `<tr><td colspan="5" class="table-empty">
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/></svg>
                    <p>No classifications yet. Classify an email to see it here.</p>
                    <button class="btn btn-primary btn-sm" onclick="switchTab('classify')">Classify an Email</button>
                </div>
            </td></tr>`;
            document.getElementById('prevPage').disabled = true;
            document.getElementById('nextPage').disabled = true;
            historyLoaded = true;
            return;
        }

        body.innerHTML = data.map(row => {
            const cls = row.classification === 'Productive' ? 'productive' : 'non-productive';
            const clsBadge = cls === 'productive' ? 'badge-productive' : 'badge-non-productive';
            const confBadge = row.confidence ? 'badge-' + row.confidence.toLowerCase() : '';
            const preview = row.input_text.length > 80 ? row.input_text.slice(0, 80) + '...' : row.input_text;
            return `<tr>
                <td>${formatTime(row.timestamp)}</td>
                <td><span class="badge ${clsBadge}">${escapeHtml(row.classification)}</span></td>
                <td><span class="badge ${confBadge}">${escapeHtml(row.confidence)}</span></td>
                <td class="preview-text" title="${escapeHtml(row.input_text)}">${escapeHtml(preview)}</td>
                <td>${row.was_retried ? 'Yes' : 'No'}</td>
            </tr>`;
        }).join('');

        document.getElementById('prevPage').disabled = historyPage === 0;
        document.getElementById('nextPage').disabled = data.length < PAGE_SIZE;
        document.getElementById('pageInfo').textContent = 'Page ' + (historyPage + 1);
        historyLoaded = true;
    } catch {
        body.innerHTML = '<tr><td colspan="5" class="table-empty">Failed to load history.</td></tr>';
    }
}

function formatTime(iso) {
    return new Date(iso).toLocaleString();
}

function setupHistoryPagination() {
    document.getElementById('prevPage').addEventListener('click', () => {
        if (historyPage > 0) { historyPage--; loadHistory(); }
    });
    document.getElementById('nextPage').addEventListener('click', () => {
        historyPage++;
        loadHistory();
    });
}

// Dashboard
const BAR_COLORS = {
    'Productive': 'var(--productive)',
    'Non-Productive': 'var(--non-productive)',
    'High': 'var(--confidence-high)',
    'Medium': 'var(--confidence-medium)',
    'Low': 'var(--confidence-low)'
};

async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        if (data.message) {
            document.getElementById('statTotal').textContent = '0';
            document.getElementById('statProductive').textContent = '—';
            document.getElementById('statRetried').textContent = '0';
            document.getElementById('classificationChart').innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No data yet.</p>';
            document.getElementById('confidenceChart').innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No data yet.</p>';
            dashboardLoaded = true;
            return;
        }

        animateCounter('statTotal', data.total);
        animateCounter('statProductive', data.productive_pct, 1, '%');
        animateCounter('statRetried', data.retried);

        renderBarChart('classificationChart', data.by_classification, data.total);
        renderBarChart('confidenceChart', data.by_confidence, data.total);
        dashboardLoaded = true;
    } catch {
        showToast('Failed to load dashboard stats.', 'error');
    }
}

function renderBarChart(containerId, dataObj, total) {
    const container = document.getElementById(containerId);
    const sorted = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
    container.innerHTML = sorted.map(([label, count]) => {
        const pct = total > 0 ? (count / total * 100).toFixed(1) : 0;
        const color = BAR_COLORS[label] || 'var(--primary)';
        return `<div class="bar-row">
            <span class="bar-label">${escapeHtml(label)}</span>
            <div class="bar-track">
                <div class="bar-fill" style="background:${color}" data-width="${pct}%"></div>
            </div>
            <span class="bar-value">${count} (${pct}%)</span>
        </div>`;
    }).join('');

    // Animate bars after render
    setTimeout(() => {
        container.querySelectorAll('.bar-fill').forEach(bar => {
            bar.style.width = bar.dataset.width;
        });
    }, 50);
}

// Animated number counter
function animateCounter(elementId, target, decimals = 0, suffix = '') {
    const el = document.getElementById(elementId);
    const duration = 800;
    const start = performance.now();
    const from = 0;

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + (target - from) * eased;
        el.textContent = current.toFixed(decimals) + suffix;
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// Export history to CSV
function setupExportCsv() {
    document.getElementById('exportCsvBtn').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/history?limit=1000&offset=0');
            const data = await res.json();
            if (data.length === 0) {
                showToast('No data to export.', 'error');
                return;
            }

            const headers = ['Time', 'Classification', 'Confidence', 'Input Text', 'Reasoning', 'Suggested Reply', 'Retried'];
            const rows = data.map(row => [
                row.timestamp,
                row.classification,
                row.confidence,
                '"' + (row.input_text || '').replace(/"/g, '""') + '"',
                '"' + (row.reasoning || '').replace(/"/g, '""') + '"',
                '"' + (row.suggested_reply || '').replace(/"/g, '""') + '"',
                row.was_retried ? 'Yes' : 'No'
            ]);

            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'classification-history.csv';
            a.click();
            URL.revokeObjectURL(url);
            showToast('History exported to CSV.', 'success');
        } catch {
            showToast('Failed to export history.', 'error');
        }
    });
}