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
