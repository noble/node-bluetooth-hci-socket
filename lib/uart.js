var events = require('events');
var util = require('util');

var debug = require('debug')('hci-uart');
var SerialPort = require('serialport').SerialPort;

var HCI_COMMAND_PKT = 0x01;
var HCI_ACLDATA_PKT = 0x02;
var HCI_EVENT_PKT = 0x04;

var OGF_HOST_CTL = 0x03;
var OCF_RESET = 0x0003;

function BluetoothHciSocket() {
  this._isUp = false;
  this._isOpen = false;

  this._buffer = new Buffer(0);
}

util.inherits(BluetoothHciSocket, events.EventEmitter);

BluetoothHciSocket.prototype.setFilter = function(filter) {
  // no-op
};

BluetoothHciSocket.prototype.bindRaw = function(devId) {
  this.bindUser(devId);

  this._mode = 'raw';
};

BluetoothHciSocket.prototype.bindUser = function(devId) {
  this._mode = 'user';

  this._serialPort = new SerialPort(process.env.BLUETOOTH_HCI_SOCKET_UART, {
    baudrate: 115200,
    rtscts: true
  });
};

BluetoothHciSocket.prototype.bindControl = function() {
  this._mode = 'control';
};

BluetoothHciSocket.prototype.isDevUp = function() {
  return this._isUp;
};

BluetoothHciSocket.prototype.start = function() {
  if (this._mode === 'raw' || this._mode === 'user') {
    this._serialPort.on('open', this.onOpen.bind(this));
    this._serialPort.on('data', this.onData.bind(this));

    this._serialPort.open();
  }
};

BluetoothHciSocket.prototype.stop = function() {
  if (this._mode === 'raw' || this._mode === 'user') {
    this._serialPort.close();
    this._serialPort.removeAllListeners();
  }
};

BluetoothHciSocket.prototype.write = function(data) {
  debug('write: ' + data.toString('hex'));

  this._serialPort.write(data);
};

BluetoothHciSocket.prototype.onOpen = function() {
  debug('open');

  if (!this._isOpen) {
    this._isOpen = true;

    this.reset();
  }
};

BluetoothHciSocket.prototype.onData = function(data) {
  debug('data: ' + data.toString('hex'));

  if (data.length === 0) {
    return;
  }

  this._buffer = Buffer.concat([
    this._buffer,
    data
  ]);

  if (this._mode === 'raw' && data.length === 7 && ('040e0401030c00' === data.toString('hex'))) {
    debug('reset complete');
    this._isUp = true;
  }

  while(true) {
    if (this._buffer.length < 2) {
      break;
    }

    var type = this._buffer.readUInt8(0);
    var length = 0;

    if (type === HCI_EVENT_PKT) {
      if (this._buffer.length < 3) {
        break;
      }

      length = this._buffer.readUInt8(2) + 3;
    } else if (type === HCI_ACLDATA_PKT) {
      if (this._buffer.length < 10) {
        break;
      }

      length = this._buffer.readUInt16LE(3) + 5;
    } else {
      throw new Error('Unknown HCI pkt type: ' + type);
    }

    if (this._buffer.length < length) {
      break;
    }

    this.emit('data', this._buffer.slice(0, length));

    this._buffer = this._buffer.slice(length);
  }
};

BluetoothHciSocket.prototype.reset = function() {
  var cmd = new Buffer(4);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(OCF_RESET | OGF_HOST_CTL << 10, 1);

  // length
  cmd.writeUInt8(0x00, 3);

  debug('reset');
  this.write(cmd);
};

module.exports = BluetoothHciSocket;
