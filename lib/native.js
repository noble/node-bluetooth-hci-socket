const events = require('events');

const binary = require('node-pre-gyp');
const path = require('path');
const binding_path = binary.find(path.resolve(path.join(__dirname,'../package.json')));
const binding = require(binding_path);

const BluetoothHciSocket = binding.BluetoothHciSocket;

inherits(BluetoothHciSocket, events.EventEmitter);

// extend prototype
function inherits(target, source) {
  for (const k in source.prototype) {
    target.prototype[k] = source.prototype[k];
  }
}

module.exports = BluetoothHciSocket;
