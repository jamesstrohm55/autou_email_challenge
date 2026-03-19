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

    // Lazy-load data
    if (tabName === 'history' && !historyLoaded) loadHistory();
    if (tabName === 'dashboard' && !dashboardLoaded) loadStats();
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

function setupClassifyForm() {
    document.getElementById('classifyForm').addEventListener('submit', classifySingle);
    document.getElementById('classifyClearBtn').addEventListener('click', () => {
        document.getElementById('classifyInput').value = '';
        document.getElementById('singleResult').classList.add('hidden');
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
    document.getElementById('fileInfo').classList.remove('hidden');
    document.getElementById('dropZoneContent').classList.add('hidden');
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

    let html = ` <div class="batch-summary">
        <span>Total: ${data.count}</span>
        <span style="color: var(--productive)">Productive: ${productive}</span>
        <span style="color: var(--non-productive)">Non-Productive: ${nonProductive}</span>
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
async function loadHistory() {
    const body = document.getElementById('historyBody');
    body.innerHTML = '<tr><td colspan="5" class="table-empty">Loading...</td></tr>';

    try {
        const res = await fetch(`/api/history?limit=${PAGE_SIZE}&offset=${historyPage * PAGE_SIZE}`);
        const data = await res.json();

        if (data.length === 0 && historyPage === 0) {
            body.innerHTML = '<tr><td colspan="5" class="table-empty">No classifications yet.</td></tr>';
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