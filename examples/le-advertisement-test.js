/* eslint-disable no-console */
const BluetoothHciSocket = require('../index');

const bluetoothHciSocket = new BluetoothHciSocket();

bluetoothHciSocket.on('data', function(data) {
  console.log(`data:  ${data.toString('hex')}`);

  if (data.readUInt8(0) === HCI_EVENT_PKT) {
    if (data.readUInt8(1) === EVT_CMD_COMPLETE) {
      if (data.readUInt16LE(4) === LE_SET_ADVERTISING_PARAMETERS_CMD) {
        if (data.readUInt8(6) === HCI_SUCCESS) {
          console.log('LE Advertising Parameters Set');
        }
      } else if (data.readUInt16LE(4) === LE_SET_ADVERTISING_DATA_CMD) {
        if (data.readUInt8(6) === HCI_SUCCESS) {
          console.log('LE Advertising Data Set');
        }
      } else if (data.readUInt16LE(4) === LE_SET_SCAN_RESPONSE_DATA_CMD) {
        if (data.readUInt8(6) === HCI_SUCCESS) {
          console.log('LE Scan Response Data Set');
        }
      } else if (data.readUInt16LE(4) === LE_SET_ADVERTISE_ENABLE_CMD) {
        if (data.readUInt8(6) === HCI_SUCCESS) {
          console.log('LE Advertise Enable Set');
        }
      }
    } else if (data.readUInt8(1) === EVT_DISCONN_COMPLETE) {
      const disconnectionStatus = data.readUInt8(3);
      const disconnectionHandle = data.readUInt16LE(4);
      const disconnectionReason = data.readUInt8(6);

      console.log('Disconn Complete');
      console.log(`\t${disconnectionStatus}`);
      console.log(`\t${disconnectionHandle}`);
      console.log(`\t${disconnectionReason}`);

      process.exit(0);
    } else if (data.readUInt8(1) === EVT_LE_META_EVENT) {
      const subEvent = data.readUInt8(3);
      const status = data.readUInt8(4);
      const handle = data.readUInt16LE(5);

      if (subEvent === EVT_LE_CONN_COMPLETE) { // subevent
        const role = data.readUInt8(7);
        const peerBdAddrType = data.readUInt8(8);
        const peerBdAddr = data.slice(9, 15);
        const interval = data.readUInt16LE(15);
        const latency = data.readUInt16LE(17);
        const supervisionTimeout = data.readUInt16LE(19);
        const masterClockAccuracy = data.readUInt8(21);

        console.log('LE Connection Complete');
        console.log(`\t${status}`);
        console.log(`\t${handle}`);
        console.log(`\t${role}`);
        console.log(`\t${['PUBLIC', 'RANDOM'][peerBdAddrType]}`);
        console.log(`\t${peerBdAddr.toString('hex').match(/.{1,2}/g).reverse().join(':')}`);
        console.log(`\t${interval * 1.25}`);
        console.log(`\t${latency}`);
        console.log(`\t${supervisionTimeout * 10}`);
        console.log(`\t${masterClockAccuracy}`);

        setAdvertiseEnable(true);
      } else if (subEvent === EVT_LE_CONN_UPDATE_COMPLETE) {
        const updateInterval = data.readUInt16LE(7);
        const updateLatency = data.readUInt16LE(9);
        const updateSupervisionTimeout = data.readUInt16LE(11);

        console.log('LE Connection Update Complete');
        console.log(`\t${status}`);
        console.log(`\t${handle}`);

        console.log(`\t${updateInterval * 1.25}`);
        console.log(`\t${updateLatency}`);
        console.log(`\t${updateSupervisionTimeout * 10}`);
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
const HCI_ACLDATA_PKT = 0x02;
const HCI_EVENT_PKT = 0x04;

const EVT_DISCONN_COMPLETE = 0x05;
const EVT_CMD_COMPLETE = 0x0e;
const EVT_CMD_STATUS = 0x0f;
const EVT_LE_META_EVENT = 0x3e;

const EVT_LE_CONN_COMPLETE = 0x01;
const EVT_LE_CONN_UPDATE_COMPLETE = 0x03;

const OGF_LE_CTL = 0x08;
const OCF_LE_SET_ADVERTISING_PARAMETERS = 0x0006;
const OCF_LE_SET_ADVERTISING_DATA = 0x0008;
const OCF_LE_SET_SCAN_RESPONSE_DATA = 0x0009;
const OCF_LE_SET_ADVERTISE_ENABLE = 0x000a;

const LE_SET_ADVERTISING_PARAMETERS_CMD = OCF_LE_SET_ADVERTISING_PARAMETERS | OGF_LE_CTL << 10;
const LE_SET_ADVERTISING_DATA_CMD = OCF_LE_SET_ADVERTISING_DATA | OGF_LE_CTL << 10;
const LE_SET_SCAN_RESPONSE_DATA_CMD = OCF_LE_SET_SCAN_RESPONSE_DATA | OGF_LE_CTL << 10;
const LE_SET_ADVERTISE_ENABLE_CMD = OCF_LE_SET_ADVERTISE_ENABLE | OGF_LE_CTL << 10;

const HCI_SUCCESS = 0;

function setFilter() {
  const filter = Buffer.alloc(14);
  const typeMask = (1 << HCI_EVENT_PKT) | (1 << HCI_ACLDATA_PKT);
  const eventMask1 = (1 << EVT_DISCONN_COMPLETE) | (1 << EVT_CMD_COMPLETE) | (1 << EVT_CMD_STATUS);
  const eventMask2 = (1 << (EVT_LE_META_EVENT - 32));
  const opcode = 0;

  filter.writeUInt32LE(typeMask, 0);
  filter.writeUInt32LE(eventMask1, 4);
  filter.writeUInt32LE(eventMask2, 8);
  filter.writeUInt16LE(opcode, 12);

  bluetoothHciSocket.setFilter(filter);
}

function setAdvertisingParameter() {
  const cmd = Buffer.alloc(19);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(LE_SET_ADVERTISING_PARAMETERS_CMD, 1);

  // length
  cmd.writeUInt8(15, 3);

  // data
  cmd.writeUInt16LE(0x00a0, 4); // min interval
  cmd.writeUInt16LE(0x00a0, 6); // max interval
  cmd.writeUInt8(0x00, 8); // adv type
  cmd.writeUInt8(0x00, 9); // own addr typ
  cmd.writeUInt8(0x00, 10); // direct addr type
  Buffer.from('000000000000', 'hex').copy(cmd, 11); // direct addr
  cmd.writeUInt8(0x07, 17);
  cmd.writeUInt8(0x00, 18);

  console.log(`write: ${cmd.toString('hex')}`);
  bluetoothHciSocket.write(cmd);
}

function setAdvertisingData(data) {
  const cmd = Buffer.alloc(36);

  cmd.fill(0);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(LE_SET_ADVERTISING_DATA_CMD, 1);

  // length
  cmd.writeUInt8(32, 3);

  // data
  cmd.writeUInt8(data.length, 4);
  data.copy(cmd, 5);

  console.log(`write: ${cmd.toString('hex')}`);
  bluetoothHciSocket.write(cmd);
}

function setScanResponseData(data) {
  const cmd = Buffer.alloc(36);

  cmd.fill(0);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(LE_SET_SCAN_RESPONSE_DATA_CMD, 1);

  // length
  cmd.writeUInt8(32, 3);

  // data
  cmd.writeUInt8(data.length, 4);
  data.copy(cmd, 5);

  console.log(`write: ${cmd.toString('hex')}`);
  bluetoothHciSocket.write(cmd);
}

function setAdvertiseEnable(enabled) {
  const cmd = Buffer.alloc(5);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(LE_SET_ADVERTISE_ENABLE_CMD, 1);

  // length
  cmd.writeUInt8(0x01, 3);

  // data
  cmd.writeUInt8(enabled ? 0x01 : 0x00, 4); // enable: 0 -> disabled, 1 -> enabled

  console.log(`write: ${cmd.toString('hex')}`);
  bluetoothHciSocket.write(cmd);
}

bluetoothHciSocket.bindRaw();
setFilter();
bluetoothHciSocket.start();

console.log(`isDevUp = ${bluetoothHciSocket.isDevUp()}`);

setAdvertiseEnable(false);
setAdvertisingParameter();
setScanResponseData(Buffer.from('0909657374696d6f74650e160a182eb8855fb5ddb601000200', 'hex'));
setAdvertisingData(Buffer.from('0201061aff4c000215b9407f30f5f8466eaff925556b57fe6d00010002b6', 'hex'));
setAdvertiseEnable(true);
