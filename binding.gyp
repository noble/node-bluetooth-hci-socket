{
  'targets': [
    {
      'target_name': 'binding',
      'conditions': [
        ['OS=="linux"', {
          'sources': [
            'src/BluetoothHciSocket.cpp'
          ]
        }]
      ],
      "include_dirs" : [
            "<!(node -e \"require('nan')\")"
        ]
    }
  ]
}