# node-bluetooth-hci-socket

Bluetooth HCI socket binding for Node.js

__NOTE:__ Currently only supports __Linux__, __FreeBSD__ and __Windows__.

## Prerequisites

 * [node-gyp requirements](https://github.com/TooTallNate/node-gyp#installation)

__NOTE:__ `node-gyp` is only required if the npm cannot find binary for your OS version otherwise the binaries are prebuilt.

### Linux

 * Bluetooth 4.0 Adapter

__Note:__ the [node-usb](https://github.com/nonolith/node-usb) dependency might fail install, this is ok, because it is an optional optional dependency. Installing ```libudev-dev``` via your Linux distribution's package manager will resolve the problem.

### Windows

This library needs raw USB access to a Bluetooth 4.0 USB adapter, as it needs to bypass the Windows Bluetooth stack.

A [WinUSB](https://msdn.microsoft.com/en-ca/library/windows/hardware/ff540196(v=vs.85).aspx) driver is required, use [Zadig tool](http://zadig.akeo.ie) to replace the driver for your adapter.

__WARNING:__ This will make the adapter unavailable in Windows Bluetooth settings! To roll back to the original driver go to: ```Device Manager -> Open Device -> Update Driver```

#### Compatible Bluetooth 4.0 USB Adapter's

| Name | USB VID | USB PID |
|:---- | :------ | :-------|
| BCM920702 Bluetooth 4.0 | 0x0a5c | 0x21e8 |
| BCM20702A0 Bluetooth 4.0 | 0x19ff | 0x0239 |
| BCM20702A0 Bluetooth 4.0 | 0x0489 | 0xe07a |
| CSR8510 A10 | 0x0a12 | 0x0001 |
| Asus BT-400 | 0x0b05 | 0x17cb |
| Intel Wireless Bluetooth 6235 | 0x8087 | 0x07da |
| Intel Wireless Bluetooth 7260 | 0x8087 | 0x07dc |
| Intel Wireless Bluetooth 7265 | 0x8087 | 0x0a2a |
| Intel Wireless Bluetooth      | 0x8087 | 0x0a2b |
| Belkin BCM20702A0 | 0x050D | 0x065A |

#### Compatible Bluetooth 4.1 USB Adapter's
| Name | USB VID | USB PID |
|:---- | :------ | :-------|
| BCM2045A0 Bluetooth 4.1 | 0x0a5c | 0x6412 |

## Install

```sh
npm install bluetooth-hci-socket
```

## Usage

```javascript
var BluetoothHciSocket = require('bluetooth-hci-socket');
```

### Actions

#### Create

```javascript
var bluetoothHciSocket = new BluetoothHciSocket();
```

#### Set Filter

```javascript
var filter = new Buffer(14);

// ...

bluetoothHciSocket.setFilter(filter);
```

__Note:__ ```setFilter``` is not required if ```bindRaw``` is used.

#### Bind

##### Raw Channel

```javascript
bluetoothHciSocket.bindRaw([deviceId]); // optional deviceId (integer)
```

##### User Channel

```javascript
bluetoothHciSocket.bindUser([deviceId]); // optional deviceId (integer)
```

Requires the device to be in the powered down state (```sudo hciconfig hciX down```).

##### Control Channel

```javascript
bluetoothHciSocket.bindControl();
```

#### Is Device Up

Query the device state.

```
var isDevUp = bluetoothHciSocket.isDevUp(); // returns: true or false
```

__Note:__ must be called after ```bindRaw```.

#### Start/stop

Start or stop event handling:

```javascript
bluetoothHciSocket.start();

// ...

bluetoothHciSocket.stop();
```

__Note:__ must be called after ```bindRaw``` or ```bindControl```.

#### Write

```javascript
var data = new Buffer(/* ... */);

// ...


bluetoothHciSocket.write(data);
```

__Note:__ must be called after ```bindRaw``` or ```bindControl```.

### Events

#### Data

```javascript
bluetoothHciSocket.on('data', function(data) {
  // data is a Buffer

  // ...
});
```

#### Error

```javascript
bluetoothHciSocket.on('error', function(error) {
  // error is a Error

  // ...
});
```

## Examples

See [examples folder](https://github.com/sandeepmistry/node-bluetooth-hci-socket/blob/master/examples) for code examples.

## Platform Notes

### Linux

#### Force Raw USB mode

Unload ```btusb``` kernel module:

```sh
sudo rmmod btusb
```

Set ```BLUETOOTH_HCI_SOCKET_FORCE_USB``` environment variable:

```sh
sudo BLUETOOTH_HCI_SOCKET_FORCE_USB=1 node <file>.js
```

### FreeBSD

Disable automatic loading of the default Bluetooth stack by putting [no-ubt.conf](https://gist.github.com/myfreeweb/44f4f3e791a057bc4f3619a166a03b87) into ```/usr/local/etc/devd/no-ubt.conf``` and restarting devd (```sudo service devd restart```).

Unload ```ng_ubt``` kernel module if already loaded:

```sh
sudo kldunload ng_ubt
```

### OS X

#### Disable CSR USB Driver

```sh
sudo kextunload -b com.apple.iokit.CSRBluetoothHostControllerUSBTransport
```

#### Disable Broadcom USB Driver

```sh
sudo kextunload -b com.apple.iokit.BroadcomBluetoothHostControllerUSBTransport
```

### Windows

#### Force adapter USB VID and PID

Set ```BLUETOOTH_HCI_SOCKET_USB_VID``` and ```BLUETOOTH_HCI_SOCKET_USB_PID``` environment variables.

Example for USB device id: 050d:065a:

```sh
set BLUETOOTH_HCI_SOCKET_USB_VID=0x050d
set BLUETOOTH_HCI_SOCKET_USB_PID=0x065a

node <file>.js
```
