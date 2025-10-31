import {createApi} from './api.js'

// Cache the API instance to reuse across requests
let apiInstance = null

// Manual Express-to-Workers adapter
function expressToWorkers(expressApp) {
	return async (request) => {
		return new Promise((resolve, reject) => {
			const url = new URL(request.url)

			// Filter out Accept-Encoding header to prevent compression
			// Cloudflare handles compression automatically at the edge
			const headers = Object.fromEntries(request.headers)
			delete headers['accept-encoding']

			// Create mock Node.js request
			const nodeReq = {
				method: request.method,
				url: url.pathname + url.search,
				headers: headers,
				// Express expects these
				httpVersion: '1.1',
				httpVersionMajor: 1,
				httpVersionMinor: 1,
			}

			// Create mock Node.js response
			const chunks = []
			const nodeRes = {
				statusCode: 200,
				statusMessage: 'OK',
				headers: {},
				finished: false,
				headersSent: false,

				setHeader(name, value) {
					this.headers[name.toLowerCase()] = String(value)
				},
				getHeader(name) {
					return this.headers[name.toLowerCase()]
				},
				removeHeader(name) {
					delete this.headers[name.toLowerCase()]
				},
				hasHeader(name) {
					return name.toLowerCase() in this.headers
				},

				writeHead(statusCode, statusMessage, headers) {
					this.statusCode = statusCode
					if (typeof statusMessage === 'object') {
						headers = statusMessage
					} else if (statusMessage) {
						this.statusMessage = statusMessage
					}
					if (headers) {
						Object.entries(headers).forEach(([k, v]) => this.setHeader(k, v))
					}
					this.headersSent = true
				},

				write(chunk) {
					chunks.push(Buffer.from(chunk))
				},

				end(chunk) {
					if (chunk) {
						chunks.push(Buffer.from(chunk))
					}
					this.finished = true

					const body = chunks.length > 0 ? Buffer.concat(chunks) : ''
					resolve(new Response(body, {
						status: this.statusCode,
						statusText: this.statusMessage,
						headers: this.headers,
					}))
				},
			}

			// Handle the request with Express
			try {
				expressApp(nodeReq, nodeRes)
			} catch (error) {
				reject(error)
			}
		})
	}
}

export default {
	async fetch(request, env, ctx) {
		try {
			// Initialize API once
			if (!apiInstance) {
				const {api} = await createApi(env)
				apiInstance = expressToWorkers(api)
			}

			// Handle the request
			return await apiInstance(request)
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
