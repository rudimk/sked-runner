const moment = require('moment-timezone')
const schedule = require('node-schedule')
const Tortoise = require('tortoise')
const winston = require('winston')
const _ = require('lodash')

// Define logging options
const tsFormat = () => (new Date()).toISOString()

const logger = new (winston.Logger)({
    transports: [
        // colorize the output to the console
        new (winston.transports.Console)({ timestamp: tsFormat, colorize: true })
    ]
})

logger.level = 'debug'

function publishWorkflowPayload(){
	try{
		let Tortoise = new Tortoise(`amqp://${process.env.AMQP_USERNAME}:${process.env.AMQP_PASSWORD}@${process.env.AMQP_HOST}:${process.env.AMQP_PORT}`)
		tortoise.exchange(process.env.AMQP_EXCHANGE, 'direct', {durable: false}).publish(process.env.AMQP_ROUTING_KEY, JSON.parse(process.env.AMQP_PAYLOAD))
		return true
	}
	catch(err){
		logger.error("Error in publishWorkflowPayload: ", err)
		return false
	}
}

function checkScheduleRules(){
	let currentTime = moment.tz(process.env.TIMEZONE)
	let scheduleFlags = {minutes: false, hours: false, weekdays: false, days: false, months: false}
	// Check for minutes
	if (JSON.parse(process.env.MINUTES).length == 0){
		scheduleFlags.minutes = true
	}
	else if (_.includes(JSON.parse(process.env.MINUTES), parseInt(currentTime.format('mm'))) == true) {
		scheduleFlags.minutes = true
	}
	else {
		scheduleFlags.minutes = false
	}
	// Check for hours
	if (JSON.parse(process.env.HOURS).length == 0){
		scheduleFlags.hours = true
	}
	else if (_.includes(JSON.parse(process.env.HOURS), parseInt(currentTime.format('HH'))) == true) {
		scheduleFlags.hours = true
	}
	else {
		scheduleFlags.hours = false
	}
	// Check for weekdays
	if (JSON.parse(process.env.WEEKDAYS).length == 0){
		scheduleFlags.weekdays = true
	}
	else if (_.includes(JSON.parse(process.env.WEEKDAYS), parseInt(currentTime.format('ddd'))) == true) {
		scheduleFlags.weekdays = true
	}
	else {
		scheduleFlags.weekdays = false
	}
	// Check for dates
	if (JSON.parse(process.env.DAYS).length == 0){
		scheduleFlags.days = true
	}
	else if (_.includes(JSON.parse(process.env.DAYS), parseInt(currentTime.format('DD'))) == true) {
		scheduleFlags.days = true
	}
	else {
		scheduleFlags.days = false
	}
	// Check for months
	if (JSON.parse(process.env.MONTHS).length == 0){
		scheduleFlags.months = true
	}
	else if (_.includes(JSON.parse(process.env.MONTHS), parseInt(currentTime.format('MM'))) == true) {
		scheduleFlags.months = true
	}
	else {
		scheduleFlags.months = false
	}
	// If all flags are set to true, return a true - else return false
	let allFlags = _.values(scheduleFlags)
	if (_.includes(allFlags) == true) {
		return true
	}
	else{
		return false
	}
}


var runner = schedule.scheduleJob('*/1 * * * *', function(){
	
})