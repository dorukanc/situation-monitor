export interface FlowSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
}

export const FLOW_SESSION_STORAGE_KEY = "sm-flow-sessions";
export const FLOW_SESSION_HEARTBEAT_KEY = "sm-flow-session-heartbeat";
export const FLOW_SESSION_CHANGE_EVENT = "sm-flow-sessions-change";
export const FLOW_SESSION_HEARTBEAT_MS = 15_000;
export const FLOW_SESSION_STALE_MS = 90_000;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isValidDate(value: string) {
  return Number.isFinite(new Date(value).getTime());
}

function sanitizeSession(value: unknown): FlowSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const session = value as Partial<FlowSession>;

  if (
    typeof session.id !== "string" ||
    typeof session.startedAt !== "string" ||
    !isValidDate(session.startedAt)
  ) {
    return null;
  }

  if (
    session.endedAt !== null &&
    typeof session.endedAt !== "undefined" &&
    (typeof session.endedAt !== "string" || !isValidDate(session.endedAt))
  ) {
    return null;
  }

  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? null,
    durationSeconds:
      typeof session.durationSeconds === "number" && Number.isFinite(session.durationSeconds)
        ? Math.max(0, Math.floor(session.durationSeconds))
        : 0,
  };
}

function emitFlowSessionChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(FLOW_SESSION_CHANGE_EVENT));
}

function writeFlowSessions(sessions: FlowSession[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(FLOW_SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

function readFlowHeartbeat() {
  if (!canUseStorage()) {
    return null;
  }

  const value = window.localStorage.getItem(FLOW_SESSION_HEARTBEAT_KEY);
  return value && isValidDate(value) ? value : null;
}

function writeFlowHeartbeat(value: string | null) {
  if (!canUseStorage()) {
    return;
  }

  if (value) {
    window.localStorage.setItem(FLOW_SESSION_HEARTBEAT_KEY, value);
    return;
  }

  window.localStorage.removeItem(FLOW_SESSION_HEARTBEAT_KEY);
}

function closeSession(session: FlowSession, endedAt: string): FlowSession {
  const startMs = new Date(session.startedAt).getTime();
  const endMs = Math.max(startMs, new Date(endedAt).getTime());

  return {
    ...session,
    endedAt: new Date(endMs).toISOString(),
    durationSeconds: Math.floor((endMs - startMs) / 1000),
  };
}

function createSession(now: Date): FlowSession {
  return {
    id: `${now.getTime()}`,
    startedAt: now.toISOString(),
    endedAt: null,
    durationSeconds: 0,
  };
}

export function readFlowSessions(): FlowSession[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(FLOW_SESSION_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => sanitizeSession(entry))
      .filter((entry): entry is FlowSession => entry !== null);
  } catch {
    return [];
  }
}

export function getActiveFlowSession(sessions = readFlowSessions()) {
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    if (sessions[index].endedAt === null) {
      return sessions[index];
    }
  }

  return null;
}

export function getFlowSessionDurationSeconds(session: FlowSession, now = Date.now()) {
  const startMs = new Date(session.startedAt).getTime();
  const endMs = session.endedAt ? new Date(session.endedAt).getTime() : now;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

export function getFlowSessionDurationInRange(
  session: FlowSession,
  rangeStartMs: number,
  rangeEndMs: number,
  now = Date.now()
) {
  const startMs = new Date(session.startedAt).getTime();
  const endMs = session.endedAt ? new Date(session.endedAt).getTime() : now;
  const overlap = Math.min(endMs, rangeEndMs) - Math.max(startMs, rangeStartMs);
  return Math.max(0, Math.floor(overlap / 1000));
}

export function startFlowSession(now = new Date()) {
  return syncFlowSessionState(true, now).activeSession;
}

export function stopFlowSession(now = new Date()) {
  return syncFlowSessionState(false, now).activeSession;
}

export function touchFlowSessionHeartbeat(now = new Date()) {
  const activeSession = getActiveFlowSession(readFlowSessions());
  if (!activeSession) {
    return null;
  }

  writeFlowHeartbeat(now.toISOString());
  return activeSession;
}

export function syncFlowSessionState(enabled: boolean, now = new Date()) {
  if (!canUseStorage()) {
    return {
      sessions: [] as FlowSession[],
      activeSession: null as FlowSession | null,
    };
  }

  let sessions = readFlowSessions();
  let activeSession = getActiveFlowSession(sessions);
  const heartbeat = readFlowHeartbeat();
  const heartbeatMs = heartbeat ? new Date(heartbeat).getTime() : null;
  const nowMs = now.getTime();
  let changed = false;

  if (activeSession) {
    const stale = heartbeatMs !== null && nowMs - heartbeatMs > FLOW_SESSION_STALE_MS;

    if (!enabled || stale) {
      const endTime = stale && heartbeatMs !== null
        ? new Date(Math.max(new Date(activeSession.startedAt).getTime(), heartbeatMs))
        : now;

      sessions = sessions.map((session) =>
        session.id === activeSession?.id ? closeSession(session, endTime.toISOString()) : session
      );
      activeSession = null;
      changed = true;
    }

    if (enabled && stale) {
      activeSession = createSession(now);
      sessions = [...sessions, activeSession];
      changed = true;
    }
  } else if (enabled) {
    activeSession = createSession(now);
    sessions = [...sessions, activeSession];
    changed = true;
  }

  if (enabled && activeSession) {
    writeFlowHeartbeat(now.toISOString());
  } else {
    writeFlowHeartbeat(null);
  }

  if (changed) {
    writeFlowSessions(sessions);
    emitFlowSessionChange();
  }

  return { sessions, activeSession };
}
