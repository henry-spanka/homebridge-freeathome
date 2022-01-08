import axios, { Axios } from "axios"
import compareVersions from "compare-versions"
import FatHAPI from "freeathome-api"
import { SystemAccessPointSettings, SystemAccessPointUser } from "freeathome-api/dist/lib/SystemAccessPointSettings"
import { ClientConfiguration } from "freeathome-api/dist/lib/Configuration"
import { Subscriber } from "freeathome-api/dist/lib/Subscriber"
import { Logger, ConsoleLogger } from "freeathome-api/dist/lib/Logger"
import { General, Message, Result } from "freeathome-api/dist/lib/constants"
import { GuardedClient } from './GuardedClient'
import { MessageBuilder } from './MessageBuilder'

const https = require('https');

export class SystemAccessPoint {
    private configuration: ClientConfiguration
    private readonly subscriber: Subscriber
    private client: GuardedClient | undefined
    private messageBuilder: MessageBuilder | undefined
    private crypto: Crypto | undefined
    private online: boolean = false
    private settings: SystemAccessPointSettings | undefined
    private connectedAs: string | undefined
    private user: SystemAccessPointUser | undefined
    private keepAliveMessageId: number = 1
    private pingTimeoutSeconds: number = 10000
    private keepAliveTimer: NodeJS.Timeout | null = null
    private pingTimeout: NodeJS.Timeout | null = null
    private deviceData: any = {}
    private subscribed: boolean = false
    private axios: Axios
    private logger: Logger = new ConsoleLogger()

    /**
     * protocols, we need some smarter way in the future (enableTLS: true in config)
     */
    private readonly _protocol1 = 'wss://'
    private readonly _protocol2 = 'https://'
    
    /**
     * ports will be set automagically (hopefully)
     */
    private _port = ''

    /**
     * the API entry path
     */
    private readonly _path2api = '/fhapi/v1/api'

    /**
     * default UUID - we will read the "real" uuid from config.json
     */
    private _uuid = '00000000-0000-0000-0000-000000000000'

    /**
     * minimal version to use the local API
    */
    private readonly _minversionAP = '2.6.0'

    constructor(configuration: ClientConfiguration, subscriber: Subscriber, logger: Logger | null) {
        this.configuration = configuration
        this.subscriber = subscriber
        if (logger !== undefined && logger !== null) {
            this.logger = logger
        }
        // ignore self signed certs at instance level
        this.axios = axios.create({
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });
    }

    private async createClient() {
        this.settings = await this.getSettings()

        let user: SystemAccessPointUser | undefined

        for (let tempUser of this.settings.users) {
            if (tempUser.name == this.configuration.username) {
                user = tempUser
                break
            }
        }

        if (user === undefined) {
            this.logger.error('The user does not exist in the System Access Point\'s configuration')
            throw new Error(`User ${this.configuration.username} does not exist`)
        }

        this.user = user

        let username = user!.jid.split('@')[0]

        /**
         * private readonly _protocol1 = 'wss://'
         * private _port = ''
         * private readonly _path2api = '/fhapi/v1/api'
         */
        this.client = new GuardedClient(this.subscriber, {
            service: this._protocol1 + this.configuration.hostname +  ((this._port!='')?':' + this._port:'') + this._path2api + '/ws',
            from: this.configuration.hostname,
            resource: 'freeathome-api',
            username: username,
            password: this.configuration.password
        }, this.logger)

        this.messageBuilder = new MessageBuilder(username)
        this.registerHandlers()
    }

    private async getSettings(): Promise<SystemAccessPointSettings> {
        let response = await this.axios.get(this._protocol2 + this.configuration.hostname + '/settings.json')

        if (response.status != 200) {
            this.logger.error("Unexpected status code from System Access Point while retrieving settings.json.")
            throw new Error("Unexpected status code from System Access Point while retrieving settings.json.")
        }

        if (!('flags' in response.data) || !('version' in response.data.flags)) {
            this.logger.error("Flags key does not exist in settings.json.")
            throw new Error("Flags key does not exist in settings.json.")
        }

        if (!('users' in response.data || !Array.isArray(response.data.users))) {
            this.logger.error("Users key does not exist in settings.json.")
            throw new Error("Users key does not exist in settings.json.")
        }

        return <SystemAccessPointSettings>response.data
    }

    private async getDeviceConfiguration(): Promise<any> {
        let _restpath = '/rest/configuration'
        let bwaToken = this.client!.getBWAToken()
        try {
            let response = await this.axios.get(this._protocol2 + this.configuration.hostname + this._path2api + _restpath, {
                headers: { 'Authorization': 'Basic ' + bwaToken }
            })

            if (response.status != 200) {
                this.logger.error("Unexpected status code from System Access Point while retrieving " + _restpath)
                throw new Error("Unexpected status code from System Access Point while retrieving " + _restpath)
            }


            /**
             * retrieving the uuid from device config
             */
            this._uuid = Object.keys(response.data)[0] ?? this._uuid
            this.deviceData = response.data[this._uuid]?.devices

            this.subscriber.broadcastMessage({ result: response.data, type: 'subscribed' })
            return response.data
        }
        catch (e) {
            this.logger.error("Unexpected status code from System Access Point while retrieving " + _restpath)
            return null
        }

    }

    /**
     *      
     *     onopen: (event: WebSocket.OpenEvent) => void;
     *     onerror: (event: WebSocket.ErrorEvent) => void;
     *     onclose: (event: WebSocket.CloseEvent) => void;
     *     onmessage: (event: WebSocket.MessageEvent) => void;
     */
    private registerHandlers() {
        if (this.client === undefined) {
            throw new Error("Unknown error occurred! this.client undefined.")
        }

        this.client.on('error', err => {
            this.logger.error(err.toString())
            this.subscriber.broadcastMessage({
                type: "error",
                result: err
            })
        })

        this.client.on('close', () => {
            this.logger.log('Access Point has gone offline')
            this.online = false
            this.subscribed = false
            this.subscriber.broadcastMessage({
                'type': 'subscribed',
                'result': false
            })
            this.disableKeepAliveMessages()
        })

        this.client.guardedOn('message', async stanza => {
            this.logger.debug('Received stanza:', JSON.parse(stanza))
            let astanza = JSON.parse(stanza)[this._uuid] ?? null
            this.heartBeat()
            if (astanza.datapoints) {
                this.handleEvent(astanza)
            }
        })

        this.client.on('open', async address => {
            let connectedAs = 'Local API Websocket'
            this.logger.log("Connected as " + connectedAs)
            this.connectedAs = connectedAs

            this.logger.log("Retrieving configuration...")
            let deviceData = this.getDeviceConfiguration()

        })

        this.client.on('ping', ping => {
            this.heartBeat()
            this.logger.debug('WS Ping:', ping)
        })

        // Debug
        this.client.on('status', status => {
            this.logger.debug('Received new status:', status)
        })
        this.client.on('input', input => {
            this.logger.debug('Received new input data:', input)
        })
        this.client.on('output', output => {
            this.logger.debug('Received new output data:', output)
        })

    }

    /**
     * heartbeat to detect if WS still send messages od my be death
     */
    private async heartBeat() {
        if(this.pingTimeout){
            clearTimeout(this.pingTimeout);
        }
        let self = this;
        this.logger.debug("*** heartBeat " + this.pingTimeoutSeconds);
        // Use `WebSocket#terminate()`, which immediately destroys the connection,
        // instead of `WebSocket#close()`, which waits for the close timer.
        // Delay should be equal to the interval at which your server
        // sends out pings plus a conservative assumption of the latency.
        this.pingTimeout = setTimeout(() => {
            //self.disconnect()
        }, this.pingTimeoutSeconds);
    }



    private handleEvent(stanza: any) {
        this.logger.debug("handleEvent: ");
        this.logger.debug(JSON.stringify(stanza));
        for (const [key, value] of Object.entries(stanza.datapoints)) {
            if (key) {
                let telegram = key + '/' + value
                //this.logger.log('* ' + telegram)
                this.applyIncrementalUpdate(telegram.split('/'));
            }
        }

    }

    private unwrapEventData(item: Element): string {

        return "";
    }

    private async sendMessage(message: any, value: string) {
        // await this.client!.send(message)
        let bwaToken = this.client!.getBWAToken()
        try {
            let response = await this.axios.put(this._protocol2 + this.configuration.hostname + this._path2api + '/rest/datapoint/' + this._uuid + '/' + message,
                value,
                {
                    headers: { 'Authorization': 'Basic ' + bwaToken }
                })

            if (response.status != 200) {
                this.logger.error("Unexpected status code from System Access Point while PUT ")
                throw new Error("Unexpected status code from System Access Point while PUT ")
            }
        }
        catch (e) {
            this.logger.error("Unexpected status code from System Access Point while PUT ");

        }
    }

    /**
     * create and connect WS client
     */
    async connect() {

        await this.createClient()

        if (compareVersions(this.settings!.flags.version, this._minversionAP) < 0) {
            throw Error('Your System Access Point\'s firmware must be at least ' + this._minversionAP);
        }

        try {
            await this.client!.start()
            //this.sendKeepAliveMessages()
            this.heartBeat()
        } catch (e: any) {
            this.logger.error('Could not connect to System Access Point', e.toString())
            throw Error("Could not connect to System Access Point")
        }
    }

    async disconnect() {
        this.logger.log("Disconnecting from the System Access Point...");
        await this.client!.stop()
    }

    private async sendKeepAliveMessage() {
        //await this.sendMessage(this.keepAliveMessageId++)
    }

    private sendKeepAliveMessages() {
        this.keepAliveTimer = setInterval(() => this.sendKeepAliveMessage(), 15000)
    }

    private disableKeepAliveMessages() {
        if (this.keepAliveTimer !== null) {
            clearInterval(this.keepAliveTimer)
            this.keepAliveTimer = null
        }
    }

    private applyIncrementalUpdate(update: any) {
        if (update == null || !(update instanceof Object)) {
            throw new Error("Invalid Incremental Update")
        }
        let upd = Array()

        if (update.length == 4) {
            const serialNo = update[0]
            const channelNo = update[1]
            const datapointNo = update[2]
            const value = update[3]
            upd[serialNo] = Array();

            if (!(serialNo in this.deviceData)) {
                this.deviceData[serialNo] = {
                    serialNumber: serialNo,
                    channels: {}
                }
            } else {
                upd[serialNo]['deviceId'] = this.deviceData[serialNo]['deviceId']
                upd[serialNo]['typeName'] = this.deviceData[serialNo]['typeName']
            }

            if (channelNo != null) {

                if (!(channelNo in this.deviceData[serialNo]['channels'])) {
                    this.deviceData[serialNo]['channels'][channelNo] = {
                        datapoints: {}
                    }
                }

                if (datapointNo != null) {
                    if (this.deviceData[serialNo]['channels'][channelNo]['datapoints'] != null) {
                        // remote API can be removed here
                        this.deviceData[serialNo]['channels'][channelNo]['datapoints'][datapointNo] = value
                    } else {
                        let channelKey = ''
                        if (this.deviceData[serialNo]['channels'][channelNo]['outputs'][datapointNo] != null) {
                            channelKey = 'outputs'
                        }else 
                        if (this.deviceData[serialNo]['channels'][channelNo]['inputs'][datapointNo] != null) {
                            channelKey = 'inputs'
                        }
                        // local API inputs & outputs - datapointNo csn oeitherr be in inputs or outputs
                        upd[serialNo]['channels'] = []
                        upd[serialNo]['channels'][channelNo] = []
                        upd[serialNo]['channels'][channelNo][channelKey] = []
                        upd[serialNo]['channels'][channelNo][channelKey][datapointNo] = this.deviceData[serialNo]['channels'][channelNo][channelKey][datapointNo]
                        upd[serialNo]['channels'][channelNo][channelKey][datapointNo].value = value

                    } 
                   
                    // we need this in BuschJaegerApPlatform.prototype.processUpdate = function(actuators)
                    upd[serialNo]['serial'] = serialNo
                    this.logger.debug("Updated Datapoint: " + serialNo + '/' + channelNo + '/' + datapointNo + '/' + value)
                }
                this.subscriber.broadcastMessage({ result: upd, type: 'update' })

            }

        }


    }

    async setDatapoint(serialNo: string, channel: string, datapoint: string, value: string) {
        await this.sendMessage(this.messageBuilder!.buildSetDatapointMessage(serialNo, channel, datapoint, value), value)

        this.logger.log("Set Datapoint: " + serialNo + '/' + channel + '/' + datapoint + '/' + value)
    }

    getDeviceData(): any {
        if (Object.entries(this.deviceData).length === 0 && this.deviceData.constructor === Object) {
            throw new Error("Device Data was requested before we have initialized it")
        }

        return this.deviceData
    }
}
