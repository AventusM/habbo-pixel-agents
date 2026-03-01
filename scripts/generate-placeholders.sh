#!/bin/bash
# Generate colored 64x64 placeholder sprites for furniture testing

OUTPUT_DIR="assets/spritesheets"
mkdir -p "$OUTPUT_DIR"

# Create a 512x512 atlas with 8 LARGE 128x128 sprites (4x2 grid)
convert -size 512x512 xc:transparent \
  \( -size 128x128 xc:'#FF0000' -gravity center -pointsize 24 -font Helvetica-Bold -fill white -strokewidth 2 -stroke black -annotate +0-16 'CHAIR' -fill white -pointsize 40 -annotate +0+20 '1' \) -geometry +0+0 -composite \
  \( -size 128x128 xc:'#00FFFF' -gravity center -pointsize 24 -font Helvetica-Bold -fill black -annotate +0-16 'DESK' -pointsize 40 -annotate +0+20 '2' \) -geometry +128+0 -composite \
  \( -size 128x128 xc:'#0000FF' -gravity center -pointsize 24 -font Helvetica-Bold -fill white -strokewidth 2 -stroke black -annotate +0-16 'PC' -fill white -pointsize 40 -annotate +0+20 '3' \) -geometry +256+0 -composite \
  \( -size 128x128 xc:'#FFA500' -gravity center -pointsize 24 -font Helvetica-Bold -fill black -annotate +0-16 'LAMP' -pointsize 40 -annotate +0+20 '4' \) -geometry +384+0 -composite \
  \( -size 128x128 xc:'#00FF00' -gravity center -pointsize 24 -font Helvetica-Bold -fill black -annotate +0-16 'PLANT' -pointsize 40 -annotate +0+20 '5' \) -geometry +0+128 -composite \
  \( -size 128x128 xc:'#FF00FF' -gravity center -pointsize 24 -font Helvetica-Bold -fill white -strokewidth 2 -stroke black -annotate +0-16 'SHELF' -fill white -pointsize 40 -annotate +0+20 '6' \) -geometry +128+128 -composite \
  \( -size 128x128 xc:'#FFFF00' -gravity center -pointsize 24 -font Helvetica-Bold -fill black -annotate +0-16 'RUG' -pointsize 40 -annotate +0+20 '7' \) -geometry +256+128 -composite \
  \( -size 128x128 xc:'#FFFFFF' -gravity center -pointsize 24 -font Helvetica-Bold -fill black -annotate +0-16 'BOARD' -pointsize 40 -annotate +0+20 '8' \) -geometry +384+128 -composite \
  "$OUTPUT_DIR/furniture_atlas.png"

echo "✓ Generated furniture_atlas.png (512x512px with 8 large 128x128 sprites)"

# Create matching JSON manifest with 128x128 frames
cat > "$OUTPUT_DIR/furniture_atlas.json" << 'EOF'
{
  "frames": {
    "chair_64_a_0_0": {
      "frame": { "x": 0, "y": 0, "w": 128, "h": 128 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "chair_64_a_2_0": {
      "frame": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "desk_64_a_0_0": {
      "frame": { "x": 64, "y": 0, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "desk_64_a_2_0": {
      "frame": { "x": 64, "y": 0, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "computer_64_a_0_0": {
      "frame": { "x": 128, "y": 0, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "computer_64_a_2_0": {
      "frame": { "x": 128, "y": 0, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "lamp_64_a_0_0": {
      "frame": { "x": 192, "y": 0, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "lamp_64_a_2_0": {
      "frame": { "x": 192, "y": 0, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "plant_64_a_0_0": {
      "frame": { "x": 0, "y": 64, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "bookshelf_64_a_0_0": {
      "frame": { "x": 64, "y": 64, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "bookshelf_64_a_2_0": {
      "frame": { "x": 64, "y": 64, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "rug_64_a_0_0": {
      "frame": { "x": 128, "y": 64, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "whiteboard_64_a_0_0": {
      "frame": { "x": 192, "y": 64, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "whiteboard_64_a_2_0": {
      "frame": { "x": 192, "y": 64, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    }
  },
  "meta": {
    "image": "furniture_atlas.png",
    "format": "RGBA8888",
    "size": { "w": 256, "h": 256 }
  }
}
EOF

echo "✓ Generated furniture_atlas.json with proper frame coordinates"
ls -lh "$OUTPUT_DIR/furniture_atlas.png" "$OUTPUT_DIR/furniture_atlas.json"
