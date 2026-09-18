with open('frontend/public/framerusercontent.com/sites/32CUWj5rFnCAKP5t3zf90D/shared-lib.Br_ZWKhE.mjs', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('defaultVariant:`k7Wd6OC2F`')
print(text[idx: idx + 2000])
