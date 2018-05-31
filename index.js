const moment = require('moment-timezone')
const db = require('knex')(require('./knexfile.js'))
const redis = require('redis').createClient(process.env.REDIS_PORT, process.env.REDIS_HOST)
const Redlock = require('redlock')
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

// Initialize redlock
var redlock = new Redlock([redis], {driftFactor: 0.01, retryCount: 0, retryDelay: 0, retryJitter: 0})
const lockResource = `schedule:id:${process.env.SCHEDULE_ID}`
const lockTTL = 55000

/*async function lockScheduleRow(){
	try{
		let row = await db.select('status', 'last_run').from('schedules').where('id', '=', parseInt(process.env.SCHEDULE_ID))
		if (parseInt(row[0]['status']) == 1){
			if (parseInt(row[0]['last_run']) < parseInt(moment.tz(process.env.TIMEZONE).format('mm'))) {
				let lockRow = await db('schedules').where('id', '=', parseInt(process.env.SCHEDULE_ID)).update({status: 2, last_run: parseInt(moment.tz(process.env.TIMEZONE).format('mm'))})
				return true
			}
			else{
				return false
			}
		}
		else{
			return false
		}
	}
	catch(err){
		logger.error("Error in lockScheduleRow: ", err)
		return false
	}
}*/

async function unlockScheduleRow(){
	try{
		let unlockRow = await db('schedules').where('id', '=', parseInt(process.env.SCHEDULE_ID)).update({status: 1})
		return true
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

async function checkScheduleRules(){
	//let lockFlag = await lockScheduleRow()
	redlock.lock(lockResource, lockTTL)
	.then((lock) => {
		db.select('status', 'last_run').from('schedules').where('id', '=', parseInt(process.env.SCHEDULE_ID))
		.then((row) => {
			if (parseInt(row[0]['status']) == 1){
				if (parseInt(row[0]['last_run']) < parseInt(moment.tz(process.env.TIMEZONE).format('mm'))) {
					db('schedules').where('id', '=', parseInt(process.env.SCHEDULE_ID)).update({status: 2, last_run: parseInt(moment.tz(process.env.TIMEZONE).format('mm'))})
					.then((lockRow) => {
						logger.debug("Lock obtained for schedule ID ", process.env.SCHEDULE_ID)
						let currentTime = moment.tz(process.env.TIMEZONE)
						logger.debug("currentTime = ", currentTime.format('DD-MM-YYYY HH:mm:ss ZZ'))
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
							publishWorkflowPayload()
							//let unlock = await unlockScheduleRow()
							db('schedules').where('id', '=', parseInt(process.env.SCHEDULE_ID)).update({status: 1, last_run: parseInt(moment.tz(process.env.TIMEZONE).format('mm'))})
							.then((update) => {
								logger.debug("Unlocking schedule ID ", process.env.SCHEDULE_ID)
								let unlock = lock.unlock()
								return true
							})
						}
						else{
							//let unlock = await unlockScheduleRow()
							db('schedules').where('id', '=', parseInt(process.env.SCHEDULE_ID)).update({status: 1, last_run: parseInt(moment.tz(process.env.TIMEZONE).format('mm'))})
							.then((update) => {
								logger.debug("Unlocking schedule ID ", process.env.SCHEDULE_ID)
								let unlock = lock.unlock()
								return false
							})
						}
					})
				}
			}
			else{
				return false
			}
		})
	})
}


new CronJob('* * * * *', function(){
	checkScheduleRules()
	.then((scheduleFlagCheck) => {
		if (scheduleFlagCheck == true) {
			logger.info("Ran schedule workflow successfully.")
		}
	})
}, null, true, 'Asia/Kolkata')