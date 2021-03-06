const logger = require('logger').get('API::OpenWeatherMap');
const cache_config = require('./cache_config');

const fetch = cache_config.enabled ? require('./OpenWeatherMapCache') : require('node-fetch');

const api_key = require(require('app-root-path')+'/.env').api_keys.OpenWeatherMap;
const api_base = 'https://api.openweathermap.org/data/2.5';

const process = {

	current: function(data, units) {
		let out = {};
		if(parseInt(data.cod) == 200)
			out = {
				"status": {
					"ok": true,
					"code": parseInt(data.cod),
					"units": units
				},
				"place": {
					"name": {
						"short": data.name,
						"long": data.name
						+ (data.sys.country?', '+data.sys.country:'')
					},
					"coordinates": {
						"lat": data.coord.lat,
						"long": data.coord.lon
					},
				},
				"time": {
					"daytime": /d/.test(data.weather[0].icon),
					"timestamp": data.dt,
					"sunrise": data.sys.sunrise,
					"sunset": data.sys.sunset,
					"timezone": data.timezone
				},
				"weather": {
					"short": data.weather[0].main,
					"long": data.weather[0].description,
					"temp": data.main.temp,
					"wind": {
						"speed": units == 'metric' ? data.wind.speed * 60 * 60 / 1000 : data.wind.speed, // convert SI's m/s to metric's km/h
						"heading": data.wind.deg
					},
					"clouds": data.clouds.all,
					"rain": data.rain ? (data.rain['3h'] || data.rain['1h']) : 0,
					"snow": data.snow ? (data.snow['3h'] || data.snow['1h']) : 0
				}
			};
		else
			out = {
				"status": {
					"ok": false,
					"code": parseInt(data.cod),
					"message": data.message
				}
			};
		return out;
	},

	forecast: function(data, units) {
		let out = {};
		if(parseInt(data.cod) == 200) {
			out = {
				"status": {
					"ok": true,
					"code": parseInt(data.cod),
					"units": units
				},
				"place": {
					"name": {
						"short": data.city.name,
						"long": data.city.name
						+ (data.city.country?', '+data.city.country:'')
					},
					"coordinates": {
						"lat": data.city.coord.lat,
						"long": data.city.coord.lon
					},
				},
				"time": {
					"sunrise": data.city.sunrise,
					"sunset": data.city.sunset,
					"timezone": data.city.timezone
				},
				"weather": []
			};
			data.list.forEach(record => {
				out.weather.push({
					"time": {
						"timestamp": record.dt
					},
					"weather": {
						"short": record.weather[0].main,
						"long": record.weather[0].description,
						"temp": record.main.temp,
						"wind": {
							"speed": units == 'metric' ? record.wind.speed * 60 * 60 / 1000 : record.wind.speed, // convert SI's m/s to metric's km/h
							"heading": record.wind.deg
						},
						"clouds": record.clouds.all,
						"rain": record.rain ? record.rain['3h'] : 0,
						"snow": record.snow ? record.snow['3h'] : 0
					}
				});
			});
		}
		else
			out = {
				"status": {
					"ok": false,
					"code": parseInt(data.cod),
					"message": data.message
				}
			};
		return out;
	}

};

const get = {

	by_query: async function(query, units='SI', window=null) {

		let branch = null;
		switch(window) {
			case 'current':
			case 'weather':
				window = 'current';
				branch = 'weather';
				break;
			case 'forecast':
				branch = 'forecast';
				break;
		}

		if(branch) {
			query = [query];
			switch(units.toLocaleLowerCase()) {
				case 'imperial':
				case 'us':
				case 'f':
				case 'fahrenheit':
					query.push('units=imperial');
					units = 'imperial';
					break;
				case 'metric':
				case 'uk':
				case 'eu':
				case 'c':
				case 'celsius':
				case 'centigrade':
					query.push('units=metric');
					units = 'metric';
					break;
				default:
					units = 'si';
			}
			query.push(`appid=${api_key}`);

			let url = `${api_base}/${branch}?${query.join('&')}`;
			return fetch(url)
				.then(res => res.json())
				.then(data => process[window](data, units));
		} else {
			let current  = await this.by_query(query, units, 'current');
			if(current.status.code >= 400) {
				return {
					"status": current.status,
					"time": {
						"timestamp": parseInt(new Date().getTime()/1000)
					}
				};
			}
			let forecast = await this.by_query(query, units, 'forecast');
			let status = current.status;
			let place = current.place;
			let time = {
				timestamp: parseInt(new Date().getTime()/1000),
				timezone: current.time ? current.time.timezone : undefined
			};
			return {
				status,
				place,
				time,
				current,
				forecast
			};
		}
	},

	by_name: async function(name, units='SI', window=null) {
		// The goal here is to take input like `Salt Lake City UT US'
		// and turn it into `Salt+Lake+City,UT,US`
		let plusParts = name.split(/ +/);
		let commaParts = [];
		if(plusParts.length) {
			let end = plusParts.pop();
			if(/^[a-z]{2}$/i.test(end)) {
				commaParts.unshift(end);
				if(plusParts.length) {
					let end = plusParts.pop();
					if(/^[a-z]{2}$/i.test(end)) {
						commaParts.unshift(end);
					} else plusParts.push(end);
				}
			} else plusParts.push(end);
		}
		commaParts.unshift(plusParts.join('+'));
		name = commaParts.join(',');
		return this.by_query(`q=${name}`, units, window);
	},

	by_zip: async function(zip, units='SI', window=null) {
		return this.by_query(`zip=${zip}`, units, window);
	},

	by_coordinates: async function(lat, long, units='SI', window=null) {
		return this.by_query(`lat=${lat}&lon=${long}`, units, window);
	},

	by_guessing: async function(string, units='SI', window=null) {
		if(/^-?\d+(?:.\d+)?,\s*-?\d+(?:.\d+)?$/.test(string))
			return this.by_coordinates(...string.match(/-?\d+(?:\.\d+)?/g), units, window);
		if(/\d{5}/.test(string))
			return this.by_zip(string, units, window);
		return this.by_name(string, units, window);
	}
};

module.exports = { get, process };
