/**
 * theme.js — Settings panel + theme switching (used on all pages)
 * ================================================================
 * - Reads saved theme from localStorage and applies it immediately
 * - Wires up the Settings gear button, close button, overlay dismiss
 * - Wires up the hamburger menu for mobile
 * - Theme choice persists across page loads and all pages
 *
 * Include this script on every HTML page BEFORE page-specific scripts.
 */

(function () {

    // ── Apply saved theme instantly (before paint) ──────────────────────────
    const saved = localStorage.getItem('fa-theme') || 'dark';
    if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');

    // ── Wait for DOM ─────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {

        // ── SETTINGS PANEL ───────────────────────────────────────────────────
        const panel        = document.getElementById('settings-panel');
        const overlay      = document.getElementById('settings-overlay');
        const btnOpen      = document.getElementById('btn-settings');
        const btnClose     = document.getElementById('btn-close-settings');
        const drawerLink   = document.getElementById('drawer-settings-link');
        const themeOptions = document.querySelectorAll('.theme-option');

        function openSettings() {
            panel?.classList.add('open');
            overlay?.classList.add('open');
            document.body.style.overflow = 'hidden';
            closeDrawer();
        }

        function closeSettings() {
            panel?.classList.remove('open');
            overlay?.classList.remove('open');
            document.body.style.overflow = '';
        }

        btnOpen?.addEventListener('click', openSettings);
        btnClose?.addEventListener('click', closeSettings);
        overlay?.addEventListener('click', closeSettings);
        drawerLink?.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });

        // Close settings with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSettings();
                closeDrawer();
            }
        });

        // ── THEME SWITCHER ───────────────────────────────────────────────────
        function applyTheme(theme) {
            if (theme === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            localStorage.setItem('fa-theme', theme);

            // Update active state on theme option buttons
            themeOptions.forEach(opt => {
                const isActive = opt.dataset.themeChoice === theme;
                opt.classList.toggle('active', isActive);
                opt.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        }

        // Set correct active state on load
        applyTheme(saved);

        themeOptions.forEach(opt => {
            opt.addEventListener('click', () => applyTheme(opt.dataset.themeChoice));
        });

        // ── HAMBURGER MENU ───────────────────────────────────────────────────
        const hamburger  = document.getElementById('btn-hamburger');
        const navDrawer  = document.getElementById('nav-drawer');

        function closeDrawer() {
            hamburger?.classList.remove('open');
            navDrawer?.classList.remove('open');
            hamburger?.setAttribute('aria-expanded', 'false');
        }

        hamburger?.addEventListener('click', () => {
            const isOpen = navDrawer?.classList.toggle('open');
            hamburger.classList.toggle('open', isOpen);
            hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        // Close drawer when a link is clicked
        navDrawer?.querySelectorAll('a.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                if (!link.id) closeDrawer(); // don't close for the settings link (handled above)
            });
        });

        // Close drawer on outside click
        document.addEventListener('click', (e) => {
            if (
                navDrawer?.classList.contains('open') &&
                !navDrawer.contains(e.target) &&
                !hamburger.contains(e.target)
            ) closeDrawer();
        });

    });

})();
