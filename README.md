# node-bluetooth-hci-socket

Bluetooth HCI socket binding for Node.js

__NOTE:__ Currently only supports __Linux__ and __Windows__.

## Prerequisites

 * [node-gyp requirements](https://github.com/TooTallNate/node-gyp#installation)

### Linux

 * Bluetooth 4.0 Adapter

__Note:__ the [node-usb](https://github.com/nonolith/node-usb) dependency might fail install, this is ok, because it is an optional optional dependency. Installing ```libudev-dev``` via your Linux distribution's package manager will resolve the problem.

### Windows

This library needs raw USB access to a Bluetooth 4.0 USB adapter, as it needs to bypass the Windows Bluetooth stack.

A [WinUSB](https://msdn.microsoft.com/en-ca/library/windows/hardware/ff540196(v=vs.85).aspx) driver is required, use [Zadig tool](http://zadig.akeo.ie) to replace the driver for your adapter.

__WARNING:__ This will make the adapter unavaible in Windows Bluetooth settings!

#### Compatible Bluetooth 4.0 USB Adapter's

| Name | USB VID | USB PID |
|:---- | :------ | :-------|
| BCM920702 Bluetooth 4.0 | 0x0a5c | 0x21e8 |
| BCM20702A0 Bluetooth 4.0 | 0x19ff | 0x0239 |
| CSR8510 A10 | 0x0a12 | 0x0001 |
| Asus BT-400 | 0x0b05 | 0x17cb |

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
