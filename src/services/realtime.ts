export interface RealtimeMessage {
  type: string;
  data: unknown;
}

/**
 * Single WebSocket connection to the backend /ws hub with automatic
 * reconnection. Returns a disconnect function.
 */
export function connectRealtime(onMessage: (msg: RealtimeMessage) => void): () => void {
  let socket: WebSocket | null = null;
  let closed = false;
  let retry = 0;

  const connect = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${location.host}/ws`);

    socket.onopen = () => {
      retry = 0;
    };
    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(String(event.data)) as RealtimeMessage);
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onclose = () => {
      if (!closed) {
        retry = Math.min(retry + 1, 10);
        setTimeout(connect, retry * 1000);
      }
    };
    socket.onerror = () => {
      socket?.close();
    };
  };

  connect();

  return () => {
    closed = true;
    socket?.close();
  };
}
