with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
idx = html.find('ariel-globe-launcher')
print("Launcher area:")
print(html[max(0, idx - 100): min(len(html), idx + 600)])

idx2 = html.find('navigateToGlobe')
print("\nScript area:")
print(html[max(0, idx2 - 100): min(len(html), idx2 + 600)])
