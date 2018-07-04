# DoorBell Tutorial

The Busch Welcome door bell can be exposed to HomeKit as a Motion Sensor.
Additionally if you have an external surveillance camera you can expose the door bell
to HomeKit as a VideoDoorBell (not a motion sensor). However they will function the same.

Unfortunately the Busch Welcome video camera does not work as I haven't found a way to
gain access to the video feed. There may be the
possibility to hack into the video feed via the IP-Gateway but I do not have one
so any help would be appreciated. This is why I use a Surveillance Camera instead
to get a snapshot when the door bell is ringing.

## Requirements
- Unused Schaltaktor Output Channel
- Surveillance Camera (Optional - For Picture on bell ring)

## Configure BuschJaeger System Access Point
1. Log into your System Access Point
2. Select the 'Devices' menu
3. Select the floor where the bell is located
4. Drag a 'Door call' accessory on the room
5. Drag an unused 'Switch Actuator' (Schaltaktor) on the same room
6. Connect/Attach the 'Door call' to the 'Switch Actuator'

## Configure the homebridge plugin

#### DoorBell without Video
Add the following to the mapping of the actuator:

```json
{
    "mappings": {
        "<ACTUATOR-SERIAL>": {
            "doorbell": {
                "<CHANNEL>": {
                    "video": false
                }
            }
            ...
        }
        ...
    }
}
```

Replace `<ACTUATOR-SERIAL>` with the serial of the 'Switch Actuator' you attached
the 'Door call' to and `<CHANNEL>` with the channel you used. Make sure to not blacklist the channel.


#### DoorBell with Video
Add the following to the mapping of the actuator:

```json
{
    "mappings": {
        "<ACTUATOR-SERIAL>": {
            "doorbell": {
                "<CHANNEL>": {
                    "video": false,
                    "name": "<CAMERA NAME>",
                    "videoConfig": {
                        "source": "-re -i rtsp://myfancy_rtsp_stream",
                        "stillImageSource": "-i http://faster_still_image_grab_url/this_is_optional.jpg",
                        "maxWidth": 1280,
                        "maxHeight": 720,
                        "maxFPS": 30
                    }
                }
            }
            ...
        }
        ...
    }
}
```

##### Optional Parameters

###### videoConfig Parameters
* `maxStreams` is the maximum number of streams that will be generated for this camera, default 2
* `maxWidth` is the maximum width of the generated stream to avoid unnecessary upscaling, default 1280
* `maxHeight` is the maximum height of the generated stream to avoid unnecessary upscaling, default 720
* `maxFPS` is the maximum frame rate of the stream, default 10
* `maxBitrate` is the maximum frame rate of the stream in kbit/s, default 300
* `vcodec` If you're running on a RPi with the omx version of ffmpeg installed, you can change to the hardware accelerated video codec with this option, default "libx264"
* `audio` can be set to true to enable audio streaming from camera. To use audio ffmpeg must be compiled with --enable-libfdk-aac, see above, default false
* `packetSize` If audio or video is choppy try a smaller value, set to a multiple of 188, default 1316
* `debug` Show the output of ffmpeg in the log, default false


Restart Homebridge for the changes to take effect. If you use the video door bell
you need to add the camera to HomeKit manually by adding a new accessory in the HomeKit
app. The PIN is the same as for HomeBridge.
