// stats.js
async function loadStats() {
    const res = await fetch('/stats');
    const d = await res.json();

    document.getElementById('s-total').textContent = d.total_predictions ?? 0;
    document.getElementById('s-avg').textContent = d.avg_age ? Math.round(d.avg_age) : '—';
    document.getElementById('s-min').textContent = d.min_age ?? '—';
    document.getElementById('s-max').textContent = d.max_age ?? '—';
    document.getElementById('s-male').textContent = d.male_count ?? 0;
    document.getElementById('s-female').textContent = d.female_count ?? 0;

    const total = (d.male_count || 0) + (d.female_count || 0);
    if (total > 0) {
        const mp = Math.round((d.male_count / total) * 100);
        const fp = 100 - mp;
        document.getElementById('g-male-fill').style.width = mp + '%';
        document.getElementById('g-female-fill').style.width = fp + '%';
        document.getElementById('g-male-pct').textContent = `Male: ${mp}%`;
        document.getElementById('g-female-pct').textContent = `Female: ${fp}%`;
    }
}

loadStats();