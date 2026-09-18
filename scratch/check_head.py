with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

head_idx = html.find('</head>')
print(html[max(0, head_idx - 1500): head_idx + 10])
