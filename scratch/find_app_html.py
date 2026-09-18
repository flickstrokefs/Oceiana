with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
for m in re.finditer(r'.{0,60}/app\.html.{0,60}', html):
    print("-->", repr(m.group(0)))
