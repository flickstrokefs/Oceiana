with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace the previous nav_script in <head> with the new pre-warmed globe controller
old_script_start = html.find('<script>\n// Capture-phase click interceptor')
old_script_end = html.find('</script>\n</head>') + len('</script>\n')

if old_script_start != -1 and old_script_end != -1:
    html = html[:old_script_start] + html[old_script_end:]

new_head_code = '''
<script>
// Background Pre-warmed 3D Globe Controller & Instant Transition
(function() {
  function openGlobe() {
    var container = document.getElementById('ariel-globe-container');
    if (container) {
      container.style.opacity = '1';
      container.style.pointerEvents = 'auto';
      document.body.style.overflow = 'hidden';
      if (window.location.pathname !== '/app' && window.location.pathname !== '/app.html') {
        try {
          history.pushState({ globe: true }, '', '/app');
        } catch (e) {}
      }
      var iframe = document.getElementById('ariel-globe-iframe');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.dispatchEvent(new Event('resize'));
          iframe.focus();
        } catch (e) {}
      }
    }
  }

  function closeGlobe(updateHistory) {
    var container = document.getElementById('ariel-globe-container');
    if (container) {
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      document.body.style.overflow = '';
      if (updateHistory && (window.location.pathname === '/app' || window.location.pathname === '/app.html')) {
        try {
          history.pushState(null, '', '/');
        } catch (e) {}
      }
    }
  }

  window.openArielGlobe = openGlobe;
  window.closeArielGlobe = closeGlobe;

  // Intercept any click on Launch / Explore CTAs to open the pre-rendered globe instantly
  function handleGlobeClick(e) {
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
      openGlobe();
      return false;
    }
  }

  window.addEventListener('click', handleGlobeClick, true);
  document.addEventListener('click', handleGlobeClick, true);

  // Handle browser back / forward buttons
  window.addEventListener('popstate', function() {
    var isGlobePath = window.location.pathname === '/app' || window.location.pathname === '/app.html';
    if (isGlobePath) {
      openGlobe();
    } else {
      closeGlobe(false);
    }
  });

  // Handle return message from iframe header logo
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'ARIEL_CLOSE_GLOBE') {
      closeGlobe(true);
    }
  });

  // Check URL on initial load
  if (window.location.pathname === '/app' || window.location.pathname === '/app.html' || window.location.hash === '#app') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', openGlobe);
    } else {
      openGlobe();
    }
  }
})();
</script>
'''

html = html.replace('</head>', new_head_code + '\n</head>', 1)

# Remove old floating_cta if present
old_cta_idx = html.find('<!-- Direct 3D Globe Launcher Banner & Button -->')
if old_cta_idx != -1:
    end_style_idx = html.find('</style>', old_cta_idx) + len('</style>\n')
    html = html[:old_cta_idx] + html[end_style_idx:]

# Add the pre-warmed globe container and the launcher button right after <body>
globe_elements = '''
<!-- Background Pre-warmed 3D Globe Container (starts rendering immediately upon landing page load) -->
<div id="ariel-globe-container" style="position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 10000000; opacity: 0; pointer-events: none; transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1); background: #0b0f19;">
  <iframe id="ariel-globe-iframe" src="/app.html" title="ARIEL 3D Globe" style="width: 100%; height: 100%; border: none; display: block;" loading="eager" allow="accelerometer; gyroscope; web-share"></iframe>
</div>

<!-- Direct 3D Globe Launcher Banner & Button -->
<div id="ariel-globe-launcher" style="position: fixed; top: 16px; right: 24px; z-index: 9999999; display: flex; gap: 12px; align-items: center;">
  <a href="/app.html" onclick="if(window.openArielGlobe){event.preventDefault();window.openArielGlobe();}" style="display: inline-flex; align-items: center; gap: 8px; padding: 11px 22px; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); color: #000; font-weight: 800; font-size: 13px; font-family: 'Open Sans', system-ui, -apple-system, sans-serif; border-radius: 999px; text-decoration: none; box-shadow: 0 4px 20px rgba(0, 242, 254, 0.45); letter-spacing: 0.04em; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;">
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

import re
html = re.sub(r'(<body[^>]*>)', r'\1\n' + globe_elements, html, count=1)

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Successfully injected background pre-warmed 3D Globe and instant transition controller!")
