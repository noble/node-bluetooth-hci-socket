{
  'targets': [
    {
      'target_name': 'binding',
      'conditions': [
        ['OS=="linux"', {
          'sources': [
            'src/HciSocket.cpp'
          ]
        }]
      ],
      "include_dirs" : [
            "<!(node -e \"require('nan')\")"
        ]
    }
  ]
}