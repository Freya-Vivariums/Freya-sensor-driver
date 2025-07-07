![Freya Banner](https://raw.githubusercontent.com/Freya-Vivariums/.github/refs/heads/main/brand/Freya_banner.png)

<a href="https://github.com/Freya-Vivariums/Freya-sensor" target="_blank" >
<img src="https://github.com/Freya-Vivariums/.github/blob/main/documentation/Freya_Sensor_800x800.jpg?raw=true" align="right" width="40%"/>
</a>

The **Freya Sensor Driver** project contains all software components to use the [Freya Sensor](https://github.com/Freya-Vivariums/Freya-sensor).

<br clear="right"/>

## Installation
When installing the Freya system, the **sensor driver is automatically installed** with the rest of the system. For manual installation run these commands on your device:

```
wget -O install.sh https://github.com/Freya-Vivariums/Freya-sensor-driver/releases/latest/download/install.sh;
chmod +x ./install.sh;
sudo ./install.sh;
```

The software is installed as a `systemd` service, which is automatically started.
```
# systemctl status io.freya.HardwareInterface.service
```

To view the log files of the service, run:
```
# journalctl -u io.freya.HardwareInterface.service -f
```

## Application programming
The Freya Sensor Driver uses `DBus` to interact with applications.

## License & Collaboration
**Copyright© 2025 Sanne 'SpuQ' Santens**. The Freya Sensor Driver project is licensed under the **[MIT License](LICENSE.txt)**. The [Rules & Guidelines](https://github.com/Freya-Vivariums/.github/blob/main/brand/Freya_Trademark_Rules_and_Guidelines.md) apply to the usage of the Freya Vivariums™ brand.

### Collaboration

If you'd like to contribute to this project, please follow these guidelines:
1. Fork the repository and create your branch from `main`.
2. Make your changes and ensure they adhere to the project's coding style and conventions.
3. Test your changes thoroughly.
4. Ensure your commits are descriptive and well-documented.
5. Open a pull request, describing the changes you've made and the problem or feature they address.