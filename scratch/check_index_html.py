with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Let's check occurrences of href="#" or href="" in index.html
import re
print("Total occurrences of href=\"#\":", len(re.findall(r'href="#"', html)))
print("Total occurrences of href=\"\":", len(re.findall(r'href=""', html)))
print("Total occurrences of /app.html:", len(re.findall(r'/app\.html', html)))
