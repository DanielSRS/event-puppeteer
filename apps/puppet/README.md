# Puppet

A simple C application built with cross-platform support using CMake, leveraging Tencent's MMKV.

## Prerequisites

To build and run this project natively, ensure you have the following installed on your system:
- **CMake** (version 3.19 or higher)
- **C and C++ Compilers** (e.g., GCC/G++, Clang, or MSVC) - *Note: A C++ compiler is now required because the underlying MMKV library is written in C++.*
- Standard build tools (e.g., `make`, `ninja`, or Visual Studio build tools)

## Native Build Instructions

1. Open your terminal and navigate to the root of the project directory.
2. Configure the project:
   ```bash
   cmake -B build
   ```
3. Compile the application:
   ```bash
   cmake --build build
   ```

## Running the Application

**On Linux / macOS:**
```bash
./build/puppet
```

**On Windows:**
Depending on your generator (e.g., MSVC), the executable might be nested inside a build type directory:
```cmd
.\build\Debug\puppet.exe
```

## Cross-Compiling

This project is configured to be cross-compiled for multiple platforms (Android, Windows, Linux, macOS) using CMake.

### Linux ARM32 (e.g., Raspberry Pi 32-bit)

**Prerequisites (Host Machine):**
You must install the ARM32 C and C++ cross-compilers on your host machine to compile the code.
- **Fedora/RHEL**: `sudo dnf install gcc-arm-linux-gnu gcc-c++-arm-linux-gnu`
- **Ubuntu/Debian**: `sudo apt install gcc-arm-linux-gnueabihf g++-arm-linux-gnueabihf`

**Build Instructions:**
Use the provided toolchain file. During the configuration step, CMake will **automatically download and setup the required target sysroot** (using `scripts/setup-arm32-sysroot.sh`) into a local `sysroot` directory if it does not already exist.
```bash
cmake -B build-linux-arm32 -DCMAKE_TOOLCHAIN_FILE=toolchains/arm32-linux.cmake
cmake --build build-linux-arm32
```

### Android ARM32 (armeabi-v7a)

**Prerequisites (Host Machine):**
- Android NDK installed.

**Build Instructions:**
```bash
cmake -B build-android-arm32 \
  -DCMAKE_SYSTEM_NAME=Android \
  -DCMAKE_ANDROID_ARCH_ABI=armeabi-v7a \
  -DCMAKE_ANDROID_NDK=/path/to/your/android-ndk
cmake --build build-android-arm32
```
