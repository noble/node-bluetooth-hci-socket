var UsbBluetoothHciSocket = require('../lib/usb');
var usbBluetoothHciSocket = new UsbBluetoothHciSocket();
var usbDevices = usbBluetoothHciSocket.getDeviceList();
console.log("usbDevices: ", usbDevices);

var NativeBluetoothHciSocket = require('../lib/native');
var nativeBluetoothHciSocket = new NativeBluetoothHciSocket();
var nativeDevices = nativeBluetoothHciSocket.getDeviceList();
console.log("nativeDevices: ", nativeDevices);