from pathlib import Path

css_path = Path(r"c:\Saumya_workspace\team ariel\Oceiana\frontend\src\index.css")
content = css_path.read_text(encoding="utf-8")

target = """.scale-bar-gradient.hazard-gradient {
  width: 10px;
  height: 110px;
  background: linear-gradient(to bottom, #ef4444, #f97316, #eab308, #10b981, #06b6d4);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}"""

replacement = """.scale-bar-gradient.hazard-gradient {
  width: 10px;
  height: 110px;
  background: linear-gradient(to bottom, #ef4444, #f97316, #eab308, #10b981, #06b6d4);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.scale-bar-gradient.cyclone-gradient {
  width: 10px;
  height: 110px;
  background: linear-gradient(to bottom, #ec4899, #ef4444, #f97316, #f59e0b, #38bdf8, #06b6d4);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.cyclone-eye-icon {
  background: transparent !important;
  border: none !important;
}

@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}"""

if target in content:
    content = content.replace(target, replacement, 1)
    css_path.write_text(content, encoding="utf-8")
    print("Added cyclone styles to index.css")
else:
    print("Target not found in index.css")
