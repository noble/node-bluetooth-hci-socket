{
  'targets': [
    {
      'target_name': 'binding',
      'conditions': [
        ['OS=="linux" or OS=="android"', {
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