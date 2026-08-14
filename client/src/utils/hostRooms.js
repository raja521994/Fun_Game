const STORAGE_KEY = 'fungame_host_rooms';

export function loadHostRooms() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveHostRooms(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function upsertHostRoom(room) {
  const list = loadHostRooms().filter((r) => r.hostToken !== room.hostToken);
  const entry = {
    hostToken: room.hostToken,
    roomCode: room.roomCode,
    roomId: room.roomId || room.id || null,
    title: room.title || 'Fun Game Session',
    status: room.status || 'waiting',
    createdAt: room.createdAt || new Date().toISOString(),
  };
  list.unshift(entry);
  saveHostRooms(list);
  return entry;
}

export function updateHostRoom(hostToken, patch) {
  const list = loadHostRooms().map((r) =>
    r.hostToken === hostToken ? { ...r, ...patch } : r
  );
  saveHostRooms(list);
  return list;
}

export function removeHostRoom(hostToken) {
  const list = loadHostRooms().filter((r) => r.hostToken !== hostToken);
  saveHostRooms(list);
  return list;
}
