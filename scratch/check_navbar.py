with open('frontend/public/framerusercontent.com/sites/32CUWj5rFnCAKP5t3zf90D/shared-lib.Br_ZWKhE.mjs', 'r', encoding='utf-8') as f:
    text = f.read()

import re
print("Navbar matches:")
for m in re.findall(r'.{0,50}(?:Navigation|Navbar|framer-17y6ksg|j7WCoe5oK).{0,50}', text):
    print(repr(m))
