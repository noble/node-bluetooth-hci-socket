#include <errno.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

#include <node_buffer.h>
#include <nan.h>

#include "HciSocket.h"

#define BTPROTO_HCI 1
#define SOL_HCI   0
#define HCI_FILTER  2

struct sockaddr_hci {
  sa_family_t     hci_family;
  unsigned short  hci_dev;
  unsigned short  hci_channel;
};

using namespace v8;
using v8::FunctionTemplate;

static v8::Persistent<v8::FunctionTemplate> s_ct;

void HciSocket::Init(v8::Handle<v8::Object> target) {
  NanScope();

  v8::Local<v8::FunctionTemplate> t = NanNew<v8::FunctionTemplate>(HciSocket::New);

  NanAssignPersistent(s_ct, t);

  NanNew(s_ct)->SetClassName(NanNew("HciSocket"));

  NanNew(s_ct)->InstanceTemplate()->SetInternalFieldCount(1);

  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "start", HciSocket::Start);
  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "filter", HciSocket::Filter);
  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "bind", HciSocket::Bind);
  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "stop", HciSocket::Stop);

  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "write", HciSocket::Write);

  target->Set(NanNew("HciSocket"), NanNew(s_ct)->GetFunction());
}

HciSocket::HciSocket() :
  node::ObjectWrap() {

  this->_socket = socket(AF_BLUETOOTH, SOCK_RAW | SOCK_CLOEXEC, BTPROTO_HCI);

  uv_poll_init(uv_default_loop(), &this->pollHandle, this->_socket);

  this->pollHandle.data = this;
}

HciSocket::~HciSocket() {
  uv_close((uv_handle_t*)&this->pollHandle, (uv_close_cb)HciSocket::PollCloseCallback);

  close(this->_socket);
}

void HciSocket::start() {
  uv_poll_start(&this->pollHandle, UV_READABLE, HciSocket::PollCallback);
}

void HciSocket::filter(char* data, int length) {
  if (setsockopt(this->_socket, SOL_HCI, HCI_FILTER, data, length) < 0) {
    this->emitErrnoError();
  }
}

void HciSocket::bind_() {
  struct sockaddr_hci a;

  memset(&a, 0, sizeof(a));
  a.hci_family = AF_BLUETOOTH;
  a.hci_dev = 0; // TODO: find default device id

  bind(this->_socket, (struct sockaddr *) &a, sizeof(a));
}

void HciSocket::poll() {
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

void HciSocket::stop() {
  uv_poll_stop(&this->pollHandle);
}

void HciSocket::write_(char* data, int length) {
  if (write(this->_socket, data, length) < 0) {
    this->emitErrnoError();
  }
}

void HciSocket::emitErrnoError() {
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

NAN_METHOD(HciSocket::New) {
  NanScope();

  HciSocket* p = new HciSocket();
  p->Wrap(args.This());
  NanAssignPersistent(p->This, args.This());
  NanReturnValue(args.This());
}

NAN_METHOD(HciSocket::Start) {
  NanScope();

  HciSocket* p = node::ObjectWrap::Unwrap<HciSocket>(args.This());

  p->start();

  NanReturnValue (NanUndefined());
}

NAN_METHOD(HciSocket::Filter) {
  NanScope();
  HciSocket* p = node::ObjectWrap::Unwrap<HciSocket>(args.This());

  if (args.Length() > 0) {
    v8::Handle<v8::Value> arg0 = args[0];
    if (arg0->IsObject()) {

      p->filter(node::Buffer::Data(arg0), node::Buffer::Length(arg0));
    }
  }

  NanReturnValue (NanUndefined());
}

NAN_METHOD(HciSocket::Bind) {
  NanScope();

  HciSocket* p = node::ObjectWrap::Unwrap<HciSocket>(args.This());

  p->bind_();

  NanReturnValue (NanUndefined());
}

NAN_METHOD(HciSocket::Stop) {
  NanScope();

  HciSocket* p = node::ObjectWrap::Unwrap<HciSocket>(args.This());

  p->stop();

  NanReturnValue (NanUndefined());
}

NAN_METHOD(HciSocket::Write) {
  NanScope();
  HciSocket* p = node::ObjectWrap::Unwrap<HciSocket>(args.This());

  if (args.Length() > 0) {
    v8::Handle<v8::Value> arg0 = args[0];
    if (arg0->IsObject()) {

      p->write_(node::Buffer::Data(arg0), node::Buffer::Length(arg0));
    }
  }

  NanReturnValue (NanUndefined());
}


void HciSocket::PollCloseCallback(uv_poll_t* handle) {
  delete handle;
}

void HciSocket::PollCallback(uv_poll_t* handle, int status, int events) {
  HciSocket *hciSocket = (HciSocket*)handle->data;

  hciSocket->poll();
}

extern "C" {

  static void init (v8::Handle<v8::Object> target) {
    HciSocket::Init(target);
  }

  NODE_MODULE(binding, init);
}