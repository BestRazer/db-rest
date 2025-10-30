import {readFullStations} from 'db-stations'

// For Cloudflare Workers: Use current time as timeModified since we can't access file stats
// In a production setup, this could be set at build time
const timeModified = new Date()

const pStations = new Promise((resolve, reject) => {
	let raw = readFullStations()
	raw.once('error', reject)

	let data = Object.create(null)
	raw.on('data', (station) => {
		data[station.id] = station
		if (Array.isArray(station.ril100Identifiers)) {
			for (const ril100 of station.ril100Identifiers) {
				data[ril100.rilIdentifier] = station
			}
		}
		if (Array.isArray(station.additionalIds)) {
			for (const addId of station.additionalIds) {
				data[addId] = station
			}
		}
	})
	raw.once('end', () => {
		raw = null
		resolve({data, timeModified})
	})
})

pStations.catch((err) => {
	console.error('Error loading stations:', err)
	// Note: In Cloudflare Workers, errors should be handled gracefully
	// rather than exiting the process
})

export {
	pStations,
}
