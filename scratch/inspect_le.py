with open('frontend/public/framerusercontent.com/sites/32CUWj5rFnCAKP5t3zf90D/shared-lib.Br_ZWKhE.mjs', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('displayName=`Navigation')
if idx == -1:
    idx = text.find('le=')
print(text[max(0, idx - 100): min(len(text), idx + 400)])
