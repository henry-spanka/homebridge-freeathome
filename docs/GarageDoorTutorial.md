# GarageDoor Tutorial

A BuschJaeger Switch actuator can be used to control a GarageDoor that is connected
to the actuator. At the moment only impulse based garage motors are supported.

## Requirements
- Unused Switch actuator Output Channel
- Garage motor that is wired to the output channel

## Configure the homebridge plugin

#### DoorBell without Video
Add the following to the mapping of the actuator:

```json
{
    "mappings": {
        "<ACTUATOR-SERIAL>": {
            "garagedoor": {
                "<CHANNEL>": {
                    "movingUpTime": 15,
                    "movingDownTime": 15,
                    "triggerTime": 1,
                }
            }
            ...
        }
        ...
    }
}
```

Replace `<ACTUATOR-SERIAL>` with the serial of the 'Switch Actuator' you want to
expose as a GarageDoor. Make sure to not blacklist the channel.

##### Optional Parameters

* `movingUpTime` is the time the garage door needs to open (in seconds), default 15
* `movingDownTime` is the time the garage door needs to close (in seconds), default 15
* `triggerTime` is the time the circuit will be closed (seconds). You normally don't need to change this, default 1

Restart Homebridge for the changes to take effect. It will show Obstruction Detected at first
because it doesn't know the current state of the Garage Door. You need to bring the garage door
manually in the shown position (open) and then close the Garage Door with HomeKit (or Busch-Jaeger).
