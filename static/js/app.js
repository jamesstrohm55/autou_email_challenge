let selectedFile = null;
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupTabs();
    setupClassifyForm();
    checkHealth();
    setInterval(checkHealth, 60000);
    setupDropZone();
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
    if (file.sizae > 5 * 1024 *1024) {
        showToast('File size must be under 5MB', 'error');
        return;
    }

    selectedFile = file;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileInfo').classList.remove('hidden');
    document.getElementById('dropZoneContent').classList.add('hidden');
}