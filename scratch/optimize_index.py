with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Remove the heavy iframe container
import re
html = re.sub(
    r'<!-- Background Pre-warmed 3D Globe Container.*?</div>\s*',
    '',
    html,
    flags=re.DOTALL
)

# 2. Update the script in <head> to be lightweight, silky smooth, with idle prefetch
old_script_start = html.find('<script>\n// Background Pre-warmed 3D Globe Controller')
old_script_end = html.find('</script>\n</head>') + len('</script>\n')

if old_script_start != -1 and old_script_end != -1:
    html = html[:old_script_start] + html[old_script_end:]

optimized_head_code = '''
<!-- Pre-connections and prefetching for rapid 3D Globe launch -->
<link rel="preconnect" href="https://services.arcgisonline.com" crossorigin />
<link rel="dns-prefetch" href="https://services.arcgisonline.com" />
<link rel="prefetch" href="/app.html" as="document" />

<script>
(function() {
  function navigateToGlobe(e) {
    var target = e.target;
    if (!target) return;
    var el = target.closest('a, button, [role="button"], [data-framer-name="Primary Button"], [data-framer-name="Default"]');
    var text = (target.innerText || target.textContent || '').trim().toUpperCase();
    var elText = el ? (el.innerText || el.textContent || '') : '';

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

  // Intercept click on capture phase so nothing blocks navigation
  window.addEventListener('click', navigateToGlobe, true);
  document.addEventListener('click', navigateToGlobe, true);

  // Idle background pre-warming of backend observation APIs (zero impact on landing page FPS)
  function warmBackendCache() {
    try {
      fetch('/api/gliders').catch(function(){});
      fetch('/api/argo/summary').catch(function(){});
    } catch(e) {}
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(function() {
      setTimeout(warmBackendCache, 2500);
    });
  } else {
    setTimeout(warmBackendCache, 3000);
  }

  // Pre-warm on mouse hover over any CTA
  document.addEventListener('mouseover', function(e) {
    var target = e.target;
    if (!target) return;
    var el = target.closest('a, button, [role="button"], [data-framer-name="Primary Button"], [data-framer-name="Default"]');
    var text = (target.innerText || target.textContent || '').trim().toUpperCase();
    if (text.includes('EXPLORE ARIEL') || text.includes('LAUNCH ARIEL') || target.closest('#ariel-globe-launcher')) {
      warmBackendCache();
    }
  }, { once: true, passive: true });
})();
</script>
'''

html = html.replace('</head>', optimized_head_code + '\n</head>', 1)

# Ensure launcher button exists in body without onclick inline errors
if '<div id="ariel-globe-launcher"' not in html:
    launcher_html = '''
<!-- Direct 3D Globe Launcher Button -->
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
[data-framer-name="Primary Button"], [data-framer-name="Default"], .framer-1usv42i, .framer-rpYpt {
  cursor: pointer !important;
}
</style>
'''
    html = re.sub(r'(<body[^>]*>)', r'\1\n' + launcher_html, html, count=1)
else:
    # Update existing launcher to clean standard href="/app.html"
    html = re.sub(
        r'<a href="/app\.html"[^>]*onclick="[^"]*"',
        r'<a href="/app.html"',
        html
    )

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Successfully cleaned up index.html: removed heavy iframe, enabled silky smooth landing page and fast idle prefetching!")
