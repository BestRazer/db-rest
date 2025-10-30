import {createApi} from './api.js'

// Cache the API instance to reuse across requests
let apiInstance = null

export default {
	async fetch(request, env, ctx) {
		try {
			// Initialize API once and reuse it
			if (!apiInstance) {
				apiInstance = await createApi(env)
			}

			const {api} = apiInstance

			// Convert Cloudflare Workers Request to a format compatible with the API
			// The hafas-rest-api library expects a Node.js-like request/response
			// We need to adapt it to work with Cloudflare Workers

			// Create a minimal Node.js-like request object
			const url = new URL(request.url)
			const nodeRequest = {
				method: request.method,
				url: url.pathname + url.search,
				headers: Object.fromEntries(request.headers),
				query: Object.fromEntries(url.searchParams),
			}

			// For POST/PUT requests, add the body
			if (request.method !== 'GET' && request.method !== 'HEAD') {
				const contentType = request.headers.get('content-type')
				if (contentType?.includes('application/json')) {
					nodeRequest.body = await request.json()
				} else {
					nodeRequest.body = await request.text()
				}
			}

			// Create a promise to capture the response
			return new Promise((resolve) => {
				const chunks = []
				const nodeResponse = {
					statusCode: 200,
					headers: {},
					setHeader: (name, value) => {
						nodeResponse.headers[name.toLowerCase()] = value
					},
					getHeader: (name) => nodeResponse.headers[name.toLowerCase()],
					write: (chunk) => {
						chunks.push(chunk)
					},
					end: (chunk) => {
						if (chunk) chunks.push(chunk)

						// Combine all chunks
						let body
						if (chunks.length > 0) {
							if (Buffer.isBuffer(chunks[0])) {
								body = Buffer.concat(chunks)
							} else {
								body = chunks.join('')
							}
						} else {
							body = ''
						}

						// Create Cloudflare Workers Response
						const responseInit = {
							status: nodeResponse.statusCode || 200,
							headers: nodeResponse.headers,
						}

						resolve(new Response(body, responseInit))
					},
					// Additional methods that might be called
					on: () => {},
					once: () => {},
					emit: () => {},
					removeListener: () => {},
				}

				// Mock request object extensions
				Object.assign(nodeRequest, {
					accepts: (types) => {
						const acceptHeader = request.headers.get('accept') || ''
						if (Array.isArray(types)) {
							for (const type of types) {
								if (acceptHeader.includes(type)) return type
							}
							return false
						}
						return acceptHeader.includes(types) ? types : false
					},
					get: (header) => request.headers.get(header),
					on: () => {},
					once: () => {},
					emit: () => {},
					removeListener: () => {},
				})

				// Try to handle the request with the API
				// The hafas-rest-api uses Express-like middleware
				// We need to find the appropriate route handler
				try {
					// Call the API's handler directly if possible
					// This is a simplified approach - the actual implementation
					// depends on how hafas-rest-api exposes its routing
					if (typeof api === 'function') {
						api(nodeRequest, nodeResponse)
					} else if (api.handle) {
						api.handle(nodeRequest, nodeResponse)
					} else if (api.callback) {
						api.callback()(nodeRequest, nodeResponse)
					} else {
						// Fallback: return error
						resolve(new Response('API handler not found', {status: 500}))
					}
				} catch (error) {
					console.error('Error handling request:', error)
					resolve(new Response(error.message || 'Internal Server Error', {
						status: 500,
						headers: {'Content-Type': 'text/plain'},
					}))
				}
			})
		} catch (error) {
			console.error('Worker error:', error)
			return new Response(error.message || 'Internal Server Error', {
				status: 500,
				headers: {'Content-Type': 'text/plain'},
			})
		}
	},
}
