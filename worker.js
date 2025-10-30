import {createServerAdapter} from '@whatwg-node/server'
import {createApi} from './api.js'

// Cache the API instance and adapter to reuse across requests
let fetchHandler = null

export default {
	async fetch(request, env, ctx) {
		try {
			// Initialize API once and create adapter
			if (!fetchHandler) {
				const {api} = await createApi(env)

				// Create a fetch handler from the Node.js HTTP server (Express app)
				// The api is an Express app, which we can convert to a fetch handler
				fetchHandler = createServerAdapter(api)
			}

			// Use the adapter to handle the request
			return await fetchHandler(request, env, ctx)
		} catch (error) {
			console.error('Worker error:', error)
			return new Response(JSON.stringify({
				error: error.message || 'Internal Server Error',
				stack: error.stack
			}), {
				status: 500,
				headers: {'Content-Type': 'application/json'},
			})
		}
	},
}
