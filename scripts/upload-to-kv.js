#!/usr/bin/env node

/**
 * Upload station data to Cloudflare KV
 *
 * This script extracts station data and uploads it to Cloudflare KV
 * for use in Cloudflare Workers. This avoids bundle size limits.
 *
 * Usage:
 *   node scripts/upload-to-kv.js [--namespace-id <id>]
 */

import {readFileSync} from 'fs'
import {join, dirname} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

console.log('📦 Preparing station data for Cloudflare KV...\n')

// Load station data
console.log('📊 Loading db-stations data...')
const fullPath = join(__dirname, '..', 'node_modules', 'db-stations', 'full.json')
const fullStationsData = JSON.parse(readFileSync(fullPath, 'utf8'))

// Create lookup with all identifiers
console.log('🔧 Building station lookup map...')
const stationsLookup = Object.create(null)
let totalKeys = 0

for (const station of fullStationsData) {
	stationsLookup[station.id] = station
	totalKeys++

	if (Array.isArray(station.ril100Identifiers)) {
		for (const ril of station.ril100Identifiers) {
			stationsLookup[ril.rilIdentifier] = station
			totalKeys++
		}
	}

	if (Array.isArray(station.additionalIds)) {
		for (const addId of station.additionalIds) {
			stationsLookup[addId] = station
			totalKeys++
		}
	}
}

console.log(`✓ Created lookup map with ${totalKeys} keys for ${fullStationsData.length} stations`)

// Load autocomplete data
console.log('\n📊 Loading db-stations-autocomplete data...')
const basePath = join(__dirname, '..', 'node_modules', 'db-stations-autocomplete')

const autocompleteData = {
	tokens: JSON.parse(readFileSync(join(basePath, 'tokens.json'), 'utf8')),
	scores: JSON.parse(readFileSync(join(basePath, 'scores.json'), 'utf8')),
	weights: JSON.parse(readFileSync(join(basePath, 'weights.json'), 'utf8')),
	nrOfTokens: JSON.parse(readFileSync(join(basePath, 'nr-of-tokens.json'), 'utf8')),
	originalIds: JSON.parse(readFileSync(join(basePath, 'original-ids.json'), 'utf8')),
}

console.log('✓ Loaded autocomplete data')

// Calculate sizes
const stationsSize = (JSON.stringify(stationsLookup).length / 1024 / 1024).toFixed(2)
const autocompleteSize = (JSON.stringify(autocompleteData).length / 1024).toFixed(2)

console.log(`\n📦 Data sizes:`)
console.log(`   - Stations lookup: ${stationsSize} MB`)
console.log(`   - Autocomplete data: ${autocompleteSize} KB`)

// Save to files for manual KV upload
const outputPath = join(__dirname, '..', 'kv-data')
import {mkdirSync, writeFileSync} from 'fs'
mkdirSync(outputPath, {recursive: true})

writeFileSync(
	join(outputPath, 'stations.json'),
	JSON.stringify(stationsLookup),
	'utf8'
)

writeFileSync(
	join(outputPath, 'autocomplete.json'),
	JSON.stringify(autocompleteData),
	'utf8'
)

console.log(`\n✅ Data prepared and saved to kv-data/`)
console.log(`\nTo upload to Cloudflare KV:`)
console.log(`\n1. Create KV namespaces:`)
console.log(`   npx wrangler kv:namespace create "STATION_DATA"`)
console.log(`   npx wrangler kv:namespace create "STATION_DATA" --preview`)
console.log(`\n2. Update wrangler.toml with the namespace IDs`)
console.log(`\n3. Upload the data:`)
console.log(`   npx wrangler kv:key put --namespace-id=<YOUR_ID> "stations" --path=kv-data/stations.json`)
console.log(`   npx wrangler kv:key put --namespace-id=<YOUR_ID> "autocomplete" --path=kv-data/autocomplete.json`)
console.log(`\n⚠️  Note: Large values (>25MB) need to be split. Stations data is ${stationsSize}MB.`)
console.log(`   If >25MB, we'll need to split into chunks or use a different approach.`)
