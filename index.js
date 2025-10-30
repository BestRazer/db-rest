import {createApi} from './api.js'

// For Node.js: Use process.env
// For Cloudflare Workers: This file won't be used, use worker.js instead
const env = process.env

const {api, config} = await createApi(env)

api.listen(config.port, (err) => {
	const {logger} = api.locals
	if (err) {
		logger.error(err)
		process.exit(1)
	} else {
		logger.info(`listening on ${config.port} (${config.hostname}).`)
	}
})
