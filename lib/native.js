var events = require('events');

var binary = require('node-pre-gyp');
var path = require('path');
var binding_path = binary.find(path.resolve(path.join(__dirname,'../package.json')));
var binding = require(binding_path);

var BluetoothHciSocket = binding.BluetoothHciSocket;

inherits(BluetoothHciSocket, events.EventEmitter);

// extend prototype
function inherits(target, source) {
  for (var k in source.prototype) {
    target.prototype[k] = source.prototype[k];
  }
}

module.exports = BluetoothHciSocket;
