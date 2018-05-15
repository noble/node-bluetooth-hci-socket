{
  'targets': [
    {
      'target_name': 'bluetooth_hci_socket',
      'conditions': [
        ['OS=="linux" or OS=="android" or OS=="freebsd"', {
          'sources': [
            'src/BluetoothHciSocket.cpp'
          ]
        }]
      ],
      "include_dirs" : [
            "<!(node -e \"require('nan')\")"
        ]
    },
    {
      'target_name': 'action_after_build',
      'type': 'none',
      'dependencies': [ '<(module_name)' ],
      'copies': [
        {
          'files': [ '<(PRODUCT_DIR)/<(module_name).node' ],
          'destination': '<(module_path)'
        }
      ]
    }
  ]
}
