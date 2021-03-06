import * as Util from './util.js';
import * as WeatherUtil from './weather_util.js';
import * as Themes from './themes.js';
const DEFAULT_THEME = 'unimplemented';
const DEFAULT_WIND_HEADING_PRECISION = 2;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

export const setSearchError = (string) => {
	$('#search-status').innerHTML = string;
	if(string)
		$('#search-status').classList.add('error');
	else
		$('#search-status').classList.remove('error');
};

export const clearSearchError = () => setSearchError('');

export const clearSearchBox = () => $('input#search').value = '';

export const setPlace = (place) => {
	$('#parsed-query-pretty').innerHTML = 
		`<a class="plain" href="https://google.com/maps/@${place.coordinates.lat},${place.coordinates.long},9z" target="_blank">${place.name.long}</a>`;
	$('title').innerHTML = `Weather: ${place.name.short}`;
};

export const getUnits = () => {
	return $('input[type=radio][name=unit-type]:checked').value;
};

export const setUnits = (units) => {
	let radio = $(`input[type=radio][name=unit-type][value=${units}]`);
	if(radio) {
		radio.checked = true;
		return true;
	}
	return false;
};

export const setTheme = (names) => {
	$('html').classList = names.join(' ');
	names.forEach(name => {
		let styleLink = $(`link[disabled][rel=stylesheet][name=${name}]`);
		if(styleLink) styleLink.disabled = false;
	});
	let themeColor = $('meta[name=theme-color]');
	themeColor.content =
		window.getComputedStyle(themeColor).backgroundColor;
};

export const populate = (forecast) => {
	// take note of which days the user has open
	let expansionStates = Util.getDayExpansionStates();

	$('#overview-container').innerHTML = '';
	let dayIndex = 0;
	const units = getUnits();
	const tempUnit = WeatherUtil.getTempUnit(units);
	const speedUnit = WeatherUtil.getSpeedUnit(units);

	Object.keys(forecast).forEach(day => {
		const summary = forecast[day].shift();
		let overview = 
`	<li class="day-overview">
		<input type="checkbox" id="day${dayIndex}" class="hidden day-expansion" />
		<label for="day${dayIndex}" class="day-overview">
			<span class="relative-day">${day}</span>
			<span class="weather-data">
				<span class="condition">
					${WeatherUtil.getIcon(summary)}
					<span class="condition-caption">${summary.weather.short}</span>
				</span>
				<span class="temp-wind-container">
					<span class="temp">${summary.weather.temp}&nbsp;${tempUnit}</span>
					<span class="wind">${summary.weather.wind.speed}&nbsp;${speedUnit}</span>
				</span>
			</span>
		</label>
		<ul class="plain day-breakdown">
`;

		forecast[day].forEach(record => {
			overview +=
`			<li class="period-breakdown">
				<span class="time">${Util.getReadableTime(record.time.timestamp)}</span>
				<span class="weather-data">
					<span class="condition">
						<span class="reset-font-size">
							${WeatherUtil.getIcon(record)}
						</span>
						<span class="condition-caption">${Util.capitalizeFirst(record.weather.short)}</span>
					</span>
					<span class="temp-wind-container">
						<span class="temp">${record.weather.temp}&nbsp;${tempUnit}</span>
						<span class="wind">${record.weather.wind.speed}&nbsp;${speedUnit}&nbsp;${WeatherUtil.convertAzimuthToCardinal(record.weather.wind.heading, DEFAULT_WIND_HEADING_PRECISION)}</span>
					</span>
				</span>
			</li>
`;
		});

		overview += 
`		</ul>
	</li>
`;

		$('#overview-container').innerHTML += overview;
		dayIndex += 1;
	});

	// restore any days the user had open before
	Util.setDayExpansionStates(expansionStates);
};

export const getAllInput = () => {
	return [
		$('input#search').value.toLocaleLowerCase() || $('input#search').dataset.lastValue,
		getUnits()
	];
};

export const savePlace = (place) => {
	$('input#search').dataset.lastValue = place;
};

export const getLastPlace = () => {
	return $('input#search').dataset.lastValue;
};

export const init = (options) => {

	const defaults = {
		onEnter: console.log,
		onSelectUnits: console.log,
		onType: () => {},
		onHoverUnits: () => {}
	};
	const o = Object.assign({}, defaults, options);

	if(o.onEnter)
	$('input#search').addEventListener('keypress', (evt) => {
		if(evt.key === 'Enter') {
			o.onEnter(...getAllInput());
			clearSearchBox();
		}
	});

	if(o.onType)
	$('input#search').addEventListener('input', (evt) => {
		o.onType(...getAllInput());
	});

	if(o.onSelectUnits)
	$$('input[name=unit-type]').forEach(radio => {
		radio.addEventListener('change', (evt) => {
			o.onSelectUnits(getLastPlace(), getAllInput()[1]);
		});
	});

	if(o.onHoverUnits)
	$$('input[name=unit-type] + label').forEach(label => {
		label.addEventListener('mouseover', (evt) => {
			o.onHoverUnits(getLastPlace(), $('#'+label.htmlFor).value);
		});
	});

	Themes.init();
};
