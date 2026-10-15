# The Puppet installs and repairs itself, configured only at compile time

The Puppeteer URL and every path the Puppet uses are compile-time constants, and the Puppet reads no environment variables. A technician copies one binary to a Device and runs `./puppet` as a normal user. If the Installation is missing or diverges from what is expected, the Puppet re-runs itself through `sudo` (the technician types the password) and installs or repairs it. Otherwise it only reports status. We chose this because Devices must leave no room for a wrong or forgotten installation step. A single file and a single command, checked against the real system state, can't be half-done or misconfigured by hand.

## Decisions

- **Configuration.** The URL and paths are baked into the build. CMake refuses to configure without the URL. There is one binary for the whole fleet. `PUPPET_ORGANIZATION_ID` is dropped: every Device enrolls through the Superadmin queue. ADR-0002's Organization path stays in Puppeteer, unused by the Puppet for now. `PUPPET_DEVICE_IDENTIFIER` is dropped: the identity is always `/etc/machine-id`.
- **Layout.** Every name visible to the operating system carries the `dsrs-` prefix, so it never collides with Debian's `puppet` package (Puppet Labs), which ships its own `puppet.service`.

  | Piece          | Path                                      |
  |----------------|-------------------------------------------|
  | Binary         | `/opt/dsrs-puppet/puppet`                 |
  | Data directory | `/var/lib/dsrs-puppet`                    |
  | Unit           | `/etc/systemd/system/dsrs-puppet.service` |
  | Agent lock     | `/run/dsrs-puppet.lock`                   |

- **"Installed" is verified, never assumed or stored.** The binary is a valid ELF for this architecture at its path, the unit matches the expected content, and the service is enabled. Any divergence is repaired. A flag in storage could disagree with the system and is not used.
- **The installed binary changes only through self-update**, or when it is not a valid ELF. Running an older copy from a USB stick never downgrades a Device.
- **The service runs as root** under systemd. That covers `systemctl reboot`/`poweroff`, self-update writing next to the binary, and the data directory. It survives the terminal closing and starts at boot.
- **Only one agent.** The process systemd starts holds a `flock` on the agent lock. A terminal run never becomes the agent. After installing or repairing, it streams the agent's journal until Enrollment reaches pending, for up to 60 s.
- **Every change is recorded** in the Device Audit Trail: an append-only file in the data directory, written by both the Installation and the agent.
- **No uninstall path.** A retired Device is reinstalled. A remote `uninstall` Command is under investigation (#18).

## Considered Options

- **Embedding the Device's user and password** to obtain root: rejected. `strings` exposes it to anyone with the binary, it is shared by the whole fleet, and rotating it means rebuilding. The person running the binary already knows it.
- **`.deb` package**: the standard route, but another artifact to build. dpkg would also fight self-update, which replaces the binary outside it.
- **Separate `install.sh`**: two files to copy, and the logic lives outside the tested C code.
- **`puppet install` subcommand**: leaves room for a forgotten or wrong command.
- **Environment variables in the unit**, or build values overridable by the environment: two sources with precedence are a fallback, and editing every Device's unit to change a value defeats self-update.
- **Detecting a developer machine by username** to skip the Installation: an indirect signal that silently changes behavior. Deferred together with a development build mode.

## Consequences

- Reinstalling Debian wipes the data directory and `/etc/machine-id`. The Device then enrolls as a new pending Device, and its Device Audit Trail is lost. Recognizing a reinstall by hardware identity is under investigation (#17).
- Running the binary on a developer machine installs the service there too, after the password prompt.
- Pointing the fleet at another Puppeteer URL means building and rolling out a new binary through self-update.
