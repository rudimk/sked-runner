const moment = require('moment-timezone')
const schedule = require('node-schedule')
const Tortoise = require('tortoise')
const winston = require('winston')

// Define logging options
const tsFormat = () => (new Date()).toISOString()

const logger = new (winston.Logger)({
    transports: [
        // colorize the output to the console
        new (winston.transports.Console)({ timestamp: tsFormat, colorize: true })
    ]
})

logger.level = 'debug'

//const tortoise = new Tortoise(`amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`)

function publishWorkflowPayload(host, port, username, password, exchange, queue, routing_key, payload){
	try{
		let Tortoise = new Tortoise(`amqp://${username}:${password}@${host}:${port}`)
		tortoise.exchange(exchange, 'direct', {durable: false}).publish(routing_key, payload)
		return true
	}
	catch(err){
		logger.error("Error in publishWorkflowPayload: ", err)
		return false
	}
}