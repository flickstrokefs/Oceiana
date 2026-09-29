import json

with open(r'frontend/src/ocean/data/ihoFootprints.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

lines = [
    "// Authoritative IHO Sea Areas v3 Footprints",
    "export const IHO_FOOTPRINTS: Record<string, [number, number][]> = {"
]

for k, pts in d.items():
    lines.append(f"  '{k}': {json.dumps(pts)},")

lines.append("};\n")

with open(r'frontend/src/ocean/data/ihoFootprints.ts', 'w', encoding='utf-8') as f:
    f.write("\n".join(lines))

print("Successfully written frontend/src/ocean/data/ihoFootprints.ts")
