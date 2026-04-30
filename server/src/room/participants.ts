import type { Participant } from "../../../shared/protocol.js";

export class ParticipantSet {
  private byUser = new Map<string, { participant: Participant; sockets: Set<object> }>();
  private socketToUser = new Map<object, string>();

  addSocket(socket: object, participant: Participant): void {
    const existing = this.byUser.get(participant.id);
    if (existing) {
      existing.sockets.add(socket);
    } else {
      this.byUser.set(participant.id, { participant, sockets: new Set([socket]) });
    }
    this.socketToUser.set(socket, participant.id);
  }

  removeSocket(socket: object): void {
    const userId = this.socketToUser.get(socket);
    if (!userId) return;
    this.socketToUser.delete(socket);
    const entry = this.byUser.get(userId);
    if (!entry) return;
    entry.sockets.delete(socket);
    if (entry.sockets.size === 0) {
      this.byUser.delete(userId);
    }
  }

  list(): Participant[] {
    return [...this.byUser.values()].map((e) => e.participant);
  }

  count(): number {
    return this.byUser.size;
  }

  hasUser(userId: string): boolean {
    return this.byUser.has(userId);
  }

  socketsForUser(userId: string): object[] {
    const entry = this.byUser.get(userId);
    return entry ? [...entry.sockets] : [];
  }
}
