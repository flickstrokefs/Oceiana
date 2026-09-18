with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add capturing-phase navigation script in <head>
nav_script = '''
<script>
// Capture-phase click interceptor to guarantee navigation to the 3D Globe app
(function() {
  function navigateToGlobe(e) {
    var target = e.target;
    if (!target) return;
    
    // Check if target or parent matches any CTA
    var el = target.closest('a, button, [role="button"], [data-framer-name="Primary Button"], [data-framer-name="Default"]');
    var text = ((target.innerText || target.textContent || '')).trim().toUpperCase();
    var elText = (el ? (el.innerText || el.textContent || '') : '').trim().toUpperCase();
    
    var isExplore = text.includes('EXPLORE ARIEL') || elText.includes('EXPLORE ARIEL') || text.includes('LAUNCH ARIEL') || elText.includes('LAUNCH ARIEL');
    var isGlobeBtn = target.closest('#ariel-globe-launcher') || (el && el.getAttribute('href') && (el.getAttribute('href').indexOf('app.html') !== -1 || el.getAttribute('href') === '/app'));
    
    if (isExplore || isGlobeBtn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.location.href = '/app.html';
      return false;
    }
  }

  window.addEventListener('click', navigateToGlobe, true);
  document.addEventListener('click', navigateToGlobe, true);
})();
</script>
'''

# 2. Add floating top-right CTA button right after <body> tag
floating_cta = '''
<!-- Direct 3D Globe Launcher Banner & Button -->
<div id="ariel-globe-launcher" style="position: fixed; top: 16px; right: 24px; z-index: 9999999; display: flex; gap: 12px; align-items: center;">
  <a href="/app.html" style="display: inline-flex; align-items: center; gap: 8px; padding: 11px 22px; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); color: #000; font-weight: 800; font-size: 13px; font-family: 'Open Sans', system-ui, -apple-system, sans-serif; border-radius: 999px; text-decoration: none; box-shadow: 0 4px 20px rgba(0, 242, 254, 0.45); letter-spacing: 0.04em; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;">
    <span>OPEN 3D GLOBE</span>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
  </a>
</div>
<style>
#ariel-globe-launcher a:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 6px 25px rgba(0, 242, 254, 0.65);
}
/* Ensure Framer hero buttons look and act like clickable pointers */
[data-framer-name="Primary Button"], [data-framer-name="Default"], .framer-1usv42i, .framer-rpYpt {
  cursor: pointer !important;
}
</style>
'''

# Insert nav_script before </head>
if '</head>' in html:
    html = html.replace('</head>', nav_script + '\n</head>', 1)

# Insert floating_cta right after <body...>
import re
html = re.sub(r'(<body[^>]*>)', r'\1\n' + floating_cta, html, count=1)

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Successfully injected navigation script and launcher CTA into frontend/index.html")
