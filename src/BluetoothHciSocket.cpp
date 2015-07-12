#include <errno.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

#include <node_buffer.h>
#include <nan.h>

#include "BluetoothHciSocket.h"

#define BTPROTO_HCI 1
#define SOL_HCI   0
#define HCI_FILTER  2

#define HCIGETDEVLIST _IOR('H', 210, int)
#define HCIGETDEVINFO _IOR('H', 211, int)

#define HCI_MAX_DEV 16

enum {
  HCI_UP,
  HCI_INIT,
  HCI_RUNNING,

  HCI_PSCAN,
  HCI_ISCAN,
  HCI_AUTH,
  HCI_ENCRYPT,
  HCI_INQUIRY,

  HCI_RAW,
};

struct sockaddr_hci {
  sa_family_t     hci_family;
  unsigned short  hci_dev;
  unsigned short  hci_channel;
};

struct hci_dev_req {
  uint16_t dev_id;
  uint32_t dev_opt;
};

struct hci_dev_list_req {
  uint16_t dev_num;
  struct hci_dev_req dev_req[0];
};


struct hci_dev_info {
  uint16_t dev_id;
  char     name[8];

  char     bdaddr[6];

  uint32_t flags;
  uint8_t  type;

  uint8_t  features[8];

  uint32_t pkt_type;
  uint32_t link_policy;
  uint32_t link_mode;

  uint16_t acl_mtu;
  uint16_t acl_pkts;
  uint16_t sco_mtu;
  uint16_t sco_pkts;

  // hci_dev_stats
  uint32_t err_rx;
  uint32_t err_tx;
  uint32_t cmd_tx;
  uint32_t evt_rx;
  uint32_t acl_tx;
  uint32_t acl_rx;
  uint32_t sco_tx;
  uint32_t sco_rx;
  uint32_t byte_rx;
  uint32_t byte_tx;
};

using namespace v8;
using v8::FunctionTemplate;

static v8::Persistent<v8::FunctionTemplate> s_ct;

void BluetoothHciSocket::Init(v8::Handle<v8::Object> target) {
  NanScope();

  v8::Local<v8::FunctionTemplate> t = NanNew<v8::FunctionTemplate>(BluetoothHciSocket::New);

  NanAssignPersistent(s_ct, t);

  NanNew(s_ct)->SetClassName(NanNew("BluetoothHciSocket"));

  NanNew(s_ct)->InstanceTemplate()->SetInternalFieldCount(1);

  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "start", BluetoothHciSocket::Start);
  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "bind", BluetoothHciSocket::Bind);
  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "isDevUp", BluetoothHciSocket::IsDevUp);
  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "setFilter", BluetoothHciSocket::SetFilter);
  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "stop", BluetoothHciSocket::Stop);

  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "write", BluetoothHciSocket::Write);

  target->Set(NanNew("BluetoothHciSocket"), NanNew(s_ct)->GetFunction());
}

BluetoothHciSocket::BluetoothHciSocket() :
  node::ObjectWrap() {

  this->_socket = socket(AF_BLUETOOTH, SOCK_RAW | SOCK_CLOEXEC, BTPROTO_HCI);

  uv_poll_init(uv_default_loop(), &this->_pollHandle, this->_socket);

  this->_pollHandle.data = this;
}

BluetoothHciSocket::~BluetoothHciSocket() {
  uv_close((uv_handle_t*)&this->_pollHandle, (uv_close_cb)BluetoothHciSocket::PollCloseCallback);

  close(this->_socket);
}

void BluetoothHciSocket::start() {
  uv_poll_start(&this->_pollHandle, UV_READABLE, BluetoothHciSocket::PollCallback);
}

void BluetoothHciSocket::bind_() {
  struct sockaddr_hci a;

  memset(&a, 0, sizeof(a));
  a.hci_family = AF_BLUETOOTH;
  a.hci_dev = 0; // default

  struct hci_dev_list_req *dl;
  struct hci_dev_req *dr;

  dl = (hci_dev_list_req*)calloc(HCI_MAX_DEV * sizeof(*dr) + sizeof(*dl), 1);
  dr = dl->dev_req;

  dl->dev_num = HCI_MAX_DEV;

  if (ioctl(this->_socket, HCIGETDEVLIST, dl) > -1) {
    for (int i = 0; i < dl->dev_num; i++, dr++) {
      if (dr->dev_opt & (1 << HCI_UP)) {
        // choose the first device that is up
        // later on, it would be good to also HCIGETDEVINFO and check the HCI_RAW flag
        a.hci_dev = dr->dev_id;
        break;
      }
    }
  }

  this->_devId = a.hci_dev;

  bind(this->_socket, (struct sockaddr *) &a, sizeof(a));
}

bool  BluetoothHciSocket::isDevUp() {
  struct hci_dev_info di;
  bool isUp = false;

  memset(&di, 0x00, sizeof(di));
  di.dev_id = this->_devId;

  if (ioctl(this->_socket, HCIGETDEVINFO, (void *)&di) > -1) {
    isUp = (di.flags & (1 << HCI_UP)) != 0;
  }

  return isUp;
}

void BluetoothHciSocket::setFilter(char* data, int length) {
  if (setsockopt(this->_socket, SOL_HCI, HCI_FILTER, data, length) < 0) {
    this->emitErrnoError();
  }
}

void BluetoothHciSocket::poll() {
  int length = 0;
  char data[1024];

  length = read(this->_socket, data, sizeof(data));

  if (length > 0) {
    Local<Object> slowBuffer = NanNewBufferHandle(data, length);
    v8::Handle<v8::Object> globalObj = NanGetCurrentContext()->Global();
    v8::Handle<v8::Function> bufferConstructor = v8::Local<v8::Function>::Cast(globalObj->Get(NanNew<String>("Buffer")));

    v8::Handle<v8::Value> constructorArgs[3] = {
      slowBuffer,
      NanNew<Integer>(length),
      NanNew<Integer>(0)
    };

    v8::Handle<v8::Value> buffer = bufferConstructor->NewInstance(3, constructorArgs);

    v8::Handle<v8::Value> argv[2] = {
      NanNew<String>("data"),
      buffer
    };

    NanMakeCallback(NanNew<v8::Object>(this->This), NanNew("emit"), 2, argv);
  }
}

void BluetoothHciSocket::stop() {
  uv_poll_stop(&this->_pollHandle);
}

void BluetoothHciSocket::write_(char* data, int length) {
  if (write(this->_socket, data, length) < 0) {
    this->emitErrnoError();
  }
}

void BluetoothHciSocket::emitErrnoError() {
  v8::Handle<v8::Object> globalObj = NanGetCurrentContext()->Global();
  v8::Handle<v8::Function> errorConstructor = v8::Local<v8::Function>::Cast(globalObj->Get(NanNew<String>("Error")));

  v8::Handle<v8::Value> constructorArgs[1] = {
    NanNew<String>(strerror(errno))
  };

  v8::Handle<v8::Value> error = errorConstructor->NewInstance(1, constructorArgs);

  v8::Handle<v8::Value> argv[2] = {
    NanNew<String>("error"),
    error
  };

  NanMakeCallback(NanNew<v8::Object>(this->This), NanNew("emit"), 2, argv);
}

NAN_METHOD(BluetoothHciSocket::New) {
  NanScope();

  BluetoothHciSocket* p = new BluetoothHciSocket();
  p->Wrap(args.This());
  NanAssignPersistent(p->This, args.This());
  NanReturnValue(args.This());
}

NAN_METHOD(BluetoothHciSocket::Start) {
  NanScope();

  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(args.This());

  p->start();

  NanReturnValue (NanUndefined());
}

NAN_METHOD(BluetoothHciSocket::Bind) {
  NanScope();

  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(args.This());

  p->bind_();

  NanReturnValue (NanUndefined());
}

NAN_METHOD(BluetoothHciSocket::IsDevUp) {
  NanScope();

  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(args.This());

  bool isDevUp = p->isDevUp();

  NanReturnValue (isDevUp ? NanTrue() : NanFalse());
}

NAN_METHOD(BluetoothHciSocket::SetFilter) {
  NanScope();

  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(args.This());

  if (args.Length() > 0) {
    v8::Handle<v8::Value> arg0 = args[0];
    if (arg0->IsObject()) {
      p->setFilter(node::Buffer::Data(arg0), node::Buffer::Length(arg0));
    }
  }

  NanReturnValue (NanUndefined());
}

NAN_METHOD(BluetoothHciSocket::Stop) {
  NanScope();

  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(args.This());

  p->stop();

  NanReturnValue (NanUndefined());
}

NAN_METHOD(BluetoothHciSocket::Write) {
  NanScope();
  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(args.This());

  if (args.Length() > 0) {
    v8::Handle<v8::Value> arg0 = args[0];
    if (arg0->IsObject()) {

      p->write_(node::Buffer::Data(arg0), node::Buffer::Length(arg0));
    }
  }

  NanReturnValue (NanUndefined());
}


void BluetoothHciSocket::PollCloseCallback(uv_poll_t* handle) {
  delete handle;
}

void BluetoothHciSocket::PollCallback(uv_poll_t* handle, int status, int events) {
  BluetoothHciSocket *p = (BluetoothHciSocket*)handle->data;

  p->poll();
}

extern "C" {

  static void init (v8::Handle<v8::Object> target) {
    BluetoothHciSocket::Init(target);
  }

  NODE_MODULE(binding, init);
}
