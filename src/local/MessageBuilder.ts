
export class MessageBuilder {

    constructor(username: string) {
    }

    private getMessageId(): number {
        return -1
    }

    buildKeepAliveMessage(id: number) {
        return "ping"
    }


    /**
     * set DP via https REST API via PUT:
     * http://192.168.9.40/fhapi/v1/api/rest/datapoint/00000000-0000-0000-0000-000000000000/ABB700DCDED6.ch0000.odp0010
     * 
     * @param serialNo ABB700DCDED6
     * @param channel ch0000
     * @param datapoint odp0010
     * @param value xxx DEPRECATED
     * @returns 
     */
    buildSetDatapointMessage(serialNo: string, channel: string, datapoint: string, value: string) {
        return serialNo + "." + channel + "." + datapoint
    }
}
