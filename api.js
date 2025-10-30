import {createClient, loadEnrichedStationData} from 'db-vendo-client'
import {defaultProfile} from 'db-vendo-client/lib/default-profile.js'
import {profile as dbProfile} from 'db-vendo-client/p/db/index.js'
import {profile as dbnavProfile} from 'db-vendo-client/p/dbnav/index.js'
import {profile as dbwebProfile} from 'db-vendo-client/p/dbweb/index.js'
import {createHafasRestApi} from 'hafas-rest-api'
import createHealthCheck from 'hafas-client-health-check'
import {mapRouteParsers} from 'db-vendo-client/lib/api-parsers.js'
import {route as stations} from './routes/stations.js'
import {route as station} from './routes/station.js'
import {parseString} from 'hafas-rest-api/lib/parse.js'
import {enrichStation} from 'db-vendo-client/parse/location.js'
import pkg from './package.json' with { type: 'json' }

const berlinHbf = '8011160'

// Create API with environment configuration
const createApi = async (env = {}) => {
	const stationIndex = await loadEnrichedStationData(defaultProfile);
	const userAgent = env.USER_AGENT || env.HAFAS_USER_AGENT || pkg.name;
	const opt = {
		enrichStations: (ctx, stop) => enrichStation(ctx, stop, stationIndex)
	}
	const profileClients = {
		'db': createClient(dbProfile, userAgent, opt),
		'dbnav': createClient(dbnavProfile, userAgent, opt),
		'dbweb': createClient(dbwebProfile, userAgent, opt),
	}

	const mapRouteParsersWithDynamicProfile = (route, parsers) => {
		return {
			...mapRouteParsers(route, parsers),
			profile: {
				description: 'db-vendo-client profile to use for this request',
				type: 'string',
				default: 'dbnav',
				parse: parseString,
			},
		}
	}

	const profileSwitchingEndpoint = (endpoint) => {
		return (...args) => {
			const opt = args[args.length - 1];
			const p = profileClients[opt.profile] || profileClients.dbnav;
			if (!p.departuresGetPasslist && !opt.stopovers) {
				delete opt.stopovers;
			}
			return p[endpoint](...args);
		}
	}

	let profileSwitchingClient = {
		profile: {
			...defaultProfile,
			locale: 'de-DE',
			timezone: 'Europe/Berlin',
			departuresGetPasslist: true,
		},
		departures: profileSwitchingEndpoint('departures'),
		arrivals: profileSwitchingEndpoint('arrivals'),
		journeys: profileSwitchingEndpoint('journeys'),
		refreshJourney: profileSwitchingEndpoint('refreshJourney'),
		trip: profileSwitchingEndpoint('trip'),
		locations: profileSwitchingEndpoint('locations'),
		stop: profileSwitchingEndpoint('stop'),
		nearby: profileSwitchingEndpoint('nearby')
	}

	// Note: RANDOM_LOCAL_ADDRESSES_RANGE and HAFAS_REQ_RES_LOG_FILE are not supported in Cloudflare Workers
	// These features require Node.js-specific APIs (file system, custom network agents)
	// They can be re-enabled if running in a Node.js environment
	// if (env.RANDOM_LOCAL_ADDRESSES_RANGE) { ... }
	// if (env.HAFAS_REQ_RES_LOG_FILE) { ... }

	let healthCheck = createHealthCheck(profileSwitchingClient, berlinHbf)

	// Redis caching removed for Cloudflare Workers compatibility
	// Cloudflare Workers should use KV or Durable Objects if caching is needed

	const modifyRoutes = (routes, hafas, config) => {
		routes['/stations/:id'] = station
		routes['/stations'] = stations
		return routes
	}

	const config = {
		hostname: env.HOSTNAME || 'localhost',
		port: env.PORT ? parseInt(env.PORT) : 3000,
		name: pkg.name,
		description: pkg.description,
		homepage: pkg.homepage,
		version: pkg.version,
		docsLink: 'https://github.com/derhuerst/db-rest/blob/6/docs/readme.md',
		openapiSpec: true,
		logging: true,
		aboutPage: false,
		etags: 'strong',
		csp: `default-src 'none'; style-src 'self' 'unsafe-inline'; img-src https:`,
		healthCheck,
		mapRouteParsers: mapRouteParsersWithDynamicProfile,
		modifyRoutes,
	}

	// Note: serve-static removed for Cloudflare Workers compatibility
	// Static docs can be served separately via Cloudflare Pages or embedded in responses
	const api = await createHafasRestApi(profileSwitchingClient, config)

	return {
		hafas: profileSwitchingClient,
		config,
		api,
	}
}

export {
	createApi,
}
