import { describe, it, expect } from "vitest";
import { ParticipantSet } from "../../src/room/participants.js";

const alice = { id: "u-alice", name: "Alice", picture: "a.jpg" };
const bob = { id: "u-bob", name: "Bob", picture: "b.jpg" };

describe("ParticipantSet", () => {
  it("starts empty", () => {
    const s = new ParticipantSet();
    expect(s.list()).toEqual([]);
    expect(s.count()).toBe(0);
  });

  it("addSocket inserts a new participant on first socket", () => {
    const s = new ParticipantSet();
    const sockA = {} as object;
    s.addSocket(sockA, alice);
    expect(s.count()).toBe(1);
    expect(s.list()).toEqual([alice]);
  });

  it("addSocket twice for same user keeps the participant once", () => {
    const s = new ParticipantSet();
    const sockA = {} as object;
    const sockB = {} as object;
    s.addSocket(sockA, alice);
    s.addSocket(sockB, alice);
    expect(s.count()).toBe(1);
  });

  it("removeSocket only drops participant when last socket closes", () => {
    const s = new ParticipantSet();
    const sockA = {} as object;
    const sockB = {} as object;
    s.addSocket(sockA, alice);
    s.addSocket(sockB, alice);
    s.removeSocket(sockA);
    expect(s.count()).toBe(1);
    s.removeSocket(sockB);
    expect(s.count()).toBe(0);
  });

  it("removeSocket of unknown socket is a no-op", () => {
    const s = new ParticipantSet();
    const sockX = {} as object;
    expect(() => s.removeSocket(sockX)).not.toThrow();
  });

  it("two distinct users coexist", () => {
    const s = new ParticipantSet();
    s.addSocket({} as object, alice);
    s.addSocket({} as object, bob);
    expect(s.count()).toBe(2);
    expect(s.list().map((p) => p.id).sort()).toEqual(["u-alice", "u-bob"]);
  });

  it("hasUser returns true while any socket for that user is present", () => {
    const s = new ParticipantSet();
    const sockA = {} as object;
    s.addSocket(sockA, alice);
    expect(s.hasUser("u-alice")).toBe(true);
    s.removeSocket(sockA);
    expect(s.hasUser("u-alice")).toBe(false);
  });

  it("socketsForUser returns all sockets bound to a user", () => {
    const s = new ParticipantSet();
    const sockA = {} as object;
    const sockB = {} as object;
    s.addSocket(sockA, alice);
    s.addSocket(sockB, alice);
    const sockets = s.socketsForUser("u-alice");
    expect(sockets).toContain(sockA);
    expect(sockets).toContain(sockB);
    expect(sockets.length).toBe(2);
  });
});
