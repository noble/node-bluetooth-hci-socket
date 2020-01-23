const BluetoothHCISocket = require('.');

// This test basically just makes sure we don't segfault at initialization time.
try {
  console.log(new BluetoothHCISocket());
} catch(err) {
  console.error(err);
}