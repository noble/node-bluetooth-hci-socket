const events = require('events');

const binary = require('node-pre-gyp');
const path = require('path');
const util = require('util');
const binding_path = binary.find(path.resolve(path.join(__dirname,'../package.json')));
const binding = require(binding_path);

const BluetoothHciSocket = binding.BluetoothHciSocket;

util.inherits(BluetoothHciSocket, events.EventEmitter);

module.exports = BluetoothHciSocket;
