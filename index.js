const moment = require('moment-timezone')
const db = require('knex')(require('./knexfile.js'))
var CronJob = require('cron').CronJob
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

//A helper function to lock the schedules table
async function lockScheduleRow(){
	try{
		let row = await db.select('status').from('schedules').where('id', '=', parseInt(process.env.SCHEDULE_ID))
		if(row[0]['status'] != 2){
			let lockRow = await db('schedules').where('id', '=', parseInt(process.env.SCHEDULE_ID)).update({status: 2})
			return true
		}
		else{
			return false
		}
	}
	catch(err){
		logger.error("Error in lockScheduleRow: ", err)
		return false
	}
}

//A helper function to unlock the schedules table
async function unlockScheduleRow(){
	try{
		let unlockRow = await db('schedules').where('id', '=', parseInt(process.env.SCHEDULE_ID)).update({status: 1})
	}
	catch(err){
		logger.error("Error in unlockScheduleRow: ", err)
		return false
	}
}

function publishWorkflowPayload(){
	try{
		let tortoise = new Tortoise(`amqp://${process.env.AMQP_USERNAME}:${process.env.AMQP_PASSWORD}@${process.env.AMQP_HOST}:${process.env.AMQP_PORT}`)
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
	logger.debug("currentTime = ", currentTime)
	let scheduleFlags = {minutes: false, hours: false, weekdays: false, days: false, months: false}
	logger.debug("Precheck scheduleFlags = ", scheduleFlags)
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
	logger.debug("Postcheck scheduleFlags = ", scheduleFlags)
	let allFlags = _.values(scheduleFlags)
	logger.debug("allFlags = ", allFlags)
	let reducedFlag = _.every(_.values(allFlags), function(v) {return v})
	logger.debug("reducedFlag = ", reducedFlag)
	if (reducedFlag == true) {
		return true
	}
	else{
		return false
	}
}


new CronJob('* * * * *', function(){
	let scheduleFlagCheck = checkScheduleRules()
	if (scheduleFlagCheck == true) {
		let publisher = publishWorkflowPayload()
		logger.info(`[X] Published workflow ID ${process.env.WORKFLOW_ID}.`)
	}
}, null, true, 'Asia/Kolkata')