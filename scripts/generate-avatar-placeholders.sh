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

echo "Generating avatar placeholder sprites (walk cycles + blink overlays)..."

# Generate sprites for all combinations
# Using only variant 0 for minimal atlas (full 6 variants deferred to later)
for variant in 0; do
  # Parse variant colors
  colors=$(get_variant_colors $variant)
  body_color=$(echo $colors | cut -d: -f1)
  hair_color=$(echo $colors | cut -d: -f2)

  for direction in {0..7}; do
    # Generate IDLE frame (frame 0)
    for layer in body clothing head hair; do
      case $layer in
        body)
          convert -size 96x128 xc:transparent \
            -fill "$body_color" -draw "ellipse 48,80 30,40 0,360" \
            -pointsize 20 -fill white -gravity center \
            -annotate +0+10 "$direction" \
            "$TEMP_DIR/avatar_${variant}_${layer}_${direction}_idle_0.png"
          ;;
        clothing)
          convert -size 96x128 xc:transparent \
            -fill "$body_color" -colorize 80% \
            -draw "ellipse 48,80 25,30 0,360" \
            "$TEMP_DIR/avatar_${variant}_${layer}_${direction}_idle_0.png"
          ;;
        head)
          convert -size 96x128 xc:transparent \
            -fill "wheat" -draw "ellipse 48,50 20,25 0,360" \
            "$TEMP_DIR/avatar_${variant}_${layer}_${direction}_idle_0.png"
          ;;
        hair)
          convert -size 96x128 xc:transparent \
            -fill "$hair_color" -draw "rectangle 38,30 58,50" \
            "$TEMP_DIR/avatar_${variant}_${layer}_${direction}_idle_0.png"
          ;;
      esac
    done

    # Generate WALK cycle frames (0-3)
    for frame in {0..3}; do
      # Offset to simulate leg motion: -3, -1, 1, 3 pixels
      offset=$((frame * 2 - 3))

      for layer in body clothing head hair; do
        case $layer in
          body)
            convert -size 96x128 xc:transparent \
              -fill "$body_color" -draw "ellipse $((48 + offset)),80 30,40 0,360" \
              -pointsize 16 -fill white -annotate +35+70 "${direction}-W${frame}" \
              "$TEMP_DIR/avatar_${variant}_${layer}_${direction}_walk_${frame}.png"
            ;;
          clothing)
            convert -size 96x128 xc:transparent \
              -fill "$body_color" -colorize 80% \
              -draw "ellipse $((48 + offset)),80 25,30 0,360" \
              "$TEMP_DIR/avatar_${variant}_${layer}_${direction}_walk_${frame}.png"
            ;;
          head)
            convert -size 96x128 xc:transparent \
              -fill "wheat" -draw "ellipse $((48 + offset)),50 20,25 0,360" \
              "$TEMP_DIR/avatar_${variant}_${layer}_${direction}_walk_${frame}.png"
            ;;
          hair)
            convert -size 96x128 xc:transparent \
              -fill "$hair_color" -draw "rectangle $((38 + offset)),30 $((58 + offset)),50" \
              "$TEMP_DIR/avatar_${variant}_${layer}_${direction}_walk_${frame}.png"
            ;;
        esac
      done
    done
  done

  echo "✓ Generated variant $variant ($body_color body, $hair_color hair) - idle + walk cycles"
done

# Generate blink overlays (variant-independent)
echo "Generating blink overlays..."
for direction in {0..7}; do
  for frame in {1..3}; do
    # Frame 1: half-closed (thin line), Frame 2: closed (thick), Frame 3: half-open (thin)
    thickness=$((frame == 2 ? 8 : 4))

    convert -size 96x128 xc:transparent \
      -fill black -draw "rectangle 40,45 56,$((45 + thickness))" \
      "$TEMP_DIR/avatar_blink_${direction}_${frame}.png"
  done
done
echo "✓ Generated blink overlays (3 frames × 8 directions = 24 sprites)"

# Count total sprites
SPRITE_COUNT=$(ls $TEMP_DIR/*.png | wc -l | tr -d ' ')
echo "Total sprites generated: $SPRITE_COUNT (expected: 184)"
echo "  - Idle: 1 variant × 8 directions × 4 layers × 1 frame = 32"
echo "  - Walk: 1 variant × 8 directions × 4 layers × 4 frames = 128"
echo "  - Blink: 8 directions × 3 frames = 24"

# Create output directory
mkdir -p assets/spritesheets

# Pack sprites into atlas using montage
# 16 sprites wide × 12 sprites tall = 192 slots (sufficient for 184 sprites)
# Atlas size: 16×96 = 1536px wide, 12×128 = 1536px tall
montage $TEMP_DIR/*.png \
  -geometry 96x128+0+0 \
  -tile 16x12 \
  -background transparent \
  assets/spritesheets/avatar_atlas.png

echo "✓ Created avatar_atlas.png (1536×1536px, $SPRITE_COUNT sprites)"

# Generate JSON manifest in Texture Packer hash format
echo "Generating JSON manifest..."

cat > assets/spritesheets/avatar_atlas.json << 'JSON_START'
{
  "frames": {
JSON_START

# Generate frame entries
FIRST=true
INDEX=0

# Variant 0 idle frames
for direction in {0..7}; do
  for layer in body clothing head hair; do
    COL=$((INDEX % 16))
    ROW=$((INDEX / 16))
    X=$((COL * 96))
    Y=$((ROW * 128))

    if [ "$FIRST" = false ]; then
      echo "," >> assets/spritesheets/avatar_atlas.json
    fi
    FIRST=false

    cat >> assets/spritesheets/avatar_atlas.json << FRAME_ENTRY
    "avatar_0_${layer}_${direction}_idle_0": {
      "frame": { "x": $X, "y": $Y, "w": 96, "h": 128 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 96, "h": 128 },
      "sourceSize": { "w": 96, "h": 128 }
    }
FRAME_ENTRY
    INDEX=$((INDEX + 1))
  done
done

# Variant 0 walk frames
for direction in {0..7}; do
  for frame in {0..3}; do
    for layer in body clothing head hair; do
      COL=$((INDEX % 16))
      ROW=$((INDEX / 16))
      X=$((COL * 96))
      Y=$((ROW * 128))

      echo "," >> assets/spritesheets/avatar_atlas.json

      cat >> assets/spritesheets/avatar_atlas.json << FRAME_ENTRY
    "avatar_0_${layer}_${direction}_walk_${frame}": {
      "frame": { "x": $X, "y": $Y, "w": 96, "h": 128 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 96, "h": 128 },
      "sourceSize": { "w": 96, "h": 128 }
    }
FRAME_ENTRY
      INDEX=$((INDEX + 1))
    done
  done
done

# Blink overlays
for direction in {0..7}; do
  for frame in {1..3}; do
    COL=$((INDEX % 16))
    ROW=$((INDEX / 16))
    X=$((COL * 96))
    Y=$((ROW * 128))

    echo "," >> assets/spritesheets/avatar_atlas.json

    cat >> assets/spritesheets/avatar_atlas.json << FRAME_ENTRY
    "avatar_blink_${direction}_${frame}": {
      "frame": { "x": $X, "y": $Y, "w": 96, "h": 128 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 96, "h": 128 },
      "sourceSize": { "w": 96, "h": 128 }
    }
FRAME_ENTRY
    INDEX=$((INDEX + 1))
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

echo "✓ Created avatar_atlas.json with $INDEX frame entries"
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
