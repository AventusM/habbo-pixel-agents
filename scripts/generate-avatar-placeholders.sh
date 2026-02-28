#!/bin/bash
# Generate placeholder avatar sprites for 8 directions × 6 variants × 4 layers
# Output: assets/spritesheets/avatar_atlas.png and avatar_atlas.json
#
# Sprite requirements:
# - Size: 96×128px per sprite (taller than furniture for human figure)
# - 6 variants with distinct color schemes
# - 8 directions (0-7) with visual indicators
# - 4 layers per variant: body, clothing, head, hair
# - Only idle state, frame 0 (walk cycles deferred to Plan 02)

set -e

# Function to get variant colors
get_variant_colors() {
  case $1 in
    0) echo "red:blue" ;;
    1) echo "cyan:orange" ;;
    2) echo "green:yellow" ;;
    3) echo "magenta:white" ;;
    4) echo "orange:cyan" ;;
    5) echo "blue:green" ;;
  esac
}

# Function to get layer index
get_layer_index() {
  case $1 in
    body) echo 0 ;;
    clothing) echo 1 ;;
    head) echo 2 ;;
    hair) echo 3 ;;
  esac
}

# Create temp directory for individual sprites
TEMP_DIR="$(mktemp -d)"
trap "rm -rf $TEMP_DIR" EXIT

echo "Generating avatar placeholder sprites..."

# Generate sprites for all combinations
for variant in {0..5}; do
  # Parse variant colors
  colors=$(get_variant_colors $variant)
  body_color=$(echo $colors | cut -d: -f1)
  hair_color=$(echo $colors | cut -d: -f2)

  for direction in {0..7}; do
    # Calculate position offset for directional indicator
    # (small arrow or number showing direction)

    # Generate body layer (solid oval representing torso)
    convert -size 96x128 xc:transparent \
      -fill "$body_color" -draw "ellipse 48,80 30,40 0,360" \
      -pointsize 20 -fill white -gravity center \
      -annotate +0+10 "$direction" \
      "$TEMP_DIR/avatar_${variant}_body_${direction}_idle_0.png"

    # Generate clothing layer (darker shade of body color for shirt)
    # Use 20% darker version via modulate
    convert -size 96x128 xc:transparent \
      -fill "$body_color" -colorize 80% \
      -draw "ellipse 48,80 25,30 0,360" \
      "$TEMP_DIR/avatar_${variant}_clothing_${direction}_idle_0.png"

    # Generate head layer (lighter circle on top for face)
    convert -size 96x128 xc:transparent \
      -fill "wheat" -draw "ellipse 48,50 20,25 0,360" \
      "$TEMP_DIR/avatar_${variant}_head_${direction}_idle_0.png"

    # Generate hair layer (distinct color rectangle on top for hairstyle)
    convert -size 96x128 xc:transparent \
      -fill "$hair_color" -draw "rectangle 38,30 58,50" \
      "$TEMP_DIR/avatar_${variant}_hair_${direction}_idle_0.png"
  done

  echo "✓ Generated variant $variant ($body_color body, $hair_color hair)"
done

# Count total sprites
SPRITE_COUNT=$(ls $TEMP_DIR/*.png | wc -l | tr -d ' ')
echo "Total sprites generated: $SPRITE_COUNT (expected: 192)"

# Create output directory
mkdir -p assets/spritesheets

# Pack sprites into atlas using montage
# 16 sprites wide × 12 sprites tall = 192 sprites (1536×1536px atlas)
montage $TEMP_DIR/*.png \
  -geometry 96x128+0+0 \
  -tile 16x12 \
  -background transparent \
  assets/spritesheets/avatar_atlas.png

echo "✓ Created avatar_atlas.png (1536×1536px)"

# Generate JSON manifest in Texture Packer hash format
echo "Generating JSON manifest..."

cat > assets/spritesheets/avatar_atlas.json << 'JSON_START'
{
  "frames": {
JSON_START

# Generate frame entries
FIRST=true
for variant in {0..5}; do
  for direction in {0..7}; do
    for layer in body clothing head hair; do
      # Calculate atlas position (column, row)
      # Order: variant 0-5, direction 0-7, layer body/clothing/head/hair
      LAYER_IDX=$(get_layer_index $layer)
      INDEX=$((variant * 32 + direction * 4 + LAYER_IDX))
      COL=$((INDEX % 16))
      ROW=$((INDEX / 16))
      X=$((COL * 96))
      Y=$((ROW * 128))

      # Add comma separator (except for first entry)
      if [ "$FIRST" = false ]; then
        echo "," >> assets/spritesheets/avatar_atlas.json
      fi
      FIRST=false

      # Add frame entry
      cat >> assets/spritesheets/avatar_atlas.json << FRAME_ENTRY
    "avatar_${variant}_${layer}_${direction}_idle_0": {
      "frame": { "x": $X, "y": $Y, "w": 96, "h": 128 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 96, "h": 128 },
      "sourceSize": { "w": 96, "h": 128 }
    }
FRAME_ENTRY
    done
  done
done

# Close JSON structure
cat >> assets/spritesheets/avatar_atlas.json << 'JSON_END'
  },
  "meta": {
    "image": "avatar_atlas.png",
    "format": "RGBA8888",
    "size": { "w": 1536, "h": 1536 },
    "scale": "1"
  }
}
JSON_END

echo "✓ Created avatar_atlas.json with $SPRITE_COUNT frame entries"
echo "✓ Avatar placeholder generation complete!"

# Validate output
if [ ! -f assets/spritesheets/avatar_atlas.png ]; then
  echo "❌ Error: avatar_atlas.png not created"
  exit 1
fi

if [ ! -f assets/spritesheets/avatar_atlas.json ]; then
  echo "❌ Error: avatar_atlas.json not created"
  exit 1
fi

echo ""
echo "Output files:"
ls -lh assets/spritesheets/avatar_atlas.*
