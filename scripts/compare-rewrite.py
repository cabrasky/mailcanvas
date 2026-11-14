"""Compare the rewrite against published 1.0.3 and saved browser captures."""
from pathlib import Path
import gzip
import json
import shutil
import subprocess
import tarfile
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs/rewrite-comparison"
SOURCES = {
    "vertical": "13-altura-alineacion-vertical.png",
    "centering": "18-bloque-ahorro-centrado.png",
    "preview": "16-seleccion-desbordamiento.png",
}
OUTPUT.mkdir(parents=True, exist_ok=True)
preview_before = subprocess.run(
    ["git", "show", "77f2ce5:docs/screenshots/demo-review/16-seleccion-desbordamiento.png"],
    cwd=ROOT, capture_output=True, check=True,
).stdout
(OUTPUT / "before-preview.png").write_bytes(preview_before)
font_path = Path("C:/Windows/Fonts/arial.ttf")
font = ImageFont.truetype(str(font_path), 24) if font_path.exists() else ImageFont.load_default(size=24)
visual = {}
for case, source in SOURCES.items():
    shutil.copyfile(ROOT / "docs/screenshots/demo-review" / source, OUTPUT / f"after-{case}.png")
    before = Image.open(OUTPUT / f"before-{case}.png").convert("RGB")
    after = Image.open(OUTPUT / f"after-{case}.png").convert("RGB")
    if before.size != after.size:
        raise ValueError("Screenshot dimensions differ")
    difference = ImageChops.difference(before, after)
    mask = difference.convert("L").point(lambda pixel: 255 if pixel > 20 else 0)
    changed = sum(mask.histogram()[128:])
    visual[case] = {
        "resolution": list(before.size),
        "changed_pixels_threshold_20_percent": round(changed / (before.width * before.height) * 100, 3),
        "note": "Includes layout and text changes; not a quality score.",
    }
    board = Image.new("RGB", (before.width * 3, before.height + 52), "#f3f4f6")
    painter = ImageDraw.Draw(board)
    panels = [("1.0.3", before), ("Reescritura", after), ("Diferencia de píxeles (x4)", difference.point(lambda value: min(255, value * 4)))]
    for index, (title, frame) in enumerate(panels):
        board.paste(frame, (index * before.width, 52))
        painter.text((index * before.width + 18, 12), title, fill="#172033", font=font)
    board.save(OUTPUT / f"comparison-{case}.png")
with tarfile.open(ROOT / "artifacts/mailcanvas-1.0.3.tgz") as archive:
    baseline = {name: archive.extractfile("package/dist/" + name).read() for name in ["index.js", "style.css"]}
metrics = {}
for name, old in baseline.items():
    new = (ROOT / "dist" / name).read_bytes()
    metrics[name] = {
        "before_bytes": len(old), "after_bytes": len(new), "delta_bytes": len(new) - len(old),
        "before_gzip_bytes": len(gzip.compress(old, mtime=0)), "after_gzip_bytes": len(gzip.compress(new, mtime=0)),
    }
old_exports = subprocess.run(["git", "show", "77f2ce5:src/index.ts"], cwd=ROOT, capture_output=True, check=True).stdout.decode().replace("\r\n", "\n")
new_exports = (ROOT / "src/index.ts").read_text(encoding="utf-8").replace("\r\n", "\n")
report = {
    "baseline_commit": "77f2ce5", "branch": "codex/editor-rewrite", "public_exports_unchanged": old_exports == new_exports,
    "tests": {"before": 81, "after": 92}, "artifacts": metrics, "visual": visual,
    "validation": ["npm test", "npm run build", "npm run test:consumer-types", "node scripts/smoke-component.mjs", "node scripts/review-demo.mjs", "node scripts/review-demo.mjs --html-sizing-only"],
}
(OUTPUT / "metrics.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2, ensure_ascii=False))
