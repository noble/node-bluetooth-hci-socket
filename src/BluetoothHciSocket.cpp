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

#define HCI_CHANNEL_RAW   0
#define HCI_CHANNEL_CONTROL 3

#define HCI_DEV_NONE  0xffff

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

typedef struct {
  uint8_t b[6];
} __attribute__((packed)) bdaddr_t;

struct hci_dev_info {
  uint16_t dev_id;
  char     name[8];

  bdaddr_t bdaddr;

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

Nan::Persistent<FunctionTemplate> BluetoothHciSocket::constructor_template;

NAN_MODULE_INIT(BluetoothHciSocket::Init) {
  Nan::HandleScope scope;

  Local<FunctionTemplate> tmpl = Nan::New<FunctionTemplate>(New);
  constructor_template.Reset(tmpl);

  tmpl->InstanceTemplate()->SetInternalFieldCount(1);
  tmpl->SetClassName(Nan::New("BluetoothHciSocket").ToLocalChecked());

  Nan::SetPrototypeMethod(tmpl, "start", Start);
  Nan::SetPrototypeMethod(tmpl, "bindRaw", BindRaw);
  Nan::SetPrototypeMethod(tmpl, "bindControl", BindControl);
  Nan::SetPrototypeMethod(tmpl, "isDevUp", IsDevUp);
  Nan::SetPrototypeMethod(tmpl, "setFilter", SetFilter);
  Nan::SetPrototypeMethod(tmpl, "stop", Stop);
  Nan::SetPrototypeMethod(tmpl, "write", Write);

  target->Set(Nan::New("BluetoothHciSocket").ToLocalChecked(), tmpl->GetFunction());
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

void BluetoothHciSocket::bindRaw(int* devId) {
  struct sockaddr_hci a;

  memset(&a, 0, sizeof(a));
  a.hci_family = AF_BLUETOOTH;
  a.hci_dev = 0; // default
  a.hci_channel = HCI_CHANNEL_RAW;

  if (devId == NULL) {
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

    free(dl);
  } else {
    a.hci_dev = *devId;
  }

  this->_devId = a.hci_dev;

  bind(this->_socket, (struct sockaddr *) &a, sizeof(a));
}

void BluetoothHciSocket::bindControl() {
  struct sockaddr_hci a;

  memset(&a, 0, sizeof(a));
  a.hci_family = AF_BLUETOOTH;
  a.hci_dev = HCI_DEV_NONE;
  a.hci_channel = HCI_CHANNEL_CONTROL;

  bind(this->_socket, (struct sockaddr *) &a, sizeof(a));
}

bool BluetoothHciSocket::isDevUp() {
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
  Nan::HandleScope scope;

  int length = 0;
  char data[1024];

  length = read(this->_socket, data, sizeof(data));

  if (length > 0) {
    Local<Value> argv[2] = {
      Nan::New("data").ToLocalChecked(),
      Nan::CopyBuffer(data, length).ToLocalChecked()
    };

    Nan::MakeCallback(Nan::New<Object>(this->This), Nan::New("emit").ToLocalChecked(), 2, argv);
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
  Nan::HandleScope scope;

  Local<Object> globalObj = Nan::GetCurrentContext()->Global();
  Local<Function> errorConstructor = Local<Function>::Cast(globalObj->Get(Nan::New("Error").ToLocalChecked()));

  Local<Value> constructorArgs[1] = {
    Nan::New(strerror(errno)).ToLocalChecked()
  };

  Local<Value> error = errorConstructor->NewInstance(1, constructorArgs);

  Local<Value> argv[2] = {
    Nan::New("error").ToLocalChecked(),
    error
  };

  Nan::MakeCallback(Nan::New<Object>(this->This), Nan::New("emit").ToLocalChecked(), 2, argv);
}

NAN_METHOD(BluetoothHciSocket::New) {
  Nan::HandleScope scope;

  BluetoothHciSocket* p = new BluetoothHciSocket();
  p->Wrap(info.This());
  p->This.Reset(info.This());
  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(BluetoothHciSocket::Start) {
  Nan::HandleScope scope;

  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(info.This());

  p->start();

  info.GetReturnValue().SetUndefined();
}

NAN_METHOD(BluetoothHciSocket::BindRaw) {
  Nan::HandleScope scope;

  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(info.This());

  int devId = 0;
  int* pDevId = NULL;

  if (info.Length() > 0) {
    Local<Value> arg0 = info[0];
    if (arg0->IsInt32() || arg0->IsUint32()) {
      devId = arg0->IntegerValue();

      pDevId = &devId;
    }
  }

  p->bindRaw(pDevId);

  info.GetReturnValue().SetUndefined();
}

NAN_METHOD(BluetoothHciSocket::BindControl) {
  Nan::HandleScope scope;

  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(info.This());

  p->bindControl();

  info.GetReturnValue().SetUndefined();
}

NAN_METHOD(BluetoothHciSocket::IsDevUp) {
  Nan::HandleScope scope;

  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(info.This());

  bool isDevUp = p->isDevUp();

  info.GetReturnValue().Set(isDevUp);
}

NAN_METHOD(BluetoothHciSocket::SetFilter) {
  Nan::HandleScope scope;

  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(info.This());

  if (info.Length() > 0) {
    Local<Value> arg0 = info[0];
    if (arg0->IsObject()) {
      p->setFilter(node::Buffer::Data(arg0), node::Buffer::Length(arg0));
    }
  }

  info.GetReturnValue().SetUndefined();
}

NAN_METHOD(BluetoothHciSocket::Stop) {
  Nan::HandleScope scope;

  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(info.This());

  p->stop();

  info.GetReturnValue().SetUndefined();
}

NAN_METHOD(BluetoothHciSocket::Write) {
  Nan::HandleScope scope;
  BluetoothHciSocket* p = node::ObjectWrap::Unwrap<BluetoothHciSocket>(info.This());

  if (info.Length() > 0) {
    Local<Value> arg0 = info[0];
    if (arg0->IsObject()) {

      p->write_(node::Buffer::Data(arg0), node::Buffer::Length(arg0));
    }
  }

  info.GetReturnValue().SetUndefined();
}


void BluetoothHciSocket::PollCloseCallback(uv_poll_t* handle) {
  delete handle;
}

void BluetoothHciSocket::PollCallback(uv_poll_t* handle, int status, int events) {
  BluetoothHciSocket *p = (BluetoothHciSocket*)handle->data;

  p->poll();
}

NODE_MODULE(binding, BluetoothHciSocket::Init);
