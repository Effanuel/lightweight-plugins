declare module "*.worker.ts" {
  const workerConstructor: new () => Worker;
  export default workerConstructor;
}

declare module "*/mexcWebsocket.worker.ts" {
  class WebSocketWorker extends Worker {
    constructor();
  }
  export default WebSocketWorker;
}
