# The Puppet installs and repairs itself, configured only at compile time

The Puppeteer URL and every path the Puppet uses are compile-time constants, and the Puppet reads no environment variables. A technician copies one binary to a Device and runs `./puppet` as a normal user. If the Installation is missing or diverges from what is expected, the Puppet re-runs itself as root (through `sudo`, then `pkexec`, then `su`, see below) and installs or repairs it. Otherwise it only reports status. We chose this because Devices must leave no room for a wrong or forgotten installation step. A single file and a single command, checked against the real system state, can't be half-done or misconfigured by hand.

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
- **Elevation.** Tried in turn, each said on the terminal first. `sudo` when `sudo -v` accepts the technician, since only `sudo` knows (a group, or the user's own sudoers entry). Otherwise `pkexec`: polkit lets a technician without sudo rights authenticate as an administrator (a member of the `sudo` group), with that administrator's password. Otherwise `su`, the last resort, which needs the root password and so fails where Debian locked root. A password is always typed, never embedded. `pkexec` cannot be asked first like `sudo -v`, so the Puppet waits for it and falls back only when it did not authorize.
- **Only one agent.** The process systemd starts holds a `flock` on the agent lock. A terminal run never becomes the agent. After installing or repairing, it (re)starts the service and streams the agent's journal until the agent logs that its Enrollment is pending, for up to 60 s. The evidence is the agent's own log, not stored state: credentials in the store or an entry in the trail could predate the run and do not prove that the agent reaches Puppeteer now.
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
