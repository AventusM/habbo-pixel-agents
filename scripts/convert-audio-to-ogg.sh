#!/bin/bash
# scripts/convert-audio-to-ogg.sh
# Converts source audio files to OGG Vorbis for VS Code webview compatibility

INPUT_DIR="assets/sounds-source"
OUTPUT_DIR="dist/webview-assets/sounds"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
  echo "⚠ ffmpeg not found - skipping audio conversion"
  echo "  Install with: brew install ffmpeg (macOS) or sudo apt install ffmpeg (Linux)"
  exit 0
fi

# Check if input directory exists
if [ ! -d "$INPUT_DIR" ]; then
  echo "⚠ No $INPUT_DIR directory - skipping audio conversion"
  echo "  Create directory and add .mp3, .wav, or .m4a source files"
  echo "  See scripts/obtain-habbo-sounds.md for instructions"
  exit 0
fi

# Convert all supported audio formats to OGG Vorbis
converted_count=0
for file in "$INPUT_DIR"/*.{mp3,wav,m4a,MP3,WAV,M4A}; do
  # Check if glob matched actual files
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    name="${filename%.*}"

    echo "Converting $filename to OGG Vorbis..."
    ffmpeg -i "$file" -c:a libvorbis -q:a 4 "$OUTPUT_DIR/${name}.ogg" -y -loglevel warning

    if [ $? -eq 0 ]; then
      echo "  ✓ Created ${name}.ogg"
      converted_count=$((converted_count + 1))
    else
      echo "  ✗ Failed to convert $filename"
    fi
  fi
done

if [ $converted_count -eq 0 ]; then
  echo "⚠ No audio files found in $INPUT_DIR"
  echo "  Add .mp3, .wav, or .m4a files to generate OGG Vorbis files"
  echo "  See scripts/obtain-habbo-sounds.md for sources"
else
  echo "✓ Audio conversion complete: $converted_count file(s) converted"
fi
