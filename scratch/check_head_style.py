with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

head_idx = html.find('</head>')
style_end = html.rfind('</style>', 0, head_idx)
print(html[style_end: head_idx + 10])
