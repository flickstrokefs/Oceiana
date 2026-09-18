import re

# 1. Patch Rin3z6UA0YtSXlMyrfAuaxI_H_pvIgFVzhLG0NKg3oM.Df6ZYw15.mjs
rin_path = 'frontend/public/framerusercontent.com/sites/32CUWj5rFnCAKP5t3zf90D/Rin3z6UA0YtSXlMyrfAuaxI_H_pvIgFVzhLG0NKg3oM.Df6ZYw15.mjs'
with open(rin_path, 'r', encoding='utf-8') as f:
    rin_text = f.read()

# Replace DorMGuoX3:`` with DorMGuoX3:`/app.html`
rin_text_new = rin_text.replace('DorMGuoX3:``', 'DorMGuoX3:`/app.html`')
rin_text_new = rin_text_new.replace('DorMGuoX3:""', 'DorMGuoX3:"/app.html"')

# Replace HWDRxZYpn:`#` with HWDRxZYpn:`/app.html`
rin_text_new = rin_text_new.replace('HWDRxZYpn:`#`', 'HWDRxZYpn:`/app.html`')
rin_text_new = rin_text_new.replace('HWDRxZYpn:"#"', 'HWDRxZYpn:"/app.html"')

if rin_text_new != rin_text:
    with open(rin_path, 'w', encoding='utf-8') as f:
        f.write(rin_text_new)
    print("Successfully patched Rin3z6UA0YtSXlMyrfAuaxI_H_pvIgFVzhLG0NKg3oM.Df6ZYw15.mjs")
else:
    print("Warning: No changes made to Rin3z6UA0YtSXlMyrfAuaxI_H_pvIgFVzhLG0NKg3oM.Df6ZYw15.mjs")

# 2. Patch shared-lib.Br_ZWKhE.mjs
shared_path = 'frontend/public/framerusercontent.com/sites/32CUWj5rFnCAKP5t3zf90D/shared-lib.Br_ZWKhE.mjs'
with open(shared_path, 'r', encoding='utf-8') as f:
    shared_text = f.read()

# In Pu(e) function: DorMGuoX3:n??a.DorMGuoX3??`/app.html`
shared_text_new = shared_text.replace('DorMGuoX3:n??a.DorMGuoX3', 'DorMGuoX3:(n&&n!=="#"?n:(a.DorMGuoX3&&a.DorMGuoX3!=="#"?a.DorMGuoX3:"/app.html"))')
if shared_text_new != shared_text:
    with open(shared_path, 'w', encoding='utf-8') as f:
        f.write(shared_text_new)
    print("Successfully patched shared-lib.Br_ZWKhE.mjs")
else:
    print("Warning: No changes made to shared-lib.Br_ZWKhE.mjs")
