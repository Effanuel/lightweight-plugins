// WebSocket worker for MEXC real-time data
let ws: WebSocket | null = null;
let currentSymbol: string | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

interface MexcTradeMessage {
  M: number;
  O: number;
  T: number;
  p: number; // price
  t: number;
  v: number;
}

function connectWebSocket(symbol: string) {
  if (ws) {
    ws.close();
    clearTimeouts();
  }

  currentSymbol = symbol;

  try {
    ws = new WebSocket("wss://contract.mexc.com/edge");

    ws.onopen = () => {
      console.log("WebSocket connected");

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ method: "sub.deal", param: { symbol: symbol } }));
        setupHeartbeat();
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { channel: string; symbol: string; data: MexcTradeMessage };

        switch (data.channel) {
          case "push.deal":
            self.postMessage({
              type: "trade",
              data: { symbol: data.symbol, price: data.data.p, timestamp: data.data.t / 1000 },
            });
            break;
          case "rs.sub.deal":
            self.postMessage({ type: "connected" });
            break;
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      reconnect();
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      reconnect();
    };
  } catch (err) {
    console.error("Error creating WebSocket:", err);
    reconnect();
  }
}

// Setup heartbeat to keep connection alive
function setupHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const pingMsg = { method: "ping", param: {} };
      ws.send(JSON.stringify(pingMsg));
    }
  }, 30000); // Send ping every 30 seconds
}

// Reconnect logic with exponential backoff
function reconnect() {
  if (!currentSymbol) return;

  clearTimeouts();

  const backoffTime = Math.floor(Math.random() * 10000) + 5000; // 5-15 seconds
  console.log(`Reconnecting in ${backoffTime / 1000} seconds...`);

  reconnectTimeout = setTimeout(() => {
    if (currentSymbol) {
      connectWebSocket(currentSymbol);
    }
  }, backoffTime);
}

// Clear all timeouts and intervals
function clearTimeouts() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Listen for messages from the main thread
self.addEventListener("message", (event) => {
  const { type, symbol } = event.data;

  if (type === "connect" && symbol) {
    connectWebSocket(symbol);
  } else if (type === "disconnect") {
    if (ws) {
      ws.close();
      clearTimeouts();
    }
  } else if (type === "changeSymbol" && symbol) {
    connectWebSocket(symbol);
  }
});

// Make TypeScript happy with the 'self' context
export {};
