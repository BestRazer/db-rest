// Wrapper for db-stations-autocomplete using pre-bundled data
// This avoids the createRequire() issue in Cloudflare Workers

import {createAutocomplete} from 'synchronous-autocomplete'
import tokenize from 'tokenize-db-station-name'
import {autocompleteIndex} from './db-stations-autocomplete.js'

// Create autocomplete function using bundled data
const autocomplete = createAutocomplete(autocompleteIndex, tokenize)

export {
	autocompleteIndex as index,
	autocomplete,
}
