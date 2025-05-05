// WebSocket worker for MEXC real-time data
let ws: WebSocket | null = null;
let currentSymbol: string | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let subscribingSymbol: string | null = null;

interface MexcTradeMessage {
  M: number;
  O: number;
  T: number;
  p: number; // price
  t: number;
  v: number;
}

function changeSymbol(symbol: string) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    if (currentSymbol) {
      ws.send(JSON.stringify({ method: "unsub.deal", param: { symbol: currentSymbol } }));
      currentSymbol = null;
    }

    // Send subscribing status before actual subscription
    self.postMessage({ type: "subscribing", symbol });
    subscribingSymbol = symbol;
    ws.send(JSON.stringify({ method: "sub.deal", param: { symbol: symbol } }));
  }
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
        // Send subscribing status before actual subscription
        self.postMessage({ type: "subscribing", symbol });
        ws.send(JSON.stringify({ method: "sub.deal", param: { symbol: symbol } }));
        setupHeartbeat();
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { channel: string; symbol: string; data: MexcTradeMessage };

        switch (data.channel) {
          case "push.deal": {
            self.postMessage({
              type: "trade",
              data: { symbol: data.symbol, price: data.data.p, timestamp: data.data.t / 1000 },
            });
            break;
          }
          case "rs.sub.deal":
            // Send subscribed event when subscription is confirmed
            self.postMessage({ type: "subscribed", symbol: data.symbol });
            currentSymbol = subscribingSymbol;
            // Keep the connected event for backward compatibility
            self.postMessage({ type: "connected", symbol: data.symbol });
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
      self.postMessage({ type: "disconnected", symbol: currentSymbol });
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
  }, 20_000); // Send ping every 20 seconds
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

self.addEventListener("message", (event) => {
  const { type, symbol } = event.data;

  switch (type) {
    case "connect":
      if (symbol) connectWebSocket(symbol);
      break;
    case "changeSymbol":
      if (symbol) changeSymbol(symbol);
      break;
    case "disconnect":
      if (ws) {
        self.postMessage({ type: "disconnected", symbol: currentSymbol });
        ws.close();
        clearTimeouts();
      }
      break;
  }
});

// Make TypeScript happy with the 'self' context
export {};
