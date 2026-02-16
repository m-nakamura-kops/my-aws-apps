#!/bin/bash

# PWAアイコン作成スクリプト
# このスクリプトは、icon.svgからPNGアイコンを生成します
# 必要なツール: ImageMagick または Inkscape

echo "PWAアイコンを作成しています..."

# ImageMagickを使用する場合
if command -v convert &> /dev/null; then
    echo "ImageMagickを使用してアイコンを生成します..."
    convert -background none -resize 192x192 public/icon.svg public/icon-192.png
    convert -background none -resize 512x512 public/icon.svg public/icon-512.png
    echo "✅ アイコンの作成が完了しました！"
    exit 0
fi

# Inkscapeを使用する場合
if command -v inkscape &> /dev/null; then
    echo "Inkscapeを使用してアイコンを生成します..."
    inkscape --export-type=png --export-width=192 --export-height=192 --export-filename=public/icon-192.png public/icon.svg
    inkscape --export-type=png --export-width=512 --export-height=512 --export-filename=public/icon-512.png public/icon.svg
    echo "✅ アイコンの作成が完了しました！"
    exit 0
fi

# ツールが見つからない場合
echo "❌ ImageMagick または Inkscape が見つかりません。"
echo ""
echo "以下のいずれかの方法でアイコンを作成してください："
echo ""
echo "方法1: ImageMagickをインストール"
echo "  macOS: brew install imagemagick"
echo "  Ubuntu: sudo apt-get install imagemagick"
echo ""
echo "方法2: Inkscapeをインストール"
echo "  macOS: brew install inkscape"
echo "  Ubuntu: sudo apt-get install inkscape"
echo ""
echo "方法3: オンラインツールを使用"
echo "  https://realfavicongenerator.net/"
echo "  https://www.pwabuilder.com/imageGenerator"
echo ""
echo "方法4: 手動で作成"
echo "  public/icon.svg を参考に、192x192px と 512x512px のPNG画像を作成してください"
echo "  テトリスをテーマにしたデザインを推奨します"
