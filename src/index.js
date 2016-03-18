'use strict';

const request = require('request');
const _ = require('lodash');
const ical = require('ical');
const moment = require('moment');
const sf = require('sf');
const validator = require('validator');
const scrapingUtils = require('cause-utils/dist/scraping');


function formatOrganizer(orga) {
	return orga.params
		.map((item) => {
			return item.replace('CN=', '');
		})
		.join(', ');
}


function formatDate(d) {
	const format = 'DD-MM-YYYY, HH:mm';
	let m = moment(d);
	if (m.isValid()) {
		return m.format(format);
	} else {
		m = moment(d, 'YYYYMMDD');
		if (m.isValid()) {
			return m.format(format);
		}
	}
	return d;
}


function processEvent(e) {
	// console.log(formatOrganizer(e.organizer));
	// console.log(e.description.substr(0, 100), '...');
	// console.log(moment(e.start).format());

	e = {
		organizer: formatOrganizer(e.organizer),
		summary: e.summary,
		description: e.description,
		location: e.location,
		class: e.class,
		url: e.url,
		start: e.start,
		end: e.end,
	};

	e.html = [
		sf('<a href="{url}"><h3>{summary}</h3></a>', e),
		sf('start: <b>{0}</b><br>', formatDate(e.start)),
		sf('end: <b>{0}</b><br>', formatDate(e.end)),
		sf('{0}', e.description.replace(/\n/ig, '<br>')),
		'<hr><br>'
	].join('');

	return e;
}


function main(step, context, config, input, done) {
	// validation
	if (!validator.isURL(config.url)) {
		throw new Error(`not a valid url: ${config.url}`);
	}

	const reqOpts = _.defaults(
		{ url: config.url },
		scrapingUtils.requestDefaults()
	);
	const req = request(reqOpts, (err, res, body) => {
		if (err) { return done(err); }

		if (res.statusCode !== 200) {
			const msg = `status code: ${res.statusCode}`;
			context.debug(msg, context.task.name);
			context.debug(reqOpts.url);
			return done(new Error(msg));
		}

		const events = ical.parseICS(body);
		const currentEvents = [];
		const newItems = {};
		_.keys(events).forEach((key) => {
			if (step.data.seenEvents.indexOf(key) < 0) {
				const e = processEvent(events[key]);
				newItems[key] = e;
			}
			currentEvents.push(key);
		});

		const newItemsArray = _.values(newItems);
		const newOnesExist = (newItemsArray.length > 0);
		const output = newItemsArray;
		done(null, output, newOnesExist);

		step.data.seenEvents = currentEvents;
		context.saveTask();
	}).on('error', (err) => {
		done(err);
	});
}


module.exports = {
	formatDate, formatOrganizer,
	main,
	defaults: {
		config: {},
		data: {
			seenEvents: []
		},
		description: 'new ical event'
	}
};
