#!/bin/bash
# scripts/convert-audio-to-ogg.sh
# Copies source audio files to dist for VS Code webview playback.
# WAV files are copied directly (universally supported by Web Audio API).
# Non-WAV files are converted to OGG if ffmpeg is available.

INPUT_DIR="assets/sounds-source"
OUTPUT_DIR="dist/webview-assets/sounds"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if input directory exists
if [ ! -d "$INPUT_DIR" ]; then
  echo "⚠ No $INPUT_DIR directory - skipping audio processing"
  exit 0
fi

copied_count=0
converted_count=0

# Copy WAV files directly (Web Audio API decodes them natively)
for file in "$INPUT_DIR"/*.{wav,WAV}; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    cp "$file" "$OUTPUT_DIR/$filename"
    echo "  ✓ Copied $filename"
    copied_count=$((copied_count + 1))
  fi
done

# Convert non-WAV files to OGG if ffmpeg is available
if command -v ffmpeg &> /dev/null; then
  # Detect available OGG encoder
  OGG_CODEC="libvorbis"
  OGG_OPTS="-q:a 4"
  if ! ffmpeg -encoders 2>/dev/null | grep -q libvorbis; then
    if ffmpeg -encoders 2>/dev/null | grep -q libopus; then
      OGG_CODEC="libopus"
      OGG_OPTS="-b:a 64k"
    else
      OGG_CODEC=""
    fi
  fi

  if [ -n "$OGG_CODEC" ]; then
    for file in "$INPUT_DIR"/*.{mp3,m4a,MP3,M4A}; do
      if [ -f "$file" ]; then
        filename=$(basename "$file")
        name="${filename%.*}"
        echo "Converting $filename to OGG ($OGG_CODEC)..."
        ffmpeg -i "$file" -c:a "$OGG_CODEC" $OGG_OPTS "$OUTPUT_DIR/${name}.ogg" -y -loglevel warning
        if [ $? -eq 0 ]; then
          echo "  ✓ Created ${name}.ogg"
          converted_count=$((converted_count + 1))
        else
          echo "  ✗ Failed to convert $filename"
        fi
      fi
    done
  fi
fi

total=$((copied_count + converted_count))
if [ $total -eq 0 ]; then
  echo "⚠ No audio files found in $INPUT_DIR"
else
  echo "✓ Audio processing complete: $copied_count copied, $converted_count converted"
fi
