#!/usr/bin/env node

/**
 * Pre-bundle OPTIMIZED station data for Cloudflare Workers
 *
 * This creates a minimal version with only essential fields to fit within
 * Cloudflare's bundle size limits.
 */

import {readFileSync, writeFileSync, mkdirSync} from 'fs'
import {join, dirname} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputDir = join(__dirname, '..', 'lib', 'bundled-data')

console.log('🏗️  Building OPTIMIZED station data for Cloudflare Workers...\n')

// Create output directory
mkdirSync(outputDir, {recursive: true})

// Load minimal stations data - only keep essential fields
console.log('📊 Processing db-stations data (optimized)...')
const fullPath = join(__dirname, '..', 'node_modules', 'db-stations', 'full.json')
const fullStationsData = JSON.parse(readFileSync(fullPath, 'utf8'))

// Create minimal version with only essential fields
const minimalStations = fullStationsData.map(station => ({
	id: station.id,
	name: station.name,
	location: station.location,
	weight: station.weight,
	// Include ril100Identifiers for lookup compatibility
	...(station.ril100Identifiers && {ril100Identifiers: station.ril100Identifiers}),
	// Include additionalIds for lookup compatibility
	...(station.additionalIds && {additionalIds: station.additionalIds}),
}))

console.log(`✓ Optimized ${fullStationsData.length} stations (removed address, operator, etc.)`)

// Load autocomplete data (keep as-is, it's smaller)
console.log('\n📊 Processing db-stations-autocomplete data...')
const basePath = join(__dirname, '..', 'node_modules', 'db-stations-autocomplete')

const tokens = JSON.parse(readFileSync(join(basePath, 'tokens.json'), 'utf8'))
const scores = JSON.parse(readFileSync(join(basePath, 'scores.json'), 'utf8'))
const weights = JSON.parse(readFileSync(join(basePath, 'weights.json'), 'utf8'))
const nrOfTokens = JSON.parse(readFileSync(join(basePath, 'nr-of-tokens.json'), 'utf8'))
const originalIds = JSON.parse(readFileSync(join(basePath, 'original-ids.json'), 'utf8'))

console.log(`✓ Loaded autocomplete data`)

// Write optimized modules
console.log('\n📝 Writing optimized modules...')

// Write minimal stations module
const stationsModule = `// Auto-generated OPTIMIZED db-stations data
// Only includes essential fields: id, name, location, weight, ril100Identifiers, additionalIds

const minimalStationsData = ${JSON.stringify(minimalStations, null, 0)};

// Create lookup map by ID (including ril100 and additional IDs)
const createStationLookup = () => {
	const lookup = Object.create(null);
	for (const station of minimalStationsData) {
		lookup[station.id] = station;

		// Add ril100 identifiers as lookup keys
		if (Array.isArray(station.ril100Identifiers)) {
			for (const ril of station.ril100Identifiers) {
				lookup[ril.rilIdentifier] = station;
			}
		}

		// Add additional IDs as lookup keys
		if (Array.isArray(station.additionalIds)) {
			for (const addId of station.additionalIds) {
				lookup[addId] = station;
			}
		}
	}
	return lookup;
};

export const stationsData = minimalStationsData;
export const stationsLookup = createStationLookup();
export const timeModified = new Date('2025-01-01'); // Build time placeholder
`

writeFileSync(join(outputDir, 'db-stations.js'), stationsModule, 'utf8')
console.log(`✓ Wrote lib/bundled-data/db-stations.js`)

// Write autocomplete module
const autocompleteModule = `// Auto-generated db-stations-autocomplete data

export const tokens = ${JSON.stringify(tokens, null, 0)};
export const scores = ${JSON.stringify(scores, null, 0)};
export const weights = ${JSON.stringify(weights, null, 0)};
export const nrOfTokens = ${JSON.stringify(nrOfTokens, null, 0)};
export const originalIds = ${JSON.stringify(originalIds, null, 0)};

export const autocompleteIndex = {
	tokens,
	scores,
	weights,
	nrOfTokens,
	originalIds,
};
`

writeFileSync(join(outputDir, 'db-stations-autocomplete.js'), autocompleteModule, 'utf8')
console.log(`✓ Wrote lib/bundled-data/db-stations-autocomplete.js`)

// Calculate sizes
const minimalSize = (JSON.stringify(minimalStations).length / 1024).toFixed(2)
const autocompleteSize = (JSON.stringify({tokens, scores, weights, nrOfTokens, originalIds}).length / 1024).toFixed(2)
const totalSize = parseFloat(minimalSize) + parseFloat(autocompleteSize)

console.log('\n✅ Build complete!')
console.log(`\n📦 Optimized bundle sizes:`)
console.log(`   - db-stations (minimal): ${minimalSize} KB`)
console.log(`   - db-stations-autocomplete: ${autocompleteSize} KB`)
console.log(`   - Total: ${totalSize.toFixed(2)} KB`)

if (totalSize > 1000) {
	console.log(`\n⚠️  WARNING: Bundle is still ${totalSize.toFixed(2)} KB`)
	console.log(`   This may be too large for Cloudflare Workers (1MB compressed limit)`)
	console.log(`   Consider using Cloudflare KV or D1 for station data instead.`)
} else {
	console.log(`\n✅ Size looks good! Should fit in Cloudflare Workers bundle.`)
}
