/* eslint-disable no-console */
const BluetoothHciSocket = require('../index');

const bluetoothHciSocket = new BluetoothHciSocket();

bluetoothHciSocket.on('data', function(data) {
  console.log(`data: ${data.toString('hex')}`);

  if (data.readUInt8(0) === HCI_EVENT_PKT) {
    if (data.readUInt8(1) === EVT_CMD_COMPLETE) {
      if (data.readUInt16LE(4) === LE_SET_SCAN_PARAMETERS_CMD) {
        if (data.readUInt8(6) === HCI_SUCCESS) {
          console.log('LE Scan Parameters Set');
        }
      } else if (data.readUInt16LE(4) === LE_SET_SCAN_ENABLE_CMD) {
        if (data.readUInt8(6) === HCI_SUCCESS) {
          console.log('LE Scan Enable Set');
        }
      }
    } else if (data.readUInt8(1) === EVT_LE_META_EVENT) {
      if (data.readUInt8(3) === EVT_LE_ADVERTISING_REPORT) { // subevent
        const gapAdvType = data.readUInt8(5);
        const gapAddrType = data.readUInt8(6);
        const gapAddr = data.slice(7, 13);

        const eir = data.slice(14, data.length - 1);
        const rssi = data.readInt8(data.length - 1);

        console.log('LE Advertising Report');
        console.log(`\t${['ADV_IND', 'ADV_DIRECT_IND', 'ADV_SCAN_IND', 'ADV_NONCONN_IND', 'SCAN_RSP'][gapAdvType]}`);
        console.log(`\t${['PUBLIC', 'RANDOM'][gapAddrType]}`);
        console.log(`\t${gapAddr.toString('hex').match(/.{1,2}/g).reverse().join(':')}`);
        console.log(`\t${eir.toString('hex')}`);
        console.log(`\t${rssi}`);
      }
    }
  }
});

bluetoothHciSocket.on('error', function(error) {
  // TODO: non-BLE adaptor

  if (error.message === 'Operation not permitted') {
    console.log('state = unauthorized');
  } else if (error.message === 'Network is down') {
    console.log('state = powered off');
  } else {
    console.error(error);
  }
});

const HCI_COMMAND_PKT = 0x01;
const HCI_EVENT_PKT = 0x04;

const EVT_CMD_COMPLETE = 0x0e;
const EVT_CMD_STATUS = 0x0f;
const EVT_LE_META_EVENT = 0x3e;

const EVT_LE_ADVERTISING_REPORT = 0x02;

const OGF_LE_CTL = 0x08;
const OCF_LE_SET_SCAN_PARAMETERS = 0x000b;
const OCF_LE_SET_SCAN_ENABLE = 0x000c;


const LE_SET_SCAN_PARAMETERS_CMD = OCF_LE_SET_SCAN_PARAMETERS | OGF_LE_CTL << 10;
const LE_SET_SCAN_ENABLE_CMD = OCF_LE_SET_SCAN_ENABLE | OGF_LE_CTL << 10;

const HCI_SUCCESS = 0;

function setFilter() {
  const filter = Buffer.alloc(14);
  const typeMask = (1 << HCI_EVENT_PKT);
  const eventMask1 = (1 << EVT_CMD_COMPLETE) | (1 << EVT_CMD_STATUS);
  const eventMask2 = (1 << (EVT_LE_META_EVENT - 32));
  const opcode = 0;

  filter.writeUInt32LE(typeMask, 0);
  filter.writeUInt32LE(eventMask1, 4);
  filter.writeUInt32LE(eventMask2, 8);
  filter.writeUInt16LE(opcode, 12);

  bluetoothHciSocket.setFilter(filter);
}

function setScanParameters() {
  const cmd = Buffer.alloc(11);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(LE_SET_SCAN_PARAMETERS_CMD, 1);

  // length
  cmd.writeUInt8(0x07, 3);

  // data
  cmd.writeUInt8(0x01, 4); // type: 0 -> passive, 1 -> active
  cmd.writeUInt16LE(0x0010, 5); // internal, ms * 1.6
  cmd.writeUInt16LE(0x0010, 7); // window, ms * 1.6
  cmd.writeUInt8(0x00, 9); // own address type: 0 -> public, 1 -> random
  cmd.writeUInt8(0x00, 10); // filter: 0 -> all event types

  bluetoothHciSocket.write(cmd);
}

function setScanEnable(enabled, duplicates) {
  const cmd = Buffer.alloc(6);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(LE_SET_SCAN_ENABLE_CMD, 1);

  // length
  cmd.writeUInt8(0x02, 3);

  // data
  cmd.writeUInt8(enabled ? 0x01 : 0x00, 4); // enable: 0 -> disabled, 1 -> enabled
  cmd.writeUInt8(duplicates ? 0x01 : 0x00, 5); // duplicates: 0 -> no duplicates, 1 -> duplicates

  bluetoothHciSocket.write(cmd);
}

bluetoothHciSocket.bindRaw();
setFilter();
bluetoothHciSocket.start();

setScanEnable(false, true);

setScanParameters();
setScanEnable(true, true);
