# Puppet

The C application running on kiosk Devices. It enrolls itself with Puppeteer, waits for approval, then keeps the Device's event feed up to date, sends heartbeats, logs and Telemetry, and executes Commands sent by Admins. Built with CMake, using Tencent's MMKV for persistence, libcurl for HTTP(S) and libmosquitto to hear Wake-ups over MQTT.

## What it does

1. **Enrollment** (ADR-0002): on first start it calls `POST /devices/connect` and stores the issued credentials. The Device then appears in the Superadmin's pending queue.
2. **Pending**: it checks its status every 15 s and sends heartbeats, waiting indefinitely without flooding Puppeteer.
3. **Active**: once approved, it also fetches Commands, listens for Wake-ups (below) and refreshes the Organization's event feed every 5 minutes, storing the last valid feed in MMKV. Commands are never fetched on a timer: a fetch happens once on boot, whenever a heartbeat answer says some are waiting, whenever a Wake-up is heard and after every (re)subscription to the broker.
4. **Rejected**: it goes quiet, checking its status only hourly.
5. **Revoked credentials** (HTTP 401): it forgets them and enrolls again.

### Wake-ups, cadence and request volume

When Puppeteer stores a Command it publishes an empty **Wake-up** to a public MQTT broker, on the topic `<deviceId>/<organizationId>` (QoS 1, not retained; see ADR-0001 of the monorepo). An active Puppet is subscribed to that topic with a clean session and fetches its Commands as soon as it hears one, so a Command reaches the Device without waiting for a heartbeat.

The broker is only an accelerator. Every heartbeat answer carries `commandsWaiting`, which is true while any Command of the Device is `pending` or `sent`, so a missed Wake-up (broker down, Puppet offline) costs at most one heartbeat. A heartbeat answer without a boolean `commandsWaiting` is a decoding error: the Puppet logs it as an error (Admins read it in the Device's logs), counts the heartbeat as failed and never assumes a value.

| Task                | Cadence                                                      |
|---------------------|--------------------------------------------------------------|
| Heartbeat           | every 20 s                                                   |
| Status check        | every 15 s pending, 60 s active, hourly when rejected        |
| Event feed          | every 5 minutes (a failed refresh retries after 60 s)        |
| Command fetch       | on boot, on `commandsWaiting`, on a Wake-up, after subscribing |
| Broker connection   | reconnects after 10 s, doubling up to 300 s, plus up to 50% jitter |

An idle active Device sends about **252 requests per hour** to Puppeteer (180 heartbeats, 60 status checks, 12 feed refreshes), down from about 612 when it also polled Commands every 10 s. The MQTT connection is not a Puppeteer request.

The agent loop stays single-threaded: it waits on the broker socket, and on termination signals, with a timeout bounded by the next due task, so heartbeats and shutdown are never delayed by the broker. The one exception is the hostname lookup when a connection starts, which is blocking.

**Outages.** When the broker connection is lost or cannot be made, the Puppet reconnects with the backoff above and logs exactly one error line for the outage and one info line when the broker is back, however many attempts it takes. An outage does not make the heartbeat report `degraded`: Commands still arrive through the heartbeat. After a (re)subscription the Puppet fetches Commands once, to catch Wake-ups sent while it could not hear them. If the Device's Organization changes it moves the subscription to the new topic, and it drops the connection when it leaves the active phase.

**Settings.** The broker host, port and TLS are compile-time constants (CMake options `PUPPET_WAKEUP_BROKER_HOST`, default `broker.hivemq.com`; `PUPPET_WAKEUP_BROKER_PORT`, default `8883`; `PUPPET_WAKEUP_BROKER_TLS`, default `ON`). The Puppet reads no environment variables for them. With TLS on, the broker's certificate is verified against the system certificate store.

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
| 9           | Installing needs root and `sudo`, `pkexec` or `su` could not be started |
| 10          | An installation step failed; completed steps are in the trail |
| 11          | The Device was not pending 60 s after the install or repair   |
| 12          | The descriptor that reports termination signals could not be created |
| 13          | The MQTT library could not be initialized                  |

When `sudo` or `pkexec` refuses, the Puppet says so and tries the next way. When `su` itself fails (wrong password) its own message and exit status (1) are what the technician sees. Through `pkexec` the terminal exits with the status of the Puppet run as root.

### Device Audit Trail

Every change the agent makes to the Device is appended to `/var/lib/dsrs-puppet/audit-trail.jsonl`, one JSON object per line with `when`, `who`, `what`, `before` and `after`:

```json
{"when":"2026-01-02T03:04:05Z","who":{"kind":"command","identifier":"<command id>"},"what":"binary","before":"0.0.1","after":"0.0.2 sha256:<hex>"}
```

`who` is `agent` (no identifier), `command` (the Puppeteer Command id) or `user` (a local operating-system user, for the Installation). The agent records Enrollment changes, every executed Command with its result, self-updates (as a change of the `binary`, like the Installation, so the latest `binary` entry always describes what is installed), and reboots and power-offs before they are triggered. The file is only ever appended to, concurrent writers produce separate intact lines, and a failed write is logged as an error without stopping the work. Resuming stored credentials is not an Enrollment change, so a restart records nothing by itself.

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
- **libmosquitto development files**
  - **Fedora/RHEL**: `sudo dnf install mosquitto-devel`
  - **Ubuntu/Debian**: `sudo apt install libmosquitto-dev`
- Standard build tools (e.g., `make`, `ninja`, or Visual Studio build tools)

On the Device itself only the libcurl and libmosquitto runtimes (`libcurl4` and `libmosquitto1` on Debian) are needed.

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

1. re-runs itself as root, with the same arguments, only because a repair is needed, saying each way before it asks for a password:
   1. `sudo`, when `sudo -v` accepts your user (your own password);
   2. otherwise `pkexec`, when installed: polkit lets you authenticate as any administrator (a member of the `sudo` group), with that administrator's password, so a user without sudo rights can install with an administrator's help;
   3. otherwise `su`, the last resort, which needs the root password (Debian locks root when its installer created a sudo user).

   It fails with a clear error, changing nothing, when none works;
2. creates `/var/lib/dsrs-puppet` and `/opt/dsrs-puppet` when missing;
3. copies the running executable to `/opt/dsrs-puppet/puppet` when the binary is missing, not an ELF or for another architecture. **A valid installed binary is never replaced by a terminal run**, even when it differs from the running one: only self-update changes it, so an old copy on a USB stick cannot downgrade a Device;
4. writes the unit when it is missing or differs, and reloads systemd;
5. enables the service when it is not (checked again after the unit is restored, which usually restores it too), starts it when it is stopped, and restarts it when it was running: that agent predates the repair, and a restarted agent logs again where its Enrollment stands;
6. prints what it changed;
7. watches the agent (below).

Every change is appended to the Device Audit Trail with the technician as "who" (`SUDO_USER`, which the Puppet also sets for `su`, or the user `PKEXEC_UID` names), and before and after. Pieces that were already right are not recorded. A failure partway leaves the steps already done in the trail and attempts nothing more. From then on systemd runs the agent at boot, restarts it if it crashes and keeps it independent of any terminal.

After a repair or install the terminal stays on as a read-only observer so the technician sees on site whether the Device works. It streams the `dsrs-puppet` service's journal lines live and finishes:

- with a summary (connected to Puppeteer, waiting for approval, Device identifier) once the agent logs that the Device is pending (or already approved). The agent logs where its Enrollment stands when it connects and on its first status check after starting, and the repair always (re)starts it, so this line always comes. The evidence is the agent's own log from the start of the watch: a stored record (credentials in the store, an entry in the Audit Trail) could predate this run and says nothing about whether the agent reaches Puppeteer now;
- or after 60 seconds with the agent's last error (network, TLS, HTTP) and exit status 11. The service keeps retrying on its own.

The terminal never takes the agent lock and never opens the agent's storage: the token, the feed and the Command queue are out of its reach. It only reads the journal. Closing the terminal while it streams ends the watch and nothing else, because the agent belongs to systemd. An intact Installation is not watched; it only prints the status summary.

The installed version is the one the Audit Trail last recorded for the `binary`, checked against the SHA-256 of the binary actually installed: a binary nobody recorded, or one replaced outside the Puppet, is reported as such instead of a version. The Enrollment state is read from the Audit Trail, so it is only as current as the last recorded change (an approval that happened while the agent was not running is not in it). A service that is stopped but enabled is reported in the summary and left alone.

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
Use the provided toolchain file. During the configuration step, CMake will **automatically download and set up the required target sysroot**, libcurl and libmosquitto included (using `scripts/setup-arm32-sysroot.sh`), into a local `sysroot` directory. The setup runs again automatically whenever that script changes.
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
