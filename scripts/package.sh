#!/usr/bin/env bash
# RECOMMENDED: Use `npm run package`` to run ''./package.js'

set -o errexit -o nounset -o pipefail -o xtrace

OUTPUT="chrome-extension.zip"
INPUTS=(
	"dist/*"
	"manifest.json"
)

zip -r "$OUTPUT" "${INPUTS[@]}" -x ".DS_Store" -x "dist/*.map"

echo "Packed extension to $OUTPUT"
