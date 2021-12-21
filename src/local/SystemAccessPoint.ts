import Axios from "axios"
import compareVersions from "compare-versions"
import FatHAPI from "freeathome-api"
import { SystemAccessPointSettings, SystemAccessPointUser } from "freeathome-api/dist/lib/SystemAccessPointSettings"
import { ClientConfiguration } from "freeathome-api/dist/lib/Configuration"
import { Subscriber } from "freeathome-api/dist/lib/Subscriber"
import { Logger, ConsoleLogger } from "freeathome-api/dist/lib/Logger"
import { General, Message, Result } from "freeathome-api/dist/lib/constants"
import { GuardedClient } from './GuardedClient'
import { MessageBuilder } from './MessageBuilder'
/*
export { SystemAccessPoint } from './lib/SystemAccessPoint';
export { ClientConfiguration } from './lib/Configuration';
export { ConsoleLogger, Logger } from './lib/Logger';

http://192.168.9.40/fhapi/v1/api/ws

*/

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
    private keepAliveTimer: NodeJS.Timeout | null = null
    private deviceData: any = {}
    private subscribed: boolean = false

    private logger: Logger = new ConsoleLogger()

    private readonly _protocol1 = 'ws://'
    private readonly _protocol2 = 'http://'
    private readonly _port = '80'
    private readonly _path2api = '/fhapi/v1/api'
    private readonly _uuid = '00000000-0000-0000-0000-000000000000'


    constructor(configuration: ClientConfiguration, subscriber: Subscriber, logger: Logger | null) {
        this.configuration = configuration
        this.subscriber = subscriber
        if (logger !== undefined && logger !== null) {
            this.logger = logger
        }
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
         * private readonly _protocol = 'ws://'
         * private readonly _port = '80'
         * private readonly _path2api = '/fhapi/v1/api'
         */
        this.client = new GuardedClient(this.subscriber, {
            service: this._protocol1 + this.configuration.hostname + ':' + this._port + this._path2api + '/ws',//':5280/xmpp-websocket',
            from: this.configuration.hostname,
            resource: 'freeathome-api',
            username: username,
            password: this.configuration.password
        }, this.logger)



        //this.crypto = new Crypto(user!, this.configuration.password)

        this.messageBuilder = new MessageBuilder(username)

        this.registerHandlers()
    }

    private async getSettings(): Promise<SystemAccessPointSettings> {
        let response = await Axios.get(this._protocol2 + this.configuration.hostname + '/settings.json')

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
            let response = await Axios.get(this._protocol2 + this.configuration.hostname + this._path2api + _restpath, {
                headers: { 'Authorization': 'Basic ' + bwaToken }
            })

            if (response.status != 200) {
                this.logger.error("Unexpected status code from System Access Point while retrieving " + _restpath)
                throw new Error("Unexpected status code from System Access Point while retrieving " + _restpath)
            }


            /**
             * mapping outputs AND inputs to datapints to match the Cloud Data structure
             */
            this.deviceData = response.data[this._uuid]?.devices
            /*
            for (let serial in this.deviceData) {
                for (let channel in this.deviceData[serial]['channels']) {
                    let channels = this.deviceData[serial]['channels'][channel];
                    for (let outputs in channels['outputs']) {
                        this.deviceData[serial]['channels'][channel] = { 'datapoints': outputs };
                    }
                    for (let inputs in channels['inputs']) {
                        this.deviceData[serial]['channels'][channel] = { 'datapoints': inputs };
                    }
                }
            }*/

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
            this.logger.debug('Received stanza:', stanza)
            let astanza = JSON.parse(stanza)[this._uuid] ?? null
            if (astanza.datapoints) {
                this.handleEvent(astanza)
            }
        })

        this.client.on('open', async address => {
            let connectedAs = 'ws'
            this.logger.log("Connected as " + connectedAs)
            this.connectedAs = connectedAs

            //let key = this.crypto!.generateLocalKey()

            //await this.sendMessage(this.messageBuilder!.buildCryptExchangeLocalKeysMessage(Crypto.uint8_to_base64(key)))
            this.logger.log("Retrieve configuration")
            let deviceData = this.getDeviceConfiguration()

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
            let response = await Axios.put(this._protocol2 + this.configuration.hostname + this._path2api + '/rest/datapoint/' + this._uuid + '/' + message,
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

    async connect() {
        await this.createClient()
        //await this.crypto!.ready()
        //this.crypto!.generateKeypair()

        if (compareVersions(this.settings!.flags.version, '2.3.1') < 0) {
            throw Error('Your System Access Point\'s firmware must be at least 2.3.1');
        }

        try {
            await this.client!.start()
            this.sendKeepAliveMessages()
        } catch (e: any) {
            this.logger.error('Could not connect to System Access Point', e.toString())
            throw Error("Could not connect to System Access Point")
        }
    }

    async disconnect() {
        this.logger.log("Disconnecting from the System Access Point");
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
            //this.logger.log("##### applyIncrementalUpdate: " + serialNo + '/' + channelNo + '/' + datapointNo + '/' + value)
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
                        // remote API
                        this.deviceData[serialNo]['channels'][channelNo]['datapoints'][datapointNo] = value
                    } else if (this.deviceData[serialNo]['channels'][channelNo]['outputs'][datapointNo] != null) {
                        // local API outputs
                        // this.deviceData[serialNo]['channels'][channelNo]['outputs'][datapointNo].value = value
                        upd[serialNo]['channels'] = []
                        upd[serialNo]['channels'][channelNo] = []
                        upd[serialNo]['channels'][channelNo]['outputs'] = []
                        upd[serialNo]['channels'][channelNo]['outputs'][datapointNo] = this.deviceData[serialNo]['channels'][channelNo]['outputs'][datapointNo]
                        upd[serialNo]['channels'][channelNo]['outputs'][datapointNo].value = value

                    } else if (this.deviceData[serialNo]['channels'][channelNo]['inputs'][datapointNo] != null) {
                        // local API inputs
                        // this.deviceData[serialNo]['channels'][channelNo]['inputs'][datapointNo].value = value
                        upd[serialNo]['channels'] = []
                        upd[serialNo]['channels'][channelNo] = []
                        upd[serialNo]['channels'][channelNo]['inputs'] = []
                        upd[serialNo]['channels'][channelNo]['inputs'][datapointNo] = this.deviceData[serialNo]['channels'][channelNo]['inputs'][datapointNo]
                        upd[serialNo]['channels'][channelNo]['inputs'][datapointNo].value = value

                    }
                    // upd[serialNo] = this.deviceData[serialNo]
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
