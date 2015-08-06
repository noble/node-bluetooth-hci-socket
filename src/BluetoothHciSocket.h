#ifndef ___BLUETOOTH_HCI_SOCKET_H___
#define ___BLUETOOTH_HCI_SOCKET_H___

#include <node.h>

#include <nan.h>

class BluetoothHciSocket : public node::ObjectWrap {

public:
  static void Init(v8::Handle<v8::Object> target);

  static NAN_METHOD(New);
  static NAN_METHOD(BindRaw);
  static NAN_METHOD(BindControl);
  static NAN_METHOD(BindUser);
  static NAN_METHOD(IsDevUp);
  static NAN_METHOD(SetFilter);
  static NAN_METHOD(Start);
  static NAN_METHOD(Stop);
  static NAN_METHOD(Write);

private:
  BluetoothHciSocket();
  ~BluetoothHciSocket();

  void start();
  void bindRaw(int* devId);
  void bindControl();
  void bindUser();
  bool isDevUp();
  void setFilter(char* data, int length);
  void stop();

  void write_(char* data, int length);

  void poll();

  void emitErrnoError();

  static void PollCloseCallback(uv_poll_t* handle);
  static void PollCallback(uv_poll_t* handle, int status, int events);

private:
  v8::Persistent<v8::Object> This;

  int _socket;
  int _devId;
  uv_poll_t _pollHandle;
};

#endif
