with open('frontend/public/framerusercontent.com/sites/32CUWj5rFnCAKP5t3zf90D/shared-lib.Br_ZWKhE.mjs', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'.{0,50}(?:DorMGuoX3|PBIju9Se6|HWDRxZYpn|odGHDuEU0).{0,50}', text)
for m in matches:
    print('-->', repr(m))
