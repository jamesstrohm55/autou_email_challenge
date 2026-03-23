const i18n = (() => {
    const cache = {};
    let current = 'en';
    let strings = {};

    async function load(lang) {
        if (cache[lang]) {
            strings = cache[lang];
            current = lang;
            return;
        }
        try {
            const res = await fetch(`/static/i18n/${lang}.json`);
            cache[lang] = await res.json();
            strings = cache[lang];
            current = lang;
        } catch {
            console.warn(`i18n: failed to load ${lang}, falling back to defaults`);
        }
    }

    function t(key, replacements) {
        let val = strings[key] || key;
        if (replacements) {
            Object.entries(replacements).forEach(([k, v]) => {
                val = val.replace(new RegExp(`{{${k}}}`, 'g'), v);
            });
        }
        return val;
    }

    function apply() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            el.innerHTML = t(el.dataset.i18nHtml);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = t(el.dataset.i18nPlaceholder);
        });
        document.title = t('meta.title');
        document.documentElement.lang = current === 'pt-BR' ? 'pt-BR' : 'en';
    }

    async function init() {
        const saved = localStorage.getItem('lang') || 'en';
        // Preload both so switching is instant
        await Promise.all([load('en'), load('pt-BR')]);
        await load(saved);
        apply();
    }

    async function setLang(lang) {
        await load(lang);
        localStorage.setItem('lang', lang);
        apply();
    }

    function getLang() { return current; }

    return { init, setLang, getLang, t, apply };
})();
