with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

head_idx = html.find('</head>')
style_end = html.rfind('</style>', 0, head_idx) + len('</style>')

clean_head_block = '''
<!-- Pre-connections and prefetching for rapid 3D Globe launch -->
<link rel="preconnect" href="https://services.arcgisonline.com" crossorigin />
<link rel="dns-prefetch" href="https://services.arcgisonline.com" />
<link rel="prefetch" href="/app.html" as="document" />

<script>
// Lightweight, silky smooth navigation and background pre-warming
(function() {
  function navigateToGlobe(e) {
    var target = e.target;
    if (!target) return;
    var el = target.closest('a, button, [role="button"], [data-framer-name="Primary Button"], [data-framer-name="Default"]');
    var text = (target.innerText || target.textContent || '').trim().toUpperCase();
    var elText = el ? (el.innerText || el.textContent || '').trim().toUpperCase() : '';

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
      setTimeout(warmBackendCache, 2000);
    });
  } else {
    setTimeout(warmBackendCache, 2500);
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

html = html[:style_end] + '\n' + clean_head_block + '\n' + html[head_idx:]

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Successfully cleaned up head section of index.html")
