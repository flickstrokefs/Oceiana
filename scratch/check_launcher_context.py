with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

idx = html.find('ariel-globe-launcher')
print(html[max(0, idx - 200): min(len(html), idx + 400)])
