export type Message = {
  id: number;
  user: string;
  body: string;
  ts: string;
  clientId?: string;
  // client-only:
  pending?: boolean;
  failed?: boolean;
};

export type ServerEvent =
  | { type: "message"; id: number; user: string; body: string; ts: string; clientId?: string }
  | { type: "ack"; id: number; clientId: string }
  | { type: "presence"; online: string[] }
  | { type: "typing"; user: string }
  | { type: "typing_stop"; user: string };

export type SendPayload =
  | { type: "message"; body: string; clientId: string }
  | { type: "typing" };
