var os = require('os');

var platform = os.platform();

if (process.env.BLUETOOTH_HCI_SOCKET_FORCE_USB || platform === 'win32' || platform === 'freebsd') {
  module.exports = require('./lib/usb.js');
} else if (platform === 'linux' || platform === 'android') {
  module.exports = require('./lib/native');
} else {
  module.exports = require('./lib/unsupported');
}
