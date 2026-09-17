#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BUNDLE_DIR="${REPO_ROOT}/src-tauri/target/release/bundle/pacman"
BUILD_DIR="${SCRIPT_DIR}/build"

echo "=== Building Arch Linux Pacman Package for Sentinel Terminal ==="

# Ensure release binary exists
if [ ! -f "${REPO_ROOT}/src-tauri/target/release/sentinel-terminal" ]; then
    echo "ERROR: Release binary not found at src-tauri/target/release/sentinel-terminal"
    echo "Run 'npm run tauri build' or 'cargo build --release' first."
    exit 1
fi

# Prepare build directory
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
mkdir -p "${BUNDLE_DIR}"

# Stage sources
cp "${REPO_ROOT}/src-tauri/target/release/sentinel-terminal" "${BUILD_DIR}/"
cp "${SCRIPT_DIR}/sentinel-terminal.desktop" "${BUILD_DIR}/"
cp "${REPO_ROOT}/src-tauri/icons/icon.png" "${BUILD_DIR}/icon.png"
cp "${REPO_ROOT}/src-tauri/icons/128x128.png" "${BUILD_DIR}/128x128.png"
cp "${REPO_ROOT}/src-tauri/icons/32x32.png" "${BUILD_DIR}/32x32.png"
cp "${SCRIPT_DIR}/PKGBUILD" "${BUILD_DIR}/"

# Build package using makepkg
cd "${BUILD_DIR}"
makepkg -f --nodeps

# Copy result to bundle directory
PKG_FILE=$(find "${BUILD_DIR}" -name "*.pkg.tar.zst" -type f | head -n 1)
if [ -n "${PKG_FILE}" ]; then
    cp "${PKG_FILE}" "${BUNDLE_DIR}/"
    echo "Pacman package created: ${BUNDLE_DIR}/$(basename "${PKG_FILE}")"
else
    echo "ERROR: Failed to find generated .pkg.tar.zst"
    exit 1
fi

# Clean up
rm -rf "${BUILD_DIR}"
echo "=== Arch Pacman Package Build Complete ==="
