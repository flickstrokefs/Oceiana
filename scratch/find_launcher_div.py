with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
matches = [m.start() for m in re.finditer(r'<div id="ariel-globe-launcher"', html)]
print("Matches for <div id=\"ariel-globe-launcher\":", matches)
for pos in matches:
    print(html[pos - 50: pos + 200])
