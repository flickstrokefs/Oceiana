import re

with open('frontend/public/framerusercontent.com/sites/32CUWj5rFnCAKP5t3zf90D/Rin3z6UA0YtSXlMyrfAuaxI_H_pvIgFVzhLG0NKg3oM.Df6ZYw15.mjs', 'r', encoding='utf-8') as f:
    text = f.read()

print("Display names:", re.findall(r'displayName\s*=\s*[`\'"][^`\'"]+[`\'"]', text))

# Find buttons and links
for match in re.finditer(r'(?:HWDRxZYpn|DorMGuoX3|PBIju9Se6|odGHDuEU0|href)\s*:\s*(?:`[^`]*`|"[^"]*")', text):
    print(match.group(0))
