with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

print('Has iframe:', '<iframe' in html)
print('Has prefetch:', 'rel="prefetch"' in html)
print('Has OPEN 3D GLOBE:', 'OPEN 3D GLOBE' in html)
print('Has ariel-globe-launcher:', 'ariel-globe-launcher' in html)
print('Has warmBackendCache:', 'warmBackendCache' in html)
print('Total length:', len(html))
