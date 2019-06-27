/* eslint-disable no-console */
const BluetoothHciSocket = require('../index');

const bluetoothHciSocket = new BluetoothHciSocket();

bluetoothHciSocket.on('data', function(data) {
  console.log(`data: ${data.toString('hex')}, ${data.length} bytes`);

  if (data.readUInt8(0) === HCI_EVENT_PKT) {
    if (data.readUInt8(1) === EVT_DISCONN_COMPLETE) {
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

        writeHandle(handle, Buffer.from('020001', 'hex'));
      }
    }
  } else if (data.readUInt8(0) === HCI_ACLDATA_PKT) {
    if ( ((data.readUInt16LE(1) >> 12) === ACL_START) &&
          (data.readUInt16LE(7) === ATT_CID) ) {

      const aclHandle = data.readUInt16LE(1) & 0x0fff;
      const aclData = data.slice(9);

      console.log('ACL data');
      console.log(`\t${aclHandle}`);
      console.log(`\t${aclData.toString('hex')}`);

      disconnectConnection(aclHandle, HCI_OE_USER_ENDED_CONNECTION);
    }
  }
});

bluetoothHciSocket.on('error', function(error) {
  // TODO: non-BLE adaptor

  if (error.message === 'Network is down') {
    console.log('state = powered off');
  } else {
    console.error(error);
  }
});

const HCI_COMMAND_PKT = 0x01;
const HCI_ACLDATA_PKT = 0x02;
const HCI_EVENT_PKT = 0x04;

const ACL_START = 0x02;

const ATT_CID = 0x0004;

const EVT_DISCONN_COMPLETE = 0x05;
const EVT_CMD_COMPLETE = 0x0e;
const EVT_CMD_STATUS = 0x0f;
const EVT_LE_META_EVENT = 0x3e;

const EVT_LE_CONN_COMPLETE = 0x01;
const EVT_LE_CONN_UPDATE_COMPLETE = 0x03;

const OGF_LE_CTL = 0x08;
const OCF_LE_CREATE_CONN = 0x000d;

const OGF_LINK_CTL = 0x01;
const OCF_DISCONNECT = 0x0006;

const LE_CREATE_CONN_CMD = OCF_LE_CREATE_CONN | OGF_LE_CTL << 10;
const DISCONNECT_CMD = OCF_DISCONNECT | OGF_LINK_CTL << 10;

const HCI_OE_USER_ENDED_CONNECTION = 0x13;

function setFilter() {
  const filter = Buffer.alloc(14);
  const typeMask = (1 << HCI_EVENT_PKT) | (1 << HCI_ACLDATA_PKT);
  const eventMask1 = (1 << EVT_DISCONN_COMPLETE) | (1 << EVT_CMD_COMPLETE) | (1 << EVT_CMD_STATUS);
  const eventMask2 = (1 << (EVT_LE_META_EVENT - 32));

  filter.writeUInt32LE(typeMask, 0);
  filter.writeUInt32LE(eventMask1, 4);
  filter.writeUInt32LE(eventMask2, 8);
  filter.writeUInt16LE(typeMask, 12);

  bluetoothHciSocket.setFilter(filter);
}

bluetoothHciSocket.bindRaw();
setFilter();
bluetoothHciSocket.start();

function createConnection(address, addressType) {
  const cmd = Buffer.alloc(29);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(LE_CREATE_CONN_CMD, 1);

  // length
  cmd.writeUInt8(0x19, 3);

  // data
  cmd.writeUInt16LE(0x0060, 4); // interval
  cmd.writeUInt16LE(0x0030, 6); // window
  cmd.writeUInt8(0x00, 8); // initiator filter

  cmd.writeUInt8(addressType === 'random' ? 0x01 : 0x00, 9); // peer address type
  Buffer.from(address.split(':').reverse().join(''), 'hex').copy(cmd, 10); // peer address

  cmd.writeUInt8(0x00, 16); // own address type

  cmd.writeUInt16LE(0x0028, 17); // min interval
  cmd.writeUInt16LE(0x0038, 19); // max interval
  cmd.writeUInt16LE(0x0000, 21); // latency
  cmd.writeUInt16LE(0x002a, 23); // supervision timeout
  cmd.writeUInt16LE(0x0000, 25); // min ce length
  cmd.writeUInt16LE(0x0000, 27); // max ce length

  bluetoothHciSocket.write(cmd);
}

function writeHandle(handle, data) {
  const cmd = Buffer.alloc(9 + data.length);

  // header
  cmd.writeUInt8(HCI_ACLDATA_PKT, 0);
  cmd.writeUInt16LE(handle, 1);
  cmd.writeUInt16LE(data.length + 4, 3); // data length 1
  cmd.writeUInt16LE(data.length, 5); // data length 2
  cmd.writeUInt16LE(ATT_CID, 7);

  data.copy(cmd, 9);

  bluetoothHciSocket.write(cmd);
}

function disconnectConnection(handle, reason) {
  const cmd = Buffer.alloc(7);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(DISCONNECT_CMD, 1);

  // length
  cmd.writeUInt8(0x03, 3);

  // data
  cmd.writeUInt16LE(handle, 4); // handle
  cmd.writeUInt8(reason, 6); // reason

  bluetoothHciSocket.write(cmd);
}

createConnection('dc:0b:86:95:e8:a5', 'random');
