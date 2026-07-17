import { describe, expect, it } from "vitest";
import {
  backupFileName,
  choosePort,
  decideSeed,
  decideStopAction,
  parseStatePayload,
} from "../scripts/local/lib.mjs";

/** Pure decision logic of the local install/run scripts — no processes, no files. */

describe("database backup naming", () => {
  it("contains only a timestamp — no username, path, or machine detail", () => {
    const name = backupFileName(new Date(2026, 6, 17, 9, 5, 3));
    expect(name).toBe("dev-backup-20260717-090503.db");
    expect(name).not.toMatch(/[\\/:]/);
  });
});

describe("state file parsing", () => {
  it("accepts a valid payload", () => {
    const state = parseStatePayload(
      JSON.stringify({ pid: 1234, port: 3000, startedAt: "2026-07-17T09:00:00Z" }),
    );
    expect(state).toEqual({ pid: 1234, port: 3000, startedAt: "2026-07-17T09:00:00Z" });
  });

  it.each([
    ["broken JSON", "{nope"],
    ["missing pid", JSON.stringify({ port: 3000, startedAt: "2026-07-17T09:00:00Z" })],
    ["negative pid", JSON.stringify({ pid: -1, port: 3000, startedAt: "2026-07-17T09:00:00Z" })],
    ["fractional pid", JSON.stringify({ pid: 12.5, port: 3000, startedAt: "2026-07-17T09:00:00Z" })],
    ["invalid port", JSON.stringify({ pid: 1, port: 99999, startedAt: "2026-07-17T09:00:00Z" })],
    ["invalid date", JSON.stringify({ pid: 1, port: 3000, startedAt: "yesterday-ish" })],
  ])("rejects %s", (_label, text) => {
    expect(parseStatePayload(text)).toBeNull();
  });
});

describe("stop decision — never kills unrelated processes", () => {
  it("does nothing without a recorded state", () => {
    expect(decideStopAction(null, () => true)).toEqual({ action: "not-running" });
  });

  it("only clears state when the recorded PID is no longer alive", () => {
    const state = { pid: 4242, port: 3000, startedAt: "2026-07-17T09:00:00Z" };
    expect(decideStopAction(state, () => false)).toEqual({ action: "clear-stale" });
  });

  it("kills exactly the recorded PID and nothing else", () => {
    const state = { pid: 4242, port: 3000, startedAt: "2026-07-17T09:00:00Z" };
    const checked: number[] = [];
    const decision = decideStopAction(state, (pid: number) => {
      checked.push(pid);
      return true;
    });
    expect(decision).toEqual({ action: "kill", pid: 4242 });
    expect(checked).toEqual([4242]); // only our own PID is ever inspected
  });
});

describe("port selection", () => {
  it("uses the preferred port when free", async () => {
    expect(await choosePort(3000, async () => true)).toBe(3000);
  });

  it("walks to the next free port on conflict", async () => {
    const busy = new Set([3000, 3001]);
    expect(await choosePort(3000, async (p: number) => !busy.has(p))).toBe(3002);
  });

  it("returns null when nothing in the range is free", async () => {
    expect(await choosePort(3000, async () => false, 5)).toBeNull();
  });
});

describe("setup idempotency", () => {
  it("seeds only a database that setup itself just created", () => {
    expect(decideSeed(false)).toBe(true); // fresh install → seed demo data
    expect(decideSeed(true)).toBe(false); // existing DB → never touch user data
  });
});
