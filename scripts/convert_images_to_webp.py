from pathlib import Path
from urllib.parse import quote
import re
from PIL import Image

ROOT = Path.cwd()
SKIP_DIRS = {".git", "node_modules", ".netlify", ".vercel", "dist", "build"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
TEXT_EXTS = {".html", ".htm", ".css", ".js", ".mjs", ".ts", ".tsx", ".jsx", ".json", ".xml", ".md", ".yml", ".yaml", ".svg"}

images = [
    p for p in ROOT.rglob("*")
    if p.is_file()
    and p.suffix.lower() in IMAGE_EXTS
    and not any(part in SKIP_DIRS for part in p.parts)
]
converted = 0
saved_before = 0
saved_after = 0
replacements = 0
reference_map = {}

for path in images:
    output = path.with_suffix(".webp")
    try:
        with Image.open(path) as im:
            im.load()
            # Keep transparency; use a high-quality lossy WebP to reduce photo file sizes.
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGBA" if "transparency" in im.info else "RGB")
            before = path.stat().st_size
            im.save(output, "WEBP", quality=84, method=6)
            after = output.stat().st_size
        converted += 1
        saved_before += before
        saved_after += after

        rel_old = path.relative_to(ROOT).as_posix()
        rel_new = output.relative_to(ROOT).as_posix()
        variants_old = {
            rel_old,
            quote(rel_old, safe="/._-"),
            path.name,
            quote(path.name, safe="._-"),
        }
        for old in variants_old:
            # Only update references when the image filename is explicitly present.
            reference_map[old] = rel_new if old == rel_old or old == quote(rel_old, safe="/._-") else output.name
    except Exception as exc:
        print(f"SKIPPED {path}: {exc}")

for file in ROOT.rglob("*"):
    if not file.is_file() or file.suffix.lower() not in TEXT_EXTS:
        continue
    if any(part in SKIP_DIRS for part in file.parts):
        continue
    try:
        original = file.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue
    updated = original
    # Replace longer paths first so a basename cannot partially replace a path.
    for old, new in sorted(reference_map.items(), key=lambda pair: len(pair[0]), reverse=True):
        old_stem, old_ext = old.rsplit(".", 1)
        if old_ext.lower() not in {"jpg", "jpeg", "png"}:
            continue
        new_ref = old_stem + ".webp"
        updated = updated.replace(old, new_ref)
    if updated != original:
        file.write_text(updated, encoding="utf-8")
        replacements += 1
        print(f"UPDATED REFERENCES: {file.relative_to(ROOT)}")

print(f"Converted images: {converted}")
print(f"Files with updated references: {replacements}")
print(f"Original image bytes: {saved_before}")
print(f"WebP image bytes: {saved_after}")
if saved_before:
    print(f"Approximate size reduction: {100 * (saved_before - saved_after) / saved_before:.1f}%")
