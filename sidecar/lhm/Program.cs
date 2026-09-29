// LhmSidecar — exposes LibreHardwareMonitor (LHM) sensors to the Rust backend
// of the G-Telemetry Tauri app over NDJSON (newline-delimited JSON) on stdio.
//
// Why this exists: LHM is a .NET library that can read deep hardware sensors
// (motherboard voltages, case-fan RPM, fan CONTROL writes, CPU MSR, GPU, SMART)
// that Rust's `sysinfo` cannot. The Rust backend spawns this console app and
// talks to it line-by-line: one JSON request per line on stdin, one JSON reply
// per line on stdout (flushed after each write).
//
// Runtime requirements (cannot be exercised in CI/sandbox):
//   * Must run elevated (Administrator). LHM loads a kernel driver (Ring0) to
//     read SIO/MSR/SMBus. Without admin, many sensors are missing or Update()
//     throws; the `ping` reply reports `admin` so the Rust side can warn.
//   * The LHM kernel driver is installed/started on first Computer.Open().
//
// Protocol is frozen and MUST match the Rust client exactly. See README.md.

using System.Security.Principal;
using System.Text.Json;
using System.Text.Json.Serialization;
using LibreHardwareMonitor.Hardware;

namespace LhmSidecar;

internal static class Program
{
    private const string Version = "0.1.0";

    // Compact, single-line JSON (no indentation) so every reply is exactly one line.
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private static int Main()
    {
        // LHM enumeration must be stable regardless of host culture; numbers are
        // serialized by System.Text.Json (always invariant), but be explicit.
        Thread.CurrentThread.CurrentCulture = System.Globalization.CultureInfo.InvariantCulture;

        var computer = new Computer
        {
            IsCpuEnabled = true,
            IsGpuEnabled = true,
            IsMotherboardEnabled = true,
            IsMemoryEnabled = true,
            IsStorageEnabled = true,
            IsControllerEnabled = true,
            IsNetworkEnabled = true,
            // IsBatteryEnabled / IsPsuEnabled left default; enable later if needed.
        };

        // Computer.Open() loads the kernel driver and probes hardware. If this
        // throws (no admin / driver blocked), we still want to serve `ping` so the
        // Rust side learns admin=false rather than seeing the process die silently.
        bool opened = false;
        try
        {
            computer.Open();
            opened = true;
        }
        catch
        {
            opened = false;
        }

        var updateVisitor = new UpdateVisitor();

        var stdout = Console.Out;

        try
        {
            string? line;
            while ((line = Console.In.ReadLine()) != null)
            {
                line = line.Trim();
                if (line.Length == 0)
                {
                    continue;
                }

                string reply;
                try
                {
                    reply = Dispatch(line, computer, updateVisitor, opened);
                }
                catch (Exception ex)
                {
                    reply = ErrorJson(ex.Message);
                }

                stdout.WriteLine(reply);
                stdout.Flush();
            }
        }
        finally
        {
            if (opened)
            {
                try { computer.Close(); } catch { /* best-effort cleanup */ }
            }
        }

        return 0;
    }

    private static string Dispatch(string line, Computer computer, UpdateVisitor visitor, bool opened)
    {
        using JsonDocument doc = JsonDocument.Parse(line);
        JsonElement root = doc.RootElement;

        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("cmd", out JsonElement cmdEl))
        {
            return ErrorJson("missing 'cmd' field");
        }

        string? cmd = cmdEl.GetString();
        switch (cmd)
        {
            case "ping":
                return JsonSerializer.Serialize(new PongReply
                {
                    Version = Version,
                    Admin = IsElevated(),
                }, JsonOpts);

            case "snapshot":
                return JsonSerializer.Serialize(new SnapshotReply
                {
                    Sensors = CollectSensors(computer, visitor, opened),
                }, JsonOpts);

            case "set_fan":
            {
                string? id = GetString(root, "id");
                if (id == null)
                {
                    return JsonSerializer.Serialize(new AckReply { Id = "", Ok = false, Error = "missing 'id'" }, JsonOpts);
                }

                float percent = (float)GetDouble(root, "percent", 0);
                percent = Math.Clamp(percent, 0f, 100f);
                return SetFan(computer, id, percent);
            }

            case "set_fan_auto":
            {
                string? id = GetString(root, "id");
                if (id == null)
                {
                    return JsonSerializer.Serialize(new AckReply { Id = "", Ok = false, Error = "missing 'id'" }, JsonOpts);
                }

                return SetFanAuto(computer, id);
            }

            default:
                return ErrorJson($"unknown cmd: {cmd ?? "(null)"}");
        }
    }

    private static List<SensorDto> CollectSensors(Computer computer, UpdateVisitor visitor, bool opened)
    {
        var sensors = new List<SensorDto>();
        if (!opened)
        {
            return sensors;
        }

        // Refresh every hardware value before reading.
        computer.Accept(visitor);

        foreach (IHardware hardware in computer.Hardware)
        {
            CollectFromHardware(hardware, sensors);
        }

        return sensors;
    }

    private static void CollectFromHardware(IHardware hardware, List<SensorDto> sensors)
    {
        foreach (ISensor sensor in hardware.Sensors)
        {
            // Skip null values per spec.
            if (!sensor.Value.HasValue)
            {
                continue;
            }

            sensors.Add(new SensorDto
            {
                Id = sensor.Identifier.ToString(),
                Name = sensor.Name,
                Hw = hardware.Name,
                Type = sensor.SensorType.ToString(),
                Value = sensor.Value.Value,
                Unit = UnitFor(sensor.SensorType, sensor.Name),
            });
        }

        // Recurse into SubHardware (e.g. motherboard -> super-IO chip).
        foreach (IHardware sub in hardware.SubHardware)
        {
            CollectFromHardware(sub, sensors);
        }
    }

    private static string SetFan(Computer computer, string id, float percent)
    {
        ISensor? sensor = FindSensor(computer, id, SensorType.Control);
        if (sensor?.Control == null)
        {
            return JsonSerializer.Serialize(new AckReply { Id = id, Ok = false, Error = "control sensor not found" }, JsonOpts);
        }

        try
        {
            sensor.Control.SetSoftware(percent);
            return JsonSerializer.Serialize(new AckReply { Id = id, Ok = true }, JsonOpts);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new AckReply { Id = id, Ok = false, Error = ex.Message }, JsonOpts);
        }
    }

    private static string SetFanAuto(Computer computer, string id)
    {
        ISensor? sensor = FindSensor(computer, id, SensorType.Control);
        if (sensor?.Control == null)
        {
            return JsonSerializer.Serialize(new AckReply { Id = id, Ok = false, Error = "control sensor not found" }, JsonOpts);
        }

        try
        {
            sensor.Control.SetDefault();
            return JsonSerializer.Serialize(new AckReply { Id = id, Ok = true }, JsonOpts);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new AckReply { Id = id, Ok = false, Error = ex.Message }, JsonOpts);
        }
    }

    // Find a sensor by its full Identifier string, optionally constrained to a type.
    private static ISensor? FindSensor(Computer computer, string id, SensorType? type)
    {
        foreach (IHardware hardware in computer.Hardware)
        {
            ISensor? found = FindInHardware(hardware, id, type);
            if (found != null)
            {
                return found;
            }
        }
        return null;
    }

    private static ISensor? FindInHardware(IHardware hardware, string id, SensorType? type)
    {
        foreach (ISensor sensor in hardware.Sensors)
        {
            if ((type == null || sensor.SensorType == type) &&
                string.Equals(sensor.Identifier.ToString(), id, StringComparison.Ordinal))
            {
                return sensor;
            }
        }

        foreach (IHardware sub in hardware.SubHardware)
        {
            ISensor? found = FindInHardware(sub, id, type);
            if (found != null)
            {
                return found;
            }
        }

        return null;
    }

    // Resolve the display unit for a sensor. Most units are fixed per SensorType,
    // but a few (Factor) are ambiguous and must be disambiguated by sensor name:
    //   * Factor "Power-On Hours" -> "h"; Factor "Power On Count" -> "" (unitless).
    private static string UnitFor(SensorType type, string name) => type switch
    {
        SensorType.Voltage => "V",
        SensorType.Current => "A",
        SensorType.Power => "W",
        SensorType.Clock => "MHz",
        SensorType.Temperature => "°C",
        SensorType.Load => "%",
        SensorType.Frequency => "Hz",
        SensorType.Fan => "RPM",
        SensorType.Flow => "L/h",
        SensorType.Control => "%",
        SensorType.Level => "%",
        // DIMM memory timings (tCAS/tRCD/tRP/...) are reported in nanoseconds.
        SensorType.Timing => "ns",
        // Factor is unit-ambiguous: "Power-On Hours" is hours, counts are unitless.
        SensorType.Factor => name.IndexOf("Hour", StringComparison.OrdinalIgnoreCase) >= 0 ? "h" : "",
        SensorType.Data => "GB",
        SensorType.SmallData => "MB",
        SensorType.Throughput => "B/s",
        SensorType.TimeSpan => "s",
        SensorType.Energy => "mWh",
        SensorType.Noise => "dBA",
        SensorType.Conductivity => "µS/cm",
        SensorType.Humidity => "%",
        _ => "",
    };

    // --- Elevation detection -------------------------------------------------
    // Admin is required for LHM's kernel driver to read SIO/MSR/SMBus sensors.
    private static bool IsElevated()
    {
        try
        {
            using WindowsIdentity identity = WindowsIdentity.GetCurrent();
            var principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch
        {
            return false;
        }
    }

    // --- JSON helpers --------------------------------------------------------
    private static string ErrorJson(string message) =>
        JsonSerializer.Serialize(new ErrorReply { Message = message }, JsonOpts);

    private static string? GetString(JsonElement obj, string prop) =>
        obj.TryGetProperty(prop, out JsonElement el) && el.ValueKind == JsonValueKind.String
            ? el.GetString()
            : null;

    private static double GetDouble(JsonElement obj, string prop, double fallback)
    {
        if (obj.TryGetProperty(prop, out JsonElement el))
        {
            if (el.ValueKind == JsonValueKind.Number && el.TryGetDouble(out double d))
            {
                return d;
            }
            if (el.ValueKind == JsonValueKind.String && double.TryParse(el.GetString(), out double s))
            {
                return s;
            }
        }
        return fallback;
    }
}

// IVisitor that forces every hardware/subhardware to recompute its sensors.
internal sealed class UpdateVisitor : IVisitor
{
    public void VisitComputer(IComputer computer) => computer.Traverse(this);

    public void VisitHardware(IHardware hardware)
    {
        hardware.Update();
        foreach (IHardware sub in hardware.SubHardware)
        {
            sub.Accept(this);
        }
    }

    public void VisitSensor(ISensor sensor) { }

    public void VisitParameter(IParameter parameter) { }
}

// --- DTOs (serialized one-per-line; property names are frozen) ---------------

internal sealed class PongReply
{
    [JsonPropertyName("type")] public string Type => "pong";
    [JsonPropertyName("version")] public string Version { get; init; } = "";
    [JsonPropertyName("admin")] public bool Admin { get; init; }
}

internal sealed class SnapshotReply
{
    [JsonPropertyName("type")] public string Type => "snapshot";
    [JsonPropertyName("sensors")] public List<SensorDto> Sensors { get; init; } = new();
}

internal sealed class SensorDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("name")] public string Name { get; init; } = "";
    [JsonPropertyName("hw")] public string Hw { get; init; } = "";
    [JsonPropertyName("type")] public string Type { get; init; } = "";
    [JsonPropertyName("value")] public double Value { get; init; }
    [JsonPropertyName("unit")] public string Unit { get; init; } = "";
}

internal sealed class AckReply
{
    [JsonPropertyName("type")] public string Type => "ack";
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("ok")] public bool Ok { get; init; }
    // Only emitted when set (DefaultIgnoreCondition.WhenWritingNull).
    [JsonPropertyName("error")] public string? Error { get; init; }
}

internal sealed class ErrorReply
{
    [JsonPropertyName("type")] public string Type => "error";
    [JsonPropertyName("message")] public string Message { get; init; } = "";
}
