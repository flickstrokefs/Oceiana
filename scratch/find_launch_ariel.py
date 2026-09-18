with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
for m in re.finditer(r'.{0,100}Launch ARIEL.{0,100}', html, re.IGNORECASE):
    print("-->", repr(m.group(0)))
