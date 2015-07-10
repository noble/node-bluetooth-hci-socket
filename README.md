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

```javascript
bluetoothHciSocket.bind();
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
