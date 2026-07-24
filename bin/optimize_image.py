#!/usr/bin/env python3
from pathlib import Path
import os
import sys

from PIL import Image


MAX_DIMENSION = 1800
QUALITY = 88
SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def fail(message: str) -> None:
    print(f"Error: {message}", file=sys.stderr)
    raise SystemExit(1)


def human_size(size: int) -> str:
    units = ("B", "KB", "MB", "GB")
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def convert(source: Path, destination: Path) -> dict:
    temporary = destination.with_name(f".{destination.name}.tmp")
    before_size = source.stat().st_size

    try:
        with Image.open(source) as image:
            image.load()
            original_dimensions = image.size

            if image.mode not in ("RGB", "RGBA"):
                has_transparency = "transparency" in image.info
                image = image.convert("RGBA" if has_transparency else "RGB")

            image.thumbnail(
                (MAX_DIMENSION, MAX_DIMENSION),
                Image.Resampling.LANCZOS,
            )
            output_dimensions = image.size
            image.save(
                temporary,
                "WEBP",
                quality=QUALITY,
                method=6,
            )

        with Image.open(temporary) as verification:
            verification.verify()

        os.replace(temporary, destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise

    return {
        "source": source,
        "destination": destination,
        "before_size": before_size,
        "after_size": destination.stat().st_size,
        "original_dimensions": original_dimensions,
        "output_dimensions": output_dimensions,
    }


project_root = Path(__file__).resolve().parent.parent

if len(sys.argv) != 2:
    fail(
        "usage: bin/optimize-image images/your-post/image.png\n"
        "   or: bin/optimize-image images/your-post"
    )

target = Path(sys.argv[1]).expanduser()
if not target.is_absolute():
    target = project_root / target
target = target.resolve()

try:
    relative_target = target.relative_to(project_root)
except ValueError:
    fail("the image or folder must be inside this website project")

if not relative_target.parts or relative_target.parts[0] != "images":
    fail("the image or folder must be inside the website's images folder")

if target.is_file():
    if target.suffix.lower() not in SUPPORTED_EXTENSIONS:
        fail("the source must be a PNG, JPG, or JPEG image")
    sources = [target]
elif target.is_dir():
    sources = sorted(
        path
        for path in target.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )
    if not sources:
        fail("the folder contains no PNG, JPG, or JPEG images to convert")
else:
    fail(f"file or folder not found: {relative_target}")

planned_conversions = []
reserved_destinations = set()
for source in sources:
    destination = source.with_suffix(".webp")
    counter = 1
    while destination.exists() or destination in reserved_destinations:
        destination = source.with_name(f"{source.stem}-{counter}.webp")
        counter += 1
    reserved_destinations.add(destination)
    planned_conversions.append((source, destination))

converted = []
try:
    for source, destination in planned_conversions:
        converted.append(convert(source, destination))
except Exception:
    for result in converted:
        result["destination"].unlink(missing_ok=True)
    raise

replacements = {
    "/" + result["source"].relative_to(project_root).as_posix():
    "/" + result["destination"].relative_to(project_root).as_posix()
    for result in converted
}

search_roots = [
    project_root / "_posts",
    project_root / "pages",
    project_root / "tag",
]
standalone_files = [
    project_root / "index.md",
    project_root / "index.html",
]

content_files = []
for search_root in search_roots:
    if search_root.exists():
        content_files.extend(search_root.rglob("*.md"))
        content_files.extend(search_root.rglob("*.html"))
content_files.extend(path for path in standalone_files if path.exists())

updated_files = []
for content_file in content_files:
    original = content_file.read_text(encoding="utf-8")
    updated = original
    for old_reference, new_reference in replacements.items():
        updated = updated.replace(old_reference, new_reference)
    if updated != original:
        content_file.write_text(updated, encoding="utf-8")
        updated_files.append(content_file.relative_to(project_root))

for result in converted:
    result["source"].unlink()

before_total = sum(result["before_size"] for result in converted)
after_total = sum(result["after_size"] for result in converted)
saving = 100 * (1 - after_total / before_total)

for result in converted:
    source_relative = result["source"].relative_to(project_root)
    destination_relative = result["destination"].relative_to(project_root)
    old_width, old_height = result["original_dimensions"]
    new_width, new_height = result["output_dimensions"]
    print(
        f"Created {destination_relative} "
        f"({old_width}×{old_height} → {new_width}×{new_height})"
    )

print()
print(f"Converted {len(converted)} image(s).")
print(
    f"Total size: {human_size(before_total)} → {human_size(after_total)} "
    f"({saving:.0f}% smaller)"
)
print(f"Updated {len(updated_files)} content file(s).")
print("Removed the originals after verifying every WebP.")
