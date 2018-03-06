# Homebridge-Buschjaeger

Homebridge platform plugin for Busch-Jaeger SmartHome devices.

# Supported devices
- Dimmaktor 4-fach (1021)
- Raumtemperaturregler (1004)
- Sensor/ Schaltaktor 8/8fach, REG (B008)
- Jalousieaktor 4-fach, REG (B001)

# Installation
1. Install Homebrige Plugin
2. Configure Platform (Basic Configuration)
```json
{
    "platform": "BuschJaegerSysAp",
    "sysIP": "<IP>",
    "updateInterval": 5,
    "mappings": {}
}
```

**Note:** The documentation is missing several critical parts that are required for the plugin to function. These will be added as soon as possible.
