import re

with open('frontend/public/framerusercontent.com/sites/32CUWj5rFnCAKP5t3zf90D/Rin3z6UA0YtSXlMyrfAuaxI_H_pvIgFVzhLG0NKg3oM.Df6ZYw15.mjs', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('DorMGuoX3')
while idx != -1:
    print(text[max(0, idx - 150): min(len(text), idx + 250)])
    print("=" * 60)
    idx = text.find('DorMGuoX3', idx + 1)
