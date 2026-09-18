with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

idx = html.find('ariel-globe-launcher')
print("Index of launcher:", idx)
main_idx = html.find('<div id="main"')
print("Index of main:", main_idx)
main_end = html.find('<!-- Start of bodyEnd -->')
print("Index of main end:", main_end)
