#!/bin/bash
set -e

SYSROOT_DIR="${1:-sysroot}"
DEBIAN_RELEASE="bullseye"
ARCH="armhf"
MIRROR="http://deb.debian.org/debian"

# Minimal list of packages for X11 + EGL + C Standard Library + C++ Standard Library
PACKAGES=(
    "libstdc++-10-dev"
    "libstdc++6"
    "libgcc-10-dev"
    "libgcc-s1"
    "libc6-dev"
    "libc6"
    "linux-libc-dev"
    "libx11-dev"
    "libx11-6"
    "libxcb1-dev"
    "libxcb1"
    "libxau-dev"
    "libxau6"
    "libxdmcp-dev"
    "libxdmcp6"
    "libxext-dev"
    "libxext6"
    "x11proto-dev"
    "libegl-dev"
    "libglvnd-core-dev"
    "libgles-dev"
    "libgles1"
    "libgles2"
    "zlib1g-dev"
    "zlib1g"
    "libzstd-dev"
    "libzstd1"
    "libbsd0"
    "libmd0"
    "libbrotli-dev"
    "libbrotli1"
    "libegl1"
    "libglvnd-dev"
    "libglvnd0"
    "mesa-common-dev"
    "libgl-dev"
)

mkdir -p "$SYSROOT_DIR/tmp_debs"
cd "$SYSROOT_DIR/tmp_debs"

echo "Fetching package paths from Debian $DEBIAN_RELEASE..."
wget -qO Packages.xz "$MIRROR/dists/$DEBIAN_RELEASE/main/binary-$ARCH/Packages.xz"
xz -d Packages.xz

for pkg in "${PACKAGES[@]}"; do
    echo "Resolving $pkg..."
    # Find the exact filename in the Packages file
    FILE_PATH=$(awk -v p="Package: $pkg" '$0==p {f=1} f && /^Filename:/ {print $2; exit}' Packages)
    if [ -z "$FILE_PATH" ]; then
        echo "Error: Could not find path for $pkg"
        exit 1
    fi
    
    echo "Downloading $pkg..."
    wget -qO "$pkg.deb" "$MIRROR/$FILE_PATH"
    
    echo "Extracting $pkg..."
    ar x "$pkg.deb"
    if [ -f data.tar.xz ]; then
        tar -xf data.tar.xz -C ..
    elif [ -f data.tar.zst ]; then
        tar --zstd -xf data.tar.zst -C ..
    else
        echo "Unknown data tar format in $pkg.deb"
    fi
    rm -f control.tar.* data.tar.* debian-binary "$pkg.deb"
done

cd ..
rm -rf tmp_debs

echo "Fixing absolute symlinks in sysroot..."
# Convert absolute symlinks to relative so they work inside the sysroot
find usr/lib/arm-linux-gnueabihf -type l | while read link; do
    target=$(readlink "$link")
    if [[ $target == /* ]]; then
        ln -sf "../../..$target" "$link"
    fi
done

echo "Sysroot created successfully at $(pwd)"
