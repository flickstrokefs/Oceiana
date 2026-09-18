with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

idx = html.find('Launch ARIEL')
print(html[max(0, idx - 800): idx])
