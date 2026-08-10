import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 800,
      timeout: 15000,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
}

function waitForConnect(s, ms = 10000) {
  if (s.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Could not connect to server. Is the backend running on port 3000?"));
    }, ms);

    const onConnect = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timer);
      s.off("connect", onConnect);
    };

    s.on("connect", onConnect);
    if (!s.connected) s.connect();
  });
}

export async function emitWithAck(event, data, timeout = 15000) {
  const s = getSocket();
  await waitForConnect(s);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Request timed out. Check that the server is running and try again."));
    }, timeout);

    s.emit(event, data, (response) => {
      clearTimeout(timer);
      if (response && response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

export default { getSocket, connectSocket, disconnectSocket, emitWithAck };
