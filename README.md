[Install Homebridge]: https://github.com/nfarina/homebridge#installation
[Install free@home API]: https://github.com/henry-spanka/freeathome-api
[Configuration]: #Configuration

[sstadlberger]: https://github.com/sstadlberger
[Home Hub]: https://support.apple.com/en-us/HT207057


# Homebridge-Buschjaeger

Homebridge platform plugin for Busch-Jaeger SmartHome devices.

[![NPM](https://nodei.co/npm/homebridge-buschjaeger.png?compact=true)](https://npmjs.org/package/homebridge-buschjaeger)

![HomeKit UI](images/example_homekit_ui.png)

# Features
* Control your Busch-Jaeger Lights, Outlets, Blinds and more with Apple devices with Homekit
* Setup automations with the HomeKit UI
* Ask Siri to control your devices

# Supported devices
- Dimmaktor 4-fach (1021)
- Dimmaktor 4-fach (101C)
- Sensor/Dimmaktor 1/1-fach (1017)
- Raumtemperaturregler (1004)
- Sensor/ Schaltaktor 1/1-fach (100C)
- Sensor/ Schaltaktor 2/1-fach (100E)
- Sensor/ Schaltaktor 2/2-fach (1010)
- Sensor/ Schaltaktor 8/8fach, REG (B008)
- Schaltaktor 4-fach, 16A, REG (B002)
- Jalousieaktor 4-fach, REG (B001)
- Sensor/ Jalousieaktor 2/1-fach (1015)
- Sensor/ Jalousieaktor 1/1-fach (1013)
- free@homeTouch 7 (1038) [Door Lock Only]
- Sonos Media Player (0001)

# Custom Actuators
- A switch actuator can be exposed as a (video) DoorBell.
- A switch actuator can be exposed as a Garage Door.

# Requirements
* Busch-Jaeger Access Point
* A linux-based server on your home network that runs 24/7 like a Raspberry Pi.
* Busch-Jaeger API running

# Setup / Installation
1. [Install Homebridge]
2. `npm install homebridge-buschjaeger`
3. [Install free@home API]
    * Set the port for the websocket server to `8001`. The HTTP API can be disabled.
4. Edit `config.json` and configure platform. See [Configuration](#configuration) section.
5. Start Homebridge
6. Star the repository ;)

# Configuration

To configure the plugin add the following json in the platform section in `config.json`.
```json
{
    "platform": "BuschJaegerSysAp",
    "sysIP": "<IP>",
    "updateInterval": 60,
    "mappings": {}
}
```

Replace `<IP>` with the IP where your Busch-Jaeger API is running (NOT the IP of the System Access Point). `localhost` or `127.0.0.1` is fine if it's running on the same server.

You can configure the *mappings* if you want to ignore an actuator or channel if they are not connected/unused to hide them from the HomeKit UI.

```json
{
    "platform": "BuschJaegerSysAp",
    "sysIP": "<IP>",
    "updateInterval": 60,
    "mappings": {
        "<ACTUATOR-SERIAL>": {
            "blacklist": ["ch0000", "ch0001"],
        },
        "<ACTUATOR-SERIAL>": {
            "blacklist": ["*"],
        },
        "<ACTUATOR-SERIAL>": {
            "whitelist": ["ch0010"] # Only for Door Lock - free@homeTouch 7 at the moment.
        }

    }
}
```

You can find the actuator serial in the web interface of the Busch-Jaeger SysAp Interface.

Some actuators (like Door Lock - free@homeTouch 7) require the channel to be explicitly whitelisted.

## (Video) DoorBell
See the [DoorBell Tutorial](docs/DoorBellTutorial.md) on how to setup the BuschJaeger DoorBell in HomeKit.

## Garage Door
See the [GarageDoor Tutorial](docs/GarageDoorTutorial.md) on how to expose a Switch actuator as a GarageDoor accessory.

# Limitations
* ~~The door can not be controlled with HomeKit as the bus is not connected to the SysAp.~~
*Already implemented via free@HomeTouch 7 Panel*
* The door camera can not be accessed. You may want to use IP cameras that support the rtsp protocol and use
the video door bell.

# Notes
* The accessories can only be controlled when you're at home in your local WiFi network.
To manage your accessories remotely you need to setup an iPad/Homepod or Apple TV as a [Home Hub].

# Tips & Tricks
* Do not restart Homebridge if you are either updating the SysAp or an actuator as the accessory may be removed from
HomeKit if it is not detected during discovery.
* If the HomeKit UI does not respond to manual changes (switch pressed) or the accessory doesn't update itself log into the System Access Point interface and log out again. This must be done sometimes after a reboot of the free@home SysAP to enable websocket notifications.

# Changelog
The changelog can be viewed [here](CHANGELOG.md).

# Upgrade Notes
Upgrade Notes can be found in the [CHANGELOG](CHANGELOG.md).

# Help
If you have any questions or help please open an issue on the GitHub project page.

# Contributing
Pull requests are always welcome. If you have a device that is not supported yet please open an issue or open a pull request with
your modifications.

# License
The project is subject to the MIT license unless otherwise noted. A copy can be found in the root directory of the project [LICENSE](LICENSE).
