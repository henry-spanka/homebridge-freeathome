import WebSocket from "ws";
import { Logger, ConsoleLogger } from "freeathome-api/dist/lib/Logger"
import { Subscriber } from "freeathome-api/dist/lib/Subscriber"


export class GuardedClient {
    private logger: Logger = new ConsoleLogger();
    private errorSubscriber: Subscriber;
    private client: WebSocket;
    private _bwaToken: String = "";

    constructor(errorSubscriber: Subscriber, options?: any, logger?: Logger) {
       
        this._bwaToken = Buffer.from(options['username'] + ':' + options['password']).toString('base64')
        this.client = new WebSocket(options['service'], {
            protocolVersion: 13,
            //origin: options['from'],
            rejectUnauthorized: false,
            headers: {
                "Authorization": "Basic " + this._bwaToken
            }
        })
        this.errorSubscriber = errorSubscriber
        if (logger !== undefined && logger !== null) {
            this.logger = logger
        }
    }


    /**
     * 
     * @returns The BWA auth token for ws: and http(s):// authentification
     */
    public getBWAToken(): String {
        return this._bwaToken
    }


    on(event: string, fn: (a: any) => any): void {
        this.client.on(event, fn)
    }

    /**
     * Extend on-event method to guard execution and expose errors through broadcast messages.
     * @param event
     * @param fn
     */
    guardedOn(event: string, fn: (a: any) => any): void {
        const guardedFn = async (a: any) => {
            try {
                await fn(a)
            } catch (err: any) {
                this.logger.error(`Unexpected error while processing ${event} event`, err)
                this.broadCastError(err);
            }
        }

        this.client.on(event, guardedFn)
    }

    send(stanza: any): Promise<any> {
        //return new Promise (executor: this.client.send(stanza))

        return new Promise<void>((resolve, reject) => {
            if (true) {
                this.client.send(stanza)
                resolve()
            } else {
                resolve()
            }
        })
    }

    start(): Promise<any> {

        return new Promise<void>((resolve, reject) => {
            if (this.client.readyState === WebSocket.OPEN) {
                resolve()
            } else {
                resolve()
            }
        })
    }

    stop(): Promise<any> {

        return new Promise<void>((resolve, reject) => {
            if (this.client.readyState === WebSocket.OPEN) {
                this.client.terminate()
                resolve()
            } else {
                resolve()
            }
        })
    }

    private broadCastError(err: Error) {
        this.errorSubscriber.broadcastMessage({
            type: "error",
            result: {
                message: err.message,
                error: err
            }
        }
        )
    }
}