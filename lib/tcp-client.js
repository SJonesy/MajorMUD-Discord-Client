class TCP {
  constructor (options) {
    this.opts = options
    this.socket = require('net')

    this.waiting = false
    this.queue = []
  }

  keepalive(reference) {
    reference.connection.write('l\r')
  }

  async connect () {
    this.connection = this.socket.connect({
      host: this.opts.host,
      port: this.opts.port
    })

    setInterval(this.keepalive, 60000, this )

    this.connection.on('close', () => {
      console.info('Reconnecting..')
      this.connect()
    })

    this.connection.on('error', function(error) {
      console.info('Connection Error (' + error.code + '): ' + error.message)
    })

    this.connection.on('connect', async () => {
      console.info('[SYN] Server Ack Connection Request')
      //sends telnet negoation 
      this.connection.write(Buffer.from([255, 251, 3, 255, 252, 1, 255, 253, 3, 255, 253, 0]))
      console.info('[SYN] Server Recv Handshake Bytes')

      // eslint-disable-next-line unicorn/consistent-function-scoping
      
      //Login Promts
      const authentication = (data) => {
        // Debug by printing all incoming data
        console.info(data.toString('utf8'))

        // Parse prompts to log in to MajorMUD
        if (data.toString('utf8').includes('"new":')) return this.connection.write(`${this.opts.username}\r`)
        if (data.toString('utf8').includes('password:')) return this.connection.write(`${this.opts.password}\r`)
        if (data.toString('utf8').includes('(C)ontinue')) return this.connection.write('C\r')
        if (data.toString('utf8').includes('exit):')) return this.connection.write('M\r=A\r')
        if (data.toString('utf8').includes('Realm')) return this.connection.write('E\r')
        if (data.toString('utf8').includes('[MAJORMUD]:')) return this.connection.write('E\r')
      }
      this.connection.on('data', authentication)

      await this.wait(5)
      return setInterval(this.process, 100, this)
    })
  }

  process (reference) {
    if (reference.waiting) return
    if (reference.queue.length === 0) return

    reference.waiting = true
    const query = reference.queue.shift()
    let buf = ''

    const querier = (data) => {
      buf = buf + data.toString('utf8')
    }

    reference.connection.on('data', querier)
    reference.connection.write(`${query.request}\r`)

    setTimeout((reference2) => {
      reference2.connection.removeListener('data', querier)
      reference2.waiting = false
      const pure = []
      const toptenLine = /.*\[31m.*\[32m.*\[35m.*\[33m.*\[32m.*\[35.*/

      const resp = buf.replace(/[^\u0020-\u007E]+/, '').split('\r\n')
      for (const l in resp) {
        var text = require('strip-ansi')(resp[l])
        text = text.replace('\b \b \b \b', '').trim()
        console.info(l + ': ' + text)
        text = text + '\n'

        // Process Responses
        if (resp[l].includes('telepaths:') && resp[l].includes('{') && resp[l].includes('}')) {
          pure.push(text.split('telepaths:')[1].trim())
        }
        if (resp[l].includes('Top Heroes of the Realm')) {
          pure.push(text.replace('opten[0;37;40m', ''))
        }
        if (resp[l].includes('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=')) {
          pure.push(text)
        }
        if (resp[l].match(toptenLine)) {
          pure.push(text)
        }
      }

      return query.resolve({ original: query, responses: pure })
    }, 2000, reference)
  }

  /**
   * Queues Request for MajorMUD Bot
   *
   * @param {string} command server valid command in `/{user} @{query} {params...}` format
   * @returns {Promise} pending resolution of queue position
   * @memberof TCP
   */
  request (command) {
    return new Promise((resolve) => {
      this.queue.push({ request: command, resolve })
    })
  }

  /**
   * Waits for Timeout to Expire
   *
   * @param {number} seconds number of seconds to wait
   * @returns {Promise} timeout of seconds to wait
   * @memberof TCP
   */
  wait (seconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, seconds * 1000)
    })
  }
}

module.exports = TCP
