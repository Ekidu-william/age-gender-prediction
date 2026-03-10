// history.js — Prediction history page

async function load(page = 1) {
    show('loading-msg');
    hide('table-wrap');
    hide('empty-msg');
    hide('error-msg');

    try {
        const res = await fetch(`/history?page=${page}`);
        const data = await res.json();

        hide('loading-msg');

        // Server or DB error
        if (!res.ok || data.error) {
            document.getElementById('error-text').textContent =
                data.error || `Server returned ${res.status}`;
            show('error-msg');
            return;
        }

        // No records yet
        if (!data.predictions || data.predictions.length === 0) {
            show('empty-msg');
            return;
        }

        // Populate table
        document.getElementById('total-badge').textContent = `${data.total} total`;
        show('table-wrap');

        document.getElementById('table-body').innerHTML = data.predictions.map((p, i) => `
            <tr>
                <td>${(page - 1) * 20 + i + 1}</td>
                <td class="filename-cell" title="${esc(p.image_name)}">${esc(p.image_name)}</td>
                <td><strong>${p.predicted_age}</strong> yrs</td>
                <td><span class="g-badge g-${p.predicted_gender.toLowerCase()}">${esc(p.predicted_gender)}</span></td>
                <td>${parseFloat(p.gender_confidence).toFixed(1)}%</td>
                <td class="date-cell">${formatDate(p.created_at)}</td>
                <td><button class="btn-del" onclick="del(${p.id}, this)">🗑🗑️</button></td>
            </tr>
        `).join('');

        // Pagination
        const pag = document.getElementById('pagination');
        pag.innerHTML = '';
        if (data.pages > 1) {
            for (let i = 1; i <= data.pages; i++) {
                const b = document.createElement('button');
                b.className = 'pg-btn' + (i === page ? ' active' : '');
                b.textContent = i;
                b.onclick = () => load(i);
                pag.appendChild(b);
            }
        }

    } catch (err) {
        hide('loading-msg');
        document.getElementById('error-text').textContent =
            'Could not reach the server. Is node server.js running?';
        show('error-msg');
        console.error('History load error:', err);
    }
}

async function del(id, btn) {
    if (!confirm('Delete this prediction record?')) return;
    try {
        const res = await fetch(`/prediction/${id}`, { method: 'DELETE' });
        if (res.ok) {
            const row = btn.closest('tr');
            row.style.transition = 'opacity 0.3s';
            row.style.opacity = '0';
            setTimeout(() => row.remove(), 300);
        } else {
            alert('Delete failed.');
        }
    } catch (err) {
        alert('Delete failed: ' + err.message);
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function show(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
}
function hide(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}
function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function formatDate(ts) {
    try {
        return new Date(ts).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return ts; }
}

load();