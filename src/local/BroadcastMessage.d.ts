export interface BroadcastMessage {
    type: 'error' | 'update' | 'subscribed';
    result: any;
}
