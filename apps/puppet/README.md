# Puppet

The C application running on kiosk Devices. It enrolls itself with Puppeteer, waits for approval, then keeps the Device's event feed up to date, sends heartbeats, logs and Telemetry, and executes Commands sent by Admins. Built with CMake, using Tencent's MMKV for persistence and libcurl for HTTP(S).

## What it does

1. **Enrollment** (ADR-0002): on first start it calls `POST /devices/connect` and stores the issued credentials. The Device then appears in the Superadmin's pending queue.
2. **Pending**: it checks its status every 15 s and sends heartbeats, waiting indefinitely without flooding Puppeteer.
3. **Active**: once approved, it also polls Commands every 10 s and refreshes the Organization's event feed every 5 minutes, storing the last valid feed in MMKV.
4. **Rejected**: it goes quiet, checking its status only hourly.
5. **Revoked credentials** (HTTP 401): it forgets them and enrolls again.

### Only one agent per Device

At startup the agent takes an exclusive, non-blocking `flock` on `/run/dsrs-puppet.lock` and holds it for its whole life. The kernel releases it when the process dies, so a crash never leaves a stale lock. The lock survives the self-update `execv` restart, so no second agent can start in between.

| Exit status | Meaning                                                    |
|-------------|------------------------------------------------------------|
| 0           | Graceful shutdown                                          |
| 1           | Invalid configuration (`/etc/machine-id`, build-time URL)  |
| 2           | HTTP could not be initialized                              |
| 3           | The HTTP client could not be allocated                     |
| 4           | Storage could not be opened                                |
| 5           | Restart into an updated binary failed                      |
| 6           | Another agent already holds the lock                       |
| 7           | The lock could not be opened or locked at all              |
| 8           | The running executable's path could not be determined      |
| 9           | Installing needs root and `sudo` or `su` could not be started |
| 10          | An installation step failed; completed steps are in the trail |
| 11          | The Device was not pending 60 s after the install or repair   |

When `sudo` or `su` itself fails (wrong password, user not allowed) its own message and exit status (1) are what the technician sees.

### Device Audit Trail

Every change the agent makes to the Device is appended to `/var/lib/dsrs-puppet/audit-trail.jsonl`, one JSON object per line with `when`, `who`, `what`, `before` and `after`:

```json
{"when":"2026-01-02T03:04:05Z","who":{"kind":"command","identifier":"<command id>"},"what":"self-update","before":"0.0.1","after":"0.0.2 sha256:<hex>"}
```

`who` is `agent` (no identifier), `command` (the Puppeteer Command id) or `user` (a local operating-system user, for the Installation). The agent records Enrollment changes, every executed Command with its result, self-updates, and reboots and power-offs before they are triggered. The file is only ever appended to, concurrent writers produce separate intact lines, and a failed write is logged as an error without stopping the work. Resuming stored credentials is not an Enrollment change, so a restart records nothing by itself.

Connection failures back off exponentially (5 s up to 5 min, with jitter). `SIGTERM`, `SIGINT` and `SIGHUP` shut it down gracefully.

### Commands

| Command             | Behavior                                         |
|---------------------|--------------------------------------------------|
| `request_telemetry` | Sends a detailed Telemetry report                |
| `restart`           | `systemctl reboot --no-block`                    |
| `shutdown`          | `systemctl poweroff --no-block`                  |
| `update`            | Downloads, verifies and installs a new binary, then restarts into it |
| `open_ssh`, `custom` | Not supported yet: reported as failed           |

`restart` and `shutdown` require the Puppet's user to be allowed to reboot and power off (run as root, or grant it through polkit).

#### `update` payload

```json
{ "url": "https://example.org/puppet-0.0.2-armhf", "sha256": "<64 hex characters>", "version": "0.0.2" }
```

- `url`: an absolute `http(s)` URL, or a path on Puppeteer starting with `/`. The Device token is sent only with paths on Puppeteer, never to other hosts. Redirects are followed, and downloads are capped at 64 MiB.
- `sha256`: required. Nothing is installed without it.
- `version`: optional, used only in logs.

The binary is downloaded next to the executable (`<executable>.update`). It is installed only if its SHA-256 matches **and** it is an ELF binary for the same architecture as the running one, so an x86 build can never brick an ARM kiosk. Installation is an atomic `rename` with both the file and the directory flushed to disk, so a power cut leaves either the old binary or the new one. The Puppet then reports success and replaces itself with `execv` (same PID and arguments, no service manager needed). Commands left in the same batch are redelivered to the new binary.

The Puppet's user must be able to write the executable's directory.

Displaying events on screen is not implemented yet. The feed is stored under the `feed.events` key for a future display.

## Configuration

The Puppet is configured only when it is built (ADR-0001) and reads no environment variables for configuration. The only two it reads, `INVOCATION_ID` (set by systemd) and `SUDO_USER` (set by sudo, or by the Puppet itself when it uses `su`), say who started the process.

**Puppeteer's URL** is given to CMake and baked into the binary. Configuring fails when it is missing or is not an `http://` or `https://` URL:

```bash
cmake -B build -DPUPPET_SERVER_URL=https://puppeteer.example
```

**Paths** are fixed constants:

| Piece          | Path                                      |
|----------------|-------------------------------------------|
| Binary         | `/opt/dsrs-puppet/puppet`                 |
| Data directory | `/var/lib/dsrs-puppet`                    |
| Unit           | `/etc/systemd/system/dsrs-puppet.service` |
| Agent lock     | `/run/dsrs-puppet.lock`                   |
| Audit Trail    | `/var/lib/dsrs-puppet/audit-trail.jsonl`  |

The Device's identity is always `/etc/machine-id`; the Puppet fails if it is missing or empty. It never sends an Organization on connect, so every Device enrolls through the Superadmin queue.

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
   cmake -B build -DPUPPET_SERVER_URL=https://puppeteer.example
   ```
3. Compile the application:
   ```bash
   cmake --build build
   ```

## Running the Application: the Installation

The Puppet installs itself (ADR-0001). Copy the one binary to the Device and run it as a normal user, with no arguments:

```bash
./puppet
```

Whether the Puppet is installed is never stored. Every run checks three pieces against the system:

- the binary at `/opt/dsrs-puppet/puppet` is an ELF executable for this architecture (the check self-update applies to a download);
- the unit `/etc/systemd/system/dsrs-puppet.service` exists with exactly the expected content: it waits for `network-online.target`, runs as root, uses `Restart=always` and is `WantedBy=multi-user.target`;
- `dsrs-puppet.service` is enabled.

When all three hold, `./puppet` prints a status summary (installed version, service state, the last Enrollment state recorded in the Audit Trail, Device identifier), writes nothing and asks for no password. Otherwise it repairs each diverging piece on its own, so a Device with nothing installed gets all of them:

1. re-runs itself as root, with the same arguments, only because a repair is needed, saying which way: it first asks `sudo -v` (your own password), and when `sudo` is missing or does not accept your user or password, it uses `su` (the root password), so a user without sudo rights can install too. It fails with a clear error, changing nothing, when neither works. A Device whose root account is locked has no root password, so `su` cannot work there: install from a user `sudo` accepts;
2. creates `/var/lib/dsrs-puppet` and `/opt/dsrs-puppet` when missing;
3. copies the running executable to `/opt/dsrs-puppet/puppet` when the binary is missing, not an ELF or for another architecture. **A valid installed binary is never replaced by a terminal run**, even when it differs from the running one: only self-update changes it, so an old copy on a USB stick cannot downgrade a Device;
4. writes the unit when it is missing or differs, and reloads systemd;
5. enables the service when it is not (checked again after the unit is restored, which usually restores it too), and starts it when it is stopped;
6. prints what it changed;
7. watches the agent (below).

Every change is appended to the Device Audit Trail with the technician (`SUDO_USER`, which the Puppet also sets for `su`) as "who", and before and after. Pieces that were already right are not recorded. A failure partway leaves the steps already done in the trail and attempts nothing more. From then on systemd runs the agent at boot, restarts it if it crashes and keeps it independent of any terminal.

After a repair or install the terminal stays on as a read-only observer so the technician sees on site whether the Device works. It streams the `dsrs-puppet` service's journal lines live and finishes:

- with a summary (connected to Puppeteer, waiting for approval, Device identifier) once the agent logs that the Device is pending (or already approved). The evidence is the agent's own log from the start of the watch: the store has no read-only mode, and a record in the Audit Trail could predate this run;
- or after 60 seconds with the agent's last error (network, TLS, HTTP) and exit status 11. The service keeps retrying on its own.

The terminal never takes the agent lock and never opens the agent's storage: the token, the feed and the Command queue are out of its reach. It only reads the journal. Closing the terminal while it streams ends the watch and nothing else, because the agent belongs to systemd. An intact Installation is not watched; it only prints the status summary.

The installed version comes from running the installed binary with `--version`. The Enrollment state is read from the Audit Trail, so it is only as current as the last recorded change (an approval that happened while the agent was not running is not in it). A service that is stopped but enabled is reported in the summary and left alone.

Which role a process plays is decided from how it was started: the **agent** is only the process systemd starts (`INVOCATION_ID` set) from `/opt/dsrs-puppet/puppet`; every other run is a **terminal** that installs, repairs or reports, and never becomes the agent.

Running the binary on a developer machine installs the service there too, after the password prompt.

## Running the Tests

Unit tests cover the pure modules: JSON, the device protocol, configuration, the agent schedule, SHA-256 and update compatibility checks. They need neither a network nor Puppeteer.

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
cmake -B build-linux-arm32 -DPUPPET_SERVER_URL=https://puppeteer.example -DCMAKE_TOOLCHAIN_FILE=toolchains/arm32-linux.cmake
cmake --build build-linux-arm32
```

### Android ARM32 (armeabi-v7a)

**Prerequisites (Host Machine):**
- Android NDK installed.

**Build Instructions:**
```bash
cmake -B build-android-arm32 \
  -DPUPPET_SERVER_URL=https://puppeteer.example \
  -DCMAKE_SYSTEM_NAME=Android \
  -DCMAKE_ANDROID_ARCH_ABI=armeabi-v7a \
  -DCMAKE_ANDROID_NDK=/path/to/your/android-ndk
cmake --build build-android-arm32
```
