#!/usr/bin/env node

// Fix db-vendo-client JSON import syntax for Cloudflare Workers compatibility
// Replaces "import ... with { type: 'json' }" with "import ... assert { type: 'json' }"

import {readFileSync, writeFileSync} from 'fs'
import {join, dirname} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const filesToFix = [
	'node_modules/db-vendo-client/p/db/index.js',
	'node_modules/db-vendo-client/p/dbnav/index.js',
	'node_modules/db-vendo-client/p/dbweb/index.js',
]

let fixed = 0
let errors = 0

for (const file of filesToFix) {
	try {
		const filePath = join(__dirname, '..', file)
		let content = readFileSync(filePath, 'utf8')

		// Replace "with { type: 'json' }" with "assert { type: 'json' }"
		const newContent = content.replace(
			/with\s*{\s*type:\s*['"]json['"]\s*}/g,
			"assert { type: 'json' }"
		)

		if (content !== newContent) {
			writeFileSync(filePath, newContent, 'utf8')
			console.log(`✓ Fixed: ${file}`)
			fixed++
		}
	} catch (err) {
		console.error(`✗ Error fixing ${file}:`, err.message)
		errors++
	}
}

if (fixed > 0) {
	console.log(`\n✓ Fixed ${fixed} file(s) for Cloudflare Workers compatibility`)
}
if (errors > 0) {
	console.error(`\n✗ ${errors} error(s) occurred`)
	process.exit(1)
}
