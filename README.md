# node-bluetooth-hci-socket

Bluetooth HCI socket binding for Node.js

__NOTE:__ Currently only supports __Linux__.

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

#### Address

Get the device (Bluetooth/BT) address. __Note:__ must be called after ```bindRaw```.

```
var btAddress = bluetoothHciSocket.getAddress();
```

#### Address Type

Get the device (Bluetooth/BT) address type. __Note:__ must be called after ```bindRaw```.

```
var btAddressType = bluetoothHciSocket.getAddressType(); // returns: 'public' or 'random'
```

#### Is Device Up

Query the device state. __Note:__ must be called after ```bindRaw```.

```
var isDevUp = bluetoothHciSocket.isDevUp(); // returns: true or false
```

#### Start/stop

Start or stop event handling:

```javascript
bluetoothHciSocket.start();

// ...

bluetoothHciSocket.stop();
```

#### Write

```javascript
var data = new Buffer(/* ... */);

// ...


bluetoothHciSocket.write(data);
```

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

To gain complete and exclusive control of the HCI device, gatt uses
HCI_CHANNEL_USER (introduced in Linux v3.14) instead of HCI_CHANNEL_RAW.
Those who must use an older kernel may patch in these [relevant commits
from Marcel Holtmann](http://www.spinics.net/lists/linux-bluetooth/msg37345.html):

    Bluetooth: Introduce new HCI socket channel for user operation
    Bluetooth: Introduce user channel flag for HCI devices
    Bluetooth: Refactor raw socket filter into more readable code

Note that because gatt uses HCI_CHANNEL_USER, once gatt has opened the
device no other program may access it.

Before starting a gatt program, make sure that your BLE device is down:

    sudo hciconfig
    sudo hciconfig hci0 down  # or whatever hci device you want to use

If you have BlueZ 5.14+ (or aren't sure), stop the built-in
bluetooth server, which interferes with gatt, e.g.:

    sudo service bluetooth stop

Because gatt programs administer network devices, they must
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
bluetoothHciSocket.bindUser();
```

### Example using HCI_CHANNEL_USER

The examples/le-user-scan-test.js provides a LE scan using the HCI_CHANNEL_USER socket.

### Note on using HCI_CHANNEL_USER

In HCI_CHANNEL_USER, you gain complete control of the device, bypassing the BlueZ layer. *You will need to handle all bluetooth protocols by yourself.*
