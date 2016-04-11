var events = require('events');
var util = require('util');

var debug = require('debug')('hci-usb');
var usb = require('usb');

var HCI_COMMAND_PKT = 0x01;
var HCI_ACLDATA_PKT = 0x02;
var HCI_EVENT_PKT = 0x04;

var OGF_HOST_CTL = 0x03;
var OCF_RESET = 0x0003;

function BluetoothHciSocket() {
  this._isUp = false;

  this._hciEventEndpointBuffer = new Buffer(0);
  this._aclDataInEndpointBuffer = new Buffer(0);
}

util.inherits(BluetoothHciSocket, events.EventEmitter);

BluetoothHciSocket.prototype.setFilter = function(filter) {
  // no-op
};

BluetoothHciSocket.prototype.bindRaw = function(devId) {
  this.bindUser(devId);

  this._mode = 'raw';

  this.reset();
};

BluetoothHciSocket.prototype.bindUser = function(devId) {
  this._mode = 'user';

  if (process.env.BLUETOOTH_HCI_SOCKET_USB_VID && process.env.BLUETOOTH_HCI_SOCKET_USB_PID) {
    var usbVid = parseInt(process.env.BLUETOOTH_HCI_SOCKET_USB_VID);
    var usbPid = parseInt(process.env.BLUETOOTH_HCI_SOCKET_USB_PID);

    debug('using USB VID = ' + usbVid + ', PID = ' + usbPid);

    this._usbDevice = usb.findByIds(usbVid, usbPid);
  } else {
    this._usbDevice = usb.findByIds(0x0a5c, 0x21e8) || usb.findByIds(0x19ff, 0x0239) || usb.findByIds(0x0a12, 0x0001) || usb.findByIds(0x0b05, 0x17cb);
  }

  if (!this._usbDevice) {
    throw new Error('No compatible USB Bluetooth 4.0 device found!');
  }

  this._usbDevice.open();

  this._usbDeviceInterface = this._usbDevice.interfaces[0];

  this._aclDataOutEndpoint = this._usbDeviceInterface.endpoint(0x02);

  this._hciEventEndpoint = this._usbDeviceInterface.endpoint(0x81);
  this._aclDataInEndpoint = this._usbDeviceInterface.endpoint(0x82);

  this._usbDeviceInterface.claim();
};

BluetoothHciSocket.prototype.bindControl = function() {
  this._mode = 'control';
};

BluetoothHciSocket.prototype.isDevUp = function() {
  return this._isUp;
};

BluetoothHciSocket.prototype.start = function() {
  if (this._mode === 'raw' || this._mode === 'user') {
    this._hciEventEndpoint.on('data', this.onHciEventEndpointData.bind(this));
    this._hciEventEndpoint.startPoll();

    this._aclDataInEndpoint.on('data', this.onAclDataInEndpointData.bind(this));
    this._aclDataInEndpoint.startPoll();
  }
};

BluetoothHciSocket.prototype.stop = function() {
  if (this._mode === 'raw' || this._mode === 'user') {
    this._hciEventEndpoint.stopPoll();
    this._hciEventEndpoint.removeAllListeners();

    this._aclDataInEndpoint.stopPoll();
    this._aclDataInEndpoint.removeAllListeners();
  }
};

BluetoothHciSocket.prototype.write = function(data) {
  debug('write: ' + data.toString('hex'));

  if (this._mode === 'raw' || this._mode === 'user') {
    var type = data.readUInt8(0);

    if (HCI_COMMAND_PKT === type) {
      this._usbDevice.controlTransfer(usb.LIBUSB_REQUEST_TYPE_CLASS | usb.LIBUSB_RECIPIENT_INTERFACE, 0, 0, 0, data.slice(1));
    } else if(HCI_ACLDATA_PKT === type) {
      this._aclDataOutEndpoint.transfer(data.slice(1));
    }
  }
};

BluetoothHciSocket.prototype.onHciEventEndpointData = function(data) {
  debug('HCI event: ' + data.toString('hex'));

  if (data.length === 0) {
    return;
  }

  // add to buffer
  this._hciEventEndpointBuffer = Buffer.concat([
    this._hciEventEndpointBuffer,
    data
  ]);

  if (this._hciEventEndpointBuffer.length < 2) {
    return;
  }

  // check if desired length
  var pktLen = this._hciEventEndpointBuffer.readUInt8(1);
  if (pktLen <= (this._hciEventEndpointBuffer.length - 2)) {

    var buf = this._hciEventEndpointBuffer.slice(0, pktLen + 2);

    if (this._mode === 'raw' && buf.length === 6 && ('0e0401030c00' === buf.toString('hex'))) {
      debug('reset complete');
      this._isUp = true;
    }

    // fire event
    this.emit('data', Buffer.concat([
      new Buffer([HCI_EVENT_PKT]),
      buf
    ]));

    // reset buffer
    this._hciEventEndpointBuffer = this._hciEventEndpointBuffer.slice(pktLen + 2);
  }
};

BluetoothHciSocket.prototype.onAclDataInEndpointData = function(data) {
  debug('ACL Data In: ' + data.toString('hex'));

  if (data.length === 0) {
    return;
  }

  // add to buffer
  this._aclDataInEndpointBuffer = Buffer.concat([
    this._aclDataInEndpointBuffer,
    data
  ]);

  if (this._aclDataInEndpointBuffer.length < 4) {
    return;
  }

  // check if desired length
  var pktLen = this._aclDataInEndpointBuffer.readUInt16LE(2);
  if (pktLen <= (this._aclDataInEndpointBuffer.length - 4)) {

    var buf = this._aclDataInEndpointBuffer.slice(0, pktLen + 4);

    // fire event
    this.emit('data', Buffer.concat([
      new Buffer([HCI_ACLDATA_PKT]),
      buf
    ]));

    // reset buffer
    this._aclDataInEndpointBuffer = this._aclDataInEndpointBuffer.slice(pktLen + 4);
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
