with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
# Find the launcher block
launcher_match = re.search(r'<!-- Direct 3D Globe Launcher Banner & Button -->.*?<\/style>\s*', html, re.DOTALL)
if launcher_match:
    launcher_code = launcher_match.group(0)
    # Remove it from its current place
    html = html[:launcher_match.start()] + html[launcher_match.end():]
    
    # Insert it right at <!-- Start of bodyEnd -->
    body_end_tag = '<!-- Start of bodyEnd -->'
    if body_end_tag in html:
        html = html.replace(body_end_tag, body_end_tag + '\n' + launcher_code)
    else:
        html = html.replace('</body>', launcher_code + '\n</body>')

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Successfully moved launcher button to bodyEnd outside React hydration root!")
