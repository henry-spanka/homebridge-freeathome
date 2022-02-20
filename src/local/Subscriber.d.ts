import { BroadcastMessage } from "./BroadcastMessage";
export interface Subscriber {
    broadcastMessage(message: BroadcastMessage): void;
    getConfig(): [];
}
