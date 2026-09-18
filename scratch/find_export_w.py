with open('frontend/public/framerusercontent.com/sites/32CUWj5rFnCAKP5t3zf90D/shared-lib.Br_ZWKhE.mjs', 'r', encoding='utf-8') as f:
    text = f.read()

import re
m = re.search(r'export\s*\{[^}]*?\b(\w+)\s+as\s+W\b[^}]*?\}', text)
if m:
    print("Found export W:", m.group(0))
else:
    print("Not found as export")
    # search at end of file
    print(text[-1500:])
