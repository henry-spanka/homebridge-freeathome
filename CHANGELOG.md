#### 1.5.5 (2019-04-12)

##### Improvements

* If no response has been received from the SysAp within 5 seconds the accessory will show an error within HomeKit and the pending event will be cleaned up. This prevents the HomeKit UI from not responding for up to 1 minute with left over event which eventually may crash homebridge.

#### 1.5.4 (2019-04-01)

##### Improvements

* **BuschJaegerJalousieAccessory**:  
    Moving the shutters is now more reliable (than ever) and should not cause the shutters to stop and start when the position is changed multiple times while moving. Additionally position changes should now be exact and reflect the actual window.

#### 1.5.3 (2019-01-25)

##### Bug Fixes

* Fixed crash if all channels of an actuator were blacklisted.

#### 1.5.2 (2018-09-18)

##### Features

* The thermostat accessory now reports temperature in 0.5 steps for increased accuracy.
As this is a non-breaking feature it will included in a patch release.

#### 1.5.1 (2018-09-05)

##### Bug Fixes

* Fixed a bug that caused (switch) actuators not to react if they are turned on,
on homebridge start

### 1.5.0 (2018-07-04)

##### Features

* **Custom Actuator** Added support for:
    - Garage Door

##### Bug Fixes
* **BuschJaegerThermostatAccessory**:
    - fixed Thermostat heating to 35 °C / cooling to 7 °C
    - fixed incorrect temperature readout
    - set min value to 7 °C and max to 35 °C
    - enable heating mode before changing target temperature when mode is off
    - fixed incorrect current heating state

### 1.4.0 (2018-06-26)

##### Features

* **Custom Actuator** Added support for:
    - (Video) Door bell

### 1.3.0 (2018-06-05)

##### Features


* **Actuator** Added support for:
    - Sensor/ Schaltaktor 2/2-fach (1010)

### 1.2.0 (2018-04-16)

##### Features

* **Actuator:** Added support for:
    - Sensor/ Schaltaktor 1/1-fach (100C)

### 1.1.0 (2018-04-01)

##### Features

* **Actuator:** Added support for:
    - Schaltaktor 4-fach, 16A, REG (B002)

## 1.0.0 (2018-03-28)

##### Features

* **Actuator:** Added support for:
    - Dimmaktor 4-fach (101C)
    - Sensor/ Jalousieaktor 2/1-fach (1015)
    - Sensor/ Jalousieaktor 1/1-fach (1013)
    - Sonos Media Player (0001)

##### Bug Fixes

* **Accessory:** Fix lockup of JalousieAccessory

##### Improvements

* **API:** Make the UI more reactive by listening for websocket events from the SysAp
* **API:** Update only once every 60 seconds by default to reduce load

##### Upgrade Notes
* ~~**API:** The plugin depends on features that have not yet been merged in the API project and therefore you need to use the fork https://github.com/henry-spanka/home~~

#### 0.0.2 (2018-03-09)

##### Features

* **Actuator:** Added support for:
    - Raumtemperaturregler (1004)
    - Jalousieaktor 4-fach, REG (B001)
    - Sensor/ Schaltaktor 8/8fach, REG (B008)
    - Dimmaktor 4-fach (1021)
* **Configuration:** Allow to ignore some actuators/channels
* **Performance:** The UI is now more responsive.

# Bug Fixes
* **HomeKit:** Under some circumstances if the API can not authenticate against the SysAp the plugin will report zero accessories and all accessories are removed from the HomeKit database.
* **API:** If the connection to the API is lost Homebridge crashes.

# Improvements
* **Documentation:** Improved documentation.
