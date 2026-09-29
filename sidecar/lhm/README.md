# LHM Sidecar (`lhm-sidecar`)

A small **C# / .NET 8 console app** that exposes
[LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor)
(LHM) sensors to the **Rust backend** of the G-Telemetry Tauri app over
**NDJSON on stdio** (newline-delimited JSON — one JSON object per line).

## Why a sidecar?

LHM is a .NET library. The Rust backend uses `sysinfo`, which cannot read deep
hardware sensors. LHM can read what `sysinfo` cannot:

- Motherboard / super-IO voltages (e.g. Nuvoton `nct6795d`)
- Case-fan **RPM** and fan **CONTROL** writes (set fan duty %)
- CPU package power and per-core sensors via **MSR**
- GPU sensors, and storage **SMART** attributes

The Rust side spawns this exe as a child process and talks to it line-by-line.

## Runtime requirements (cannot be exercised in CI/sandbox)

1. **Administrator / elevation.** LHM installs and starts a **kernel driver**
   (Ring0) on first `Computer.Open()` to read SIO / MSR / SMBus. Without admin,
   many sensors are missing or `Update()` throws. The sidecar reports elevation
   in its `pong` reply (`"admin": true|false`) so the Rust side can warn the
   user. Elevation is detected with
   `WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator)`.
2. **The LHM kernel driver** is loaded by `Computer.Open()`. On a locked-down
   machine this can be blocked by policy / Secure Boot HVCI; sensors will then be
   empty even when elevated.
3. **Windows only** (`net8.0-windows`, `win-x64`). LHM's Ring0 driver is
   Windows-specific.

## Build

Plain build / typecheck (fast, framework-dependent):

```sh
dotnet build
```

Distributable, self-contained single-file exe (no .NET runtime needed on target):

```sh
dotnet publish -c Release -r win-x64 --self-contained
```

The `.csproj` sets `PublishSingleFile` and `SelfContained` hints. Output lands
under `bin/Release/net8.0-windows/win-x64/publish/lhm-sidecar.exe`.

> **Tauri sidecar bundling.** Tauri expects an `externalBin` named with the
> target triple, e.g. `lhm-sidecar-x86_64-pc-windows-msvc.exe`. Copy/rename the
> published exe accordingly when wiring it into `tauri.conf.json`.

## How the Rust side locates the exe

The Rust backend reads the env var **`GHT_LHM_SIDECAR`** for the absolute path
to the sidecar exe. If unset, the Rust side falls back to the bundled
Tauri sidecar resolved next to the main app binary. (Setting the command surface
is the Rust agent's job — this is the contract.)

## Protocol (frozen — NDJSON, one JSON object per line)

The sidecar reads one request per line from **stdin** and writes one reply per
line to **stdout**, flushing after each. It exits cleanly (code 0) when stdin
closes. Blank lines are ignored.

| Request (stdin)                                              | Reply (stdout)                                                                                                                                  |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `{"cmd":"ping"}`                                            | `{"type":"pong","version":"0.1.0","admin":<bool>}`                                                                                              |
| `{"cmd":"snapshot"}`                                        | `{"type":"snapshot","sensors":[{"id":"<Identifier>","name":"<Sensor.Name>","hw":"<Hardware.Name>","type":"<SensorType>","value":<double>,"unit":"<unit>"}, ...]}` |
| `{"cmd":"set_fan","id":"<control id>","percent":<0-100>}`  | `{"type":"ack","id":"<id>","ok":true}` or `{"type":"ack","id":"<id>","ok":false,"error":"<msg>"}`                                               |
| `{"cmd":"set_fan_auto","id":"<control id>"}`               | `{"type":"ack","id":"<id>","ok":true}` (or `ok:false` + `error`)                                                                                |
| _(unknown cmd / bad JSON)_                                  | `{"type":"error","message":"<msg>"}`                                                                                                            |

### Snapshot details

- Walks **Computer → Hardware → SubHardware → Sensors** recursively.
- `id` = `sensor.Identifier.ToString()` — matches the paths in
  `config/config_hierarchical.yaml` (e.g. `/lpc/nct6795d/0/temperature/0`).
- `type` = `sensor.SensorType.ToString()` — e.g. `Temperature`, `Voltage`,
  `Fan`, `Control`, `Load`, `Clock`, `Power`, `Data`.
- Sensors are refreshed with an `IVisitor` (`hardware.Update()`) before each
  snapshot.
- Sensors with a **null** value are skipped.

### Units mapped per `SensorType`

| SensorType  | unit  |  | SensorType   | unit    |
| ----------- | ----- |--| ------------ | ------- |
| Voltage     | `V`   |  | Fan          | `RPM`   |
| Current     | `A`   |  | Flow         | `L/h`   |
| Power       | `W`   |  | Control      | `%`     |
| Clock       | `MHz` |  | Level        | `%`     |
| Temperature | `°C`  |  | Data         | `GB`    |
| Load        | `%`   |  | SmallData    | `MB`    |
| Frequency   | `Hz`  |  | Throughput   | `B/s`   |

(`Factor` → empty string; other rarer types mapped in `Program.cs`.)

### Fan control

- `set_fan` finds the `Control` sensor by Identifier and calls
  `control.SetSoftware(percent)` (percent clamped to 0–100).
- `set_fan_auto` calls `control.SetDefault()` to hand control back to the BIOS.
- If no matching control sensor is found, the ack is `ok:false` with an
  `"error"` field.

## Files

- `LhmSidecar.csproj` — net8.0-windows console project; references
  `LibreHardwareMonitorLib 0.9.*` + `System.Text.Json`.
- `Program.cs` — the stdio NDJSON loop, sensor walk, fan control, elevation check.
- `.gitignore` — ignores `bin/` and `obj/`.
