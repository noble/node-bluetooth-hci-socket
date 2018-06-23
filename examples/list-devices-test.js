/* eslint-disable no-console */
const UsbBluetoothHciSocket = require('../lib/usb');
const usbBluetoothHciSocket = new UsbBluetoothHciSocket();
const usbDevices = usbBluetoothHciSocket.getDeviceList();
console.log('usbDevices: ', usbDevices);

const NativeBluetoothHciSocket = require('../lib/native');
const nativeBluetoothHciSocket = new NativeBluetoothHciSocket();
const nativeDevices = nativeBluetoothHciSocket.getDeviceList();
console.log('nativeDevices: ', nativeDevices);
