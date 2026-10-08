import { describe, expect, test } from "vitest";
import { IsUpdateUrl, ValidateApproval, ValidateUpdate } from "./deviceForms";
import { FormatBytes, FormatDuration, FormatPercent, FormatTemperature, NOT_REPORTED, TelemetryGroups } from "./telemetryFormat";

const SHA = "a".repeat(64);

describe("ValidateApproval", () => {
  test("both fields required, trimmed", () => {
    expect(ValidateApproval({ name: " Totem ", location: " Biblioteca " })).toEqual({ ok: true, value: { name: "Totem", location: "Biblioteca" } });
    expect(ValidateApproval({ name: " ", location: "" })).toEqual({
      ok: false, error: { name: "Informe o nome do dispositivo.", location: "Informe onde o dispositivo está." },
    });
  });
});

describe("IsUpdateUrl", () => {
  test("absolute http(s) or a path", () => {
    expect(IsUpdateUrl("https://cdn.example.org/puppet")).toBe(true);
    expect(IsUpdateUrl("http://10.0.0.1/puppet")).toBe(true);
    expect(IsUpdateUrl("/updates/puppet-1.1.0")).toBe(true);
  });

  test("anything else is refused", () => {
    expect(IsUpdateUrl("cdn.example.org/puppet")).toBe(false);
    expect(IsUpdateUrl("ftp://cdn.example.org/puppet")).toBe(false);
    expect(IsUpdateUrl("//cdn.example.org/puppet")).toBe(false);
    expect(IsUpdateUrl("/com espaço")).toBe(false);
    expect(IsUpdateUrl("https://")).toBe(false);
  });
});

describe("ValidateUpdate", () => {
  test("valid payload, version optional", () => {
    expect(ValidateUpdate({ url: "/u/puppet", sha256: SHA, version: "" })).toEqual({ ok: true, value: { url: "/u/puppet", sha256: SHA } });
    expect(ValidateUpdate({ url: " /u/puppet ", sha256: ` ${SHA} `, version: " 1.1.0 " }))
      .toEqual({ ok: true, value: { url: "/u/puppet", sha256: SHA, version: "1.1.0" } });
  });

  test("errors per field", () => {
    expect(ValidateUpdate({ url: "", sha256: "", version: "" })).toEqual({
      ok: false, error: { url: "Informe de onde baixar o Puppet.", sha256: "Informe o SHA-256 do arquivo." },
    });
    const bad = ValidateUpdate({ url: "puppet.bin", sha256: "xyz", version: "" });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.error.url).toMatch(/endereço completo/);
    expect(bad.error.sha256).toBe("O SHA-256 tem 64 caracteres hexadecimais (0-9, a-f); este tem 3.");
  });
});

describe("telemetry values", () => {
  test("bytes", () => {
    expect(FormatBytes(512)).toBe("512 B");
    expect(FormatBytes(512 * 1024 * 1024)).toBe("512,0 MB");
    expect(FormatBytes(1.5 * 1024 ** 3)).toBe("1,5 GB");
  });

  test("durations", () => {
    expect(FormatDuration(45)).toBe("45 s");
    expect(FormatDuration(7200)).toBe("2 h");
    expect(FormatDuration(93784)).toBe("1 d 2 h 3 min");
  });

  test("temperature and percent", () => {
    expect(FormatTemperature(51.54)).toBe("51,5 °C");
    expect(FormatPercent(12.345)).toBe("12,3%");
  });
});

describe("TelemetryGroups", () => {
  test("every field is shown, missing ones as not reported", () => {
    const groups = TelemetryGroups({ cpuTemp: 51.5, diskTotal: 32 * 1024 ** 3, diskUsage: 8 * 1024 ** 3, hdmiConnected: false, restarts: 0 });
    const values = Object.fromEntries(groups.flatMap((g) => g.items).map((i) => [i.label, i.value]));
    expect(values["Temperatura da CPU"]).toBe("51,5 °C");
    expect(values["Disco em uso"]).toBe("8,0 GB de 32,0 GB (25,0%)");
    expect(values["HDMI"]).toBe("Desconectado");
    expect(values["Reinícios"]).toBe("0");
    expect(values["Memória em uso"]).toBe(NOT_REPORTED);
    expect(groups.flatMap((g) => g.items)).toHaveLength(26);
    expect(groups.flatMap((g) => g.lists).map((l) => l.entries)).toEqual([null, null, null, null]);
  });

  test("lists of instants are formatted", () => {
    const groups = TelemetryGroups({ startupTimes: ["2026-10-07T15:00:00Z"] });
    const startups = groups.flatMap((g) => g.lists).find((l) => l.label === "Inicializações");
    expect(startups?.entries).toEqual(["07/10/2026, 12:00"]);
  });
});
