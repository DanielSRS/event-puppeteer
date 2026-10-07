# Puppet

The C application running on kiosk Devices. It enrolls itself with Puppeteer, waits for approval, then keeps the Device's event feed up to date, sends heartbeats, logs and Telemetry, and executes Commands sent by Admins. Built with CMake, using Tencent's MMKV for persistence and libcurl for HTTP(S).

## What it does

1. **Enrollment** (ADR-0002): on first start it calls `POST /devices/connect` and stores the issued credentials. The Device then appears in the pending queue: the Organization Admin's when `PUPPET_ORGANIZATION_ID` is set, otherwise the Superadmin's.
2. **Pending**: it checks its status every 15 s and sends heartbeats, waiting indefinitely without flooding Puppeteer.
3. **Active**: once approved, it also polls Commands every 10 s and refreshes the Organization's event feed every 5 minutes, storing the last valid feed in MMKV.
4. **Rejected**: it goes quiet, checking its status only hourly.
5. **Revoked credentials** (HTTP 401): it forgets them and enrolls again.

Connection failures back off exponentially (5 s up to 5 min, with jitter). `SIGTERM`, `SIGINT` and `SIGHUP` shut it down gracefully.

### Commands

| Command             | Behavior                                         |
|---------------------|--------------------------------------------------|
| `request_telemetry` | Sends a detailed Telemetry report                |
| `restart`           | `systemctl reboot --no-block`                    |
| `shutdown`          | `systemctl poweroff --no-block`                  |
| `update`, `open_ssh`, `custom` | Not supported yet: reported as failed |

`restart` and `shutdown` require the Puppet's user to be allowed to reboot and power off (run as root, or grant it through polkit).

Displaying events on screen is not implemented yet. The feed is stored under the `feed.events` key for a future display.

## Configuration

| Variable                   | Meaning                                       | Default                                    |
|----------------------------|-----------------------------------------------|--------------------------------------------|
| `PUPPET_SERVER_URL`        | Puppeteer base URL (`http://` or `https://`)  | **required**                               |
| `PUPPET_ORGANIZATION_ID`   | Organization to request Enrollment into       | none (Superadmin queue)                    |
| `PUPPET_DATA_DIRECTORY`    | Persistent storage (credentials, feed)        | `$XDG_DATA_HOME/puppet`, else `~/.local/share/puppet` |
| `PUPPET_DEVICE_IDENTIFIER` | Stable identity announced on connect          | `/etc/machine-id`                          |

The data directory must be on persistent storage. Losing it makes the Device enroll again as a new pending Device.

## Prerequisites

To build and run this project natively, ensure you have the following installed on your system:
- **CMake** (version 3.19 or higher)
- **C and C++ Compilers** (e.g., GCC/G++, Clang, or MSVC) - *Note: A C++ compiler is required because the underlying MMKV library is written in C++.*
- **libcurl development files**
  - **Fedora/RHEL**: `sudo dnf install libcurl-devel`
  - **Ubuntu/Debian**: `sudo apt install libcurl4-openssl-dev`
- Standard build tools (e.g., `make`, `ninja`, or Visual Studio build tools)

On the Device itself only the libcurl runtime (`libcurl4` on Debian) is needed.

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
PUPPET_SERVER_URL=http://localhost:3000 ./build/puppet
```

**On Windows:**
Depending on your generator (e.g., MSVC), the executable might be nested inside a build type directory:
```cmd
.\build\Debug\puppet.exe
```

## Running the Tests

Unit tests cover the pure modules: JSON, the device protocol, configuration and the agent schedule. They need neither a network nor Puppeteer.

```bash
cmake --build build --target puppet-tests
ctest --test-dir build --output-on-failure
```

## Cross-Compiling

This project is configured to be cross-compiled for multiple platforms (Android, Windows, Linux, macOS) using CMake.

### Linux ARM32 (e.g., Raspberry Pi 32-bit)

**Prerequisites (Host Machine):**
You must install the ARM32 C and C++ cross-compilers on your host machine to compile the code.
- **Fedora/RHEL**: `sudo dnf install gcc-arm-linux-gnu gcc-c++-arm-linux-gnu`
- **Ubuntu/Debian**: `sudo apt install gcc-arm-linux-gnueabihf g++-arm-linux-gnueabihf`

**Build Instructions:**
Use the provided toolchain file. During the configuration step, CMake will **automatically download and set up the required target sysroot**, libcurl included (using `scripts/setup-arm32-sysroot.sh`), into a local `sysroot` directory. The setup runs again automatically whenever that script changes.
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
