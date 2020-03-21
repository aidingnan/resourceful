const net = require('net')

const server = net.createServer(c => {
  // 'connection' listener
  console.log('client connected')
  c.on('data', data => console.log('server recv data', data))
  c.on('end', () => {
    console.log('client disconnected')
  })
  c.write('hello\r\n')
})

server.on('error', (err) => {
  throw err;
})

server.listen(8124, () => {
  console.log('server bound')
})
