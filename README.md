# node-bluetooth-hci-socket

Bluetooth HCI socket binding for Node.js

__NOTE:__ Currently only supports __Linux__ and __Windows__.

## Prerequisites

### Linux

 * Bluetooth 4.0 Adapter

### Windows

This library needs raw USB access to a Bluetooth 4.0 USB adapter, as it needs to bypass the Windows Bluetooth stack.

A [WinUSB](https://msdn.microsoft.com/en-ca/library/windows/hardware/ff540196(v=vs.85).aspx) driver is required, use [Zadig tool](http://zadig.akeo.ie) to replace the driver for your adapter.

__WARNING:__ This will make the adapter unavaible in Windows Bluetooth settings!

#### Compatible Bluetooth 4.0 USB Adapter's

| Name | USB VID | USB PID |
|:---- | :------ | :-------|
| BCM920702 Bluetooth 4.0 | 0x0a5c | 0x21e8 |
| CSR8510 A10 | 0x0a12 | 0x0001 |

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

## Using HCI_CHANNEL_USER

(Thanks to the https://github.com/paypal/gatt project for this feature !)

To gain complete and exclusive control of the HCI device, you may use
HCI_CHANNEL_USER (introduced in Linux v3.14) instead of HCI_CHANNEL_RAW.
Those who must use an older kernel may patch in these [relevant commits
from Marcel Holtmann](http://www.spinics.net/lists/linux-bluetooth/msg37345.html):

    Bluetooth: Introduce new HCI socket channel for user operation
    Bluetooth: Introduce user channel flag for HCI devices
    Bluetooth: Refactor raw socket filter into more readable code

Note that using HCI_CHANNEL_USER, once a socket is opened,
no other program may access the device.

Before starting a program in this mode, make sure that your BLE device is down:

    sudo hciconfig
    sudo hciconfig hci0 down  # or whatever hci device you want to use

If you have BlueZ 5.14+ (or aren't sure), stop the built-in
bluetooth server, which interferes with gatt, e.g.:

    sudo service bluetooth stop

Because using this mode administer network devices, programs must
either be run as root, or be granted appropriate capabilities:

    sudo <executable>
    # OR
    sudo setcap 'cap_net_raw,cap_net_admin=eip' <executable>
    <executable>

Usage:

```javascript
bluetoothHciSocket.start();
// Warning: don't call setFilter !
// Bind in HCI_CHANNEL_USER mode !
bluetoothHciSocket.bindUser([deviceId]); // optional deviceId (integer)
```

### Example using HCI_CHANNEL_USER

The examples/le-user-scan-test.js provides a LE scan using the HCI_CHANNEL_USER socket.

### Note on using HCI_CHANNEL_USER

In HCI_CHANNEL_USER, you gain complete control of the device, bypassing the BlueZ layer. *You will need to handle all bluetooth protocols by yourself.*


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
