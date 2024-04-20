import { WebSocketServer, WebSocket, RawData } from "ws";

type Message =
  | { type: "subscribe"; topics: string[] }
  | { type: "unsubscribe"; topics: string[] }
  | { type: "publish"; topic: string }
  | { type: "ping" }
  | { type: "pong" };

function send(socket: WebSocket, message: Message) {
  try {
    socket.send(JSON.stringify(message));
  } catch (err) {
    socket.close();
  }
}

function parse(rawData: RawData) {
  try {
    return JSON.parse(String(rawData)) as Message;
  } catch (err) {
    return null;
  }
}

const topics = new Map<string, Set<WebSocket>>();

const webSocketServer = new WebSocketServer({
  port: parseInt(process.env.PORT || "5000", 10),
});

webSocketServer.on("connection", (socket) => {
  const subscriptions = new Set<string>();

  let isClosed = false;
  let isAlive = true;

  const pingInterval = setInterval(() => {
    if (!isAlive) {
      socket.close();
      clearInterval(pingInterval);
    } else {
      isAlive = false;

      try {
        socket.ping();
      } catch (err) {
        socket.close();
      }
    }
  }, 1000 * 30);

  socket.on("pong", () => {
    isAlive = true;
  });

  socket.on("close", () => {
    for (const topic of subscriptions) {
      const subscribers = topics.get(topic);

      if (subscribers) {
        subscribers.delete(socket);

        if (subscribers.size === 0) {
          topics.delete(topic);
        }
      }
    }
    subscriptions.clear();
    isClosed = true;
  });

  socket.on("message", (rawData) => {
    if (isClosed) {
      return;
    }

    const message = parse(rawData);

    if (!message) {
      return;
    }

    switch (message.type) {
      case "subscribe":
        for (const topic of message.topics) {
          const subscribers = topics.get(topic) ?? new Set<WebSocket>();
          topics.set(topic, subscribers);
          subscribers.add(socket);
          subscriptions.add(topic);
        }
        break;
      case "unsubscribe":
        for (const topicName of message.topics) {
          const subscribers = topics.get(topicName);
          if (subscribers) {
            subscribers.delete(socket);
          }
        }
        break;
      case "publish": {
        const receivers = topics.get(message.topic);
        if (receivers) {
          for (const receiver of receivers) {
            send(receiver, message);
          }
        }
        break;
      }
      case "ping":
        send(socket, { type: "pong" });
        break;
    }
  });
});
