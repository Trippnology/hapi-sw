const fs = require('node:fs');
const path = require('node:path');
const { generateSW } = require('workbox-build');

const Hoek = require('@hapi/hoek');
const Joi = require('joi');
const configTransformer = require('./lib/config-transformer');

const pkg = require('./package.json');

const internals = {};

internals.routeOptionSchema = Joi.object({
	// Legacy sw-precache options (supported with deprecation warnings)
	dynamicUrlToDependencies: Joi.array().optional(),
	dontCacheBustUrlsMatching: [
		Joi.string().optional(),
		Joi.boolean().optional(),
	],

	// New Workbox options
	templatedURLs: Joi.array().optional(),
	dontCacheBustURLsMatching: [
		Joi.string().optional(),
		Joi.boolean().optional(),
	],

	navigateFallback: Joi.boolean().optional(),
	runtimeCaching: Joi.alternatives().try(
		Joi.object({
			urlPattern: Joi.any().required(),
			handler: Joi.string().valid(
				'networkFirst',
				'cacheFirst',
				'fastest',
				'cacheOnly',
				'networkOnly',
				'NetworkFirst',
				'CacheFirst',
				'StaleWhileRevalidate',
				'CacheOnly',
				'NetworkOnly',
			),
			method: Joi.string()
				.valid('get', 'post', 'put', 'delete', 'head', 'GET', 'POST', 'PUT', 'DELETE', 'HEAD')
				.optional(),
			options: Joi.object().optional(),
		}),
		Joi.array().items(
			Joi.object({
				urlPattern: Joi.any().required(),
				handler: Joi.string().valid(
					'networkFirst',
					'cacheFirst',
					'fastest',
					'cacheOnly',
					'networkOnly',
					'NetworkFirst',
					'CacheFirst',
					'StaleWhileRevalidate',
					'CacheOnly',
					'NetworkOnly',
				),
				method: Joi.string()
					.valid('get', 'post', 'put', 'delete', 'head', 'GET', 'POST', 'PUT', 'DELETE', 'HEAD')
					.optional(),
				options: Joi.object().optional(),
			}),
		),
	).optional(),

	// New Workbox-specific options
	backgroundSync: Joi.object().optional(),
	broadcastUpdate: Joi.object().optional(),
	cacheableResponse: Joi.object().optional(),
	rangeRequests: Joi.boolean().optional(),
	networkTimeoutSeconds: Joi.number().optional(),
});

internals.globalOptionsSchema = Joi.object({
	// Required Workbox options
	globDirectory: Joi.string().optional(),
	swDest: Joi.string().optional(),
	mode: Joi.string().valid('production', 'development').optional(),

	// Legacy sw-precache options (supported with deprecation warnings)
	cacheId: Joi.string().optional(),
	clientsClaim: Joi.boolean().optional(),
	directoryIndex: Joi.string().optional(),
	dontCacheBustUrlsMatching: Joi.string()
		.regex(/^\/.*\//)
		.raw()
	.optional(),
	dynamicUrlToDependencies: Joi.object().optional(),
	handleFetch: Joi.boolean().optional(),
	ignoreUrlParametersMatching: Joi.array().optional(),
	staticFileGlobs: Joi.array().items(Joi.string()).optional(),
	navigateFallbackWhitelist: Joi.array().optional(),
	replacePrefix: Joi.string().optional(),
	stripPrefix: Joi.string().optional(),
	stripPrefixMulti: Joi.object().optional(),
	templateFilePath: Joi.string().optional(),
	verbose: Joi.boolean().optional(),

	// New Workbox options
	globPatterns: Joi.array().items(Joi.string()).optional(),
	templatedURLs: Joi.object().optional(),
	dontCacheBustURLsMatching: Joi.string()
		.regex(/^\/.*\//)
		.raw()
	.optional(),
	navigateFallbackAllowlist: Joi.array().optional(),

	// Common options
	importScripts: Joi.array().items(Joi.string()).optional(),
	maximumFileSizeToCacheInBytes: Joi.number().optional(),
	navigateFallback: Joi.string().optional(),
	skipWaiting: Joi.boolean().optional(),

	// Runtime caching
	runtimeCaching: Joi.array()
		.items(
			Joi.object().keys({
				urlPattern: Joi.any().required(),
				handler: Joi.string().valid(
					'networkFirst',
					'cacheFirst',
					'fastest',
					'cacheOnly',
					'networkOnly',
					'NetworkFirst',
					'CacheFirst',
					'StaleWhileRevalidate',
					'CacheOnly',
					'NetworkOnly',
				),
				method: Joi.string()
					.valid('get', 'post', 'put', 'delete', 'head', 'GET', 'POST', 'PUT', 'DELETE', 'HEAD')
					.optional(),
				options: Joi.object().optional(),
			}),
		)
		.optional(),

	// New Workbox-specific options
	cleanupOutdatedCaches: Joi.boolean().optional(),
	navigationPreload: Joi.boolean().optional(),

	// Custom hapi-sw options
	defaultWorker: Joi.string().optional(),
});

internals.mergeOptions = (key, value, route) => {
	let result = {};
	switch (key) {
		case 'dynamicUrlToDependencies':
		case 'templatedURLs':
			result['templatedURLs'] = {};
			result['templatedURLs'][route.path] = value;
			break;
		case 'dontCacheBustUrlsMatching':
		case 'dontCacheBustURLsMatching':
			if (value === true) {
				result['dontCacheBustURLsMatching'] = [new RegExp(route.path)];
			} else {
				result['dontCacheBustURLsMatching'] = value;
			}
			break;
		case 'runtimeCaching':
			// Transform handler names if needed
			if (Array.isArray(value)) {
				result['runtimeCaching'] = value.map(rule => ({
					...rule,
					handler: configTransformer.transformHandlerName(rule.handler),
				}));
			} else {
				result['runtimeCaching'] = [{
					...value,
					handler: configTransformer.transformHandlerName(value.handler),
				}];
			}
			break;
		default:
			result = false;
			break;
	}
	return result;
};

internals.reduceRouteConfig = (settings, route) =>
	Object.keys(settings)
		.map((key) => internals.mergeOptions(key, settings[key], route))
		.filter((param) => Boolean(param))
		.reduce((result, value, key) => {
			return Object.assign(result, value);
		}, {});

const plugin = {
	name: 'sw',
	version: pkg.version,
	register: async (server, options) => {
		// Check for deprecated options and issue warnings
		const deprecationWarnings = configTransformer.checkDeprecatedOptions(options);
		if (deprecationWarnings.length > 0) {
			console.warn('hapi-sw deprecation warnings:');
			deprecationWarnings.forEach(warning => console.warn(`  - ${warning}`));
		}

		// Normalize configuration (transform legacy options)
		const normalizedOptions = configTransformer.normalizeConfig(options);

		const { error, value: config } =
			internals.globalOptionsSchema.validate(normalizedOptions);
		if (error) {
			throw error;
		}

		// Set required Workbox options with sensible defaults if not provided
		if (!config.globDirectory) {
			config.globDirectory = process.cwd();
		}
		if (!config.swDest) {
			// Use temp directory in project root
			const tempDir = path.join(process.cwd(), 'temp');
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}
			config.swDest = path.join(tempDir, 'service-worker.js');
		}
		if (!config.mode) {
			config.mode = 'production';
		}

		// Note: defaultWorker was already extracted and deleted from config
		let needsRegeneration = true;
		let worker = '';
		let generatedFilePaths = [];

		function registerRoutes(route) {
			const settings = Joi.attempt(
				route.settings.plugins?.sw,
				internals.routeOptionSchema,
			);
			if (settings) {
				// Normalize route settings (transform legacy options)
				const normalizedSettings = configTransformer.normalizeConfig(settings);
				const routeConfig = internals.reduceRouteConfig(
					normalizedSettings,
					route,
				);
				if (routeConfig) {
					Hoek.merge(config, routeConfig);
					needsRegeneration = true;
				}
			}
		}

		async function generateSw(request, h) {
			if (!needsRegeneration) {
				return worker;
			}

			try {
				// Transform configuration to Workbox format
				const workboxConfig = configTransformer.transformGlobalConfig(config);

				// Add verbose logging if requested
				if (config.verbose) {
					console.log('Generating Workbox service worker with config:', JSON.stringify(workboxConfig, null, 2));
				}

				// Clean up old workbox files before generating new ones
				const swDestDir = path.dirname(workboxConfig.swDest);
				if (fs.existsSync(swDestDir)) {
					const files = fs.readdirSync(swDestDir);
					files.forEach(file => {
						// Remove old workbox-*.js and workbox-*.js.map files
						if (file.startsWith('workbox-') && (file.endsWith('.js') || file.endsWith('.js.map'))) {
							const filePath = path.join(swDestDir, file);
							fs.unlinkSync(filePath);
							if (config.verbose) {
								console.log(`Cleaned up old file: ${file}`);
							}
						}
					});
				}

				// Generate service worker using Workbox
				const { filePaths, count, size, warnings } = await generateSW(workboxConfig);

				// Extract generated file paths for route registration
				const generatedFiles = filePaths.filter(filePath =>
					filePath.endsWith('.js') && !filePath.endsWith('.map')
				);
				generatedFilePaths = generatedFiles.map(filePath => ({
					relativePath: path.basename(filePath),
					absolutePath: filePath
				}));

				// Read the generated service worker file
				const swPath = path.resolve(workboxConfig.swDest);
				worker = fs.readFileSync(swPath, 'utf-8');

				// Log generation results
				if (config.verbose) {
					console.log(`Generated service worker: ${count} files, ${size} bytes`);
					if (warnings.length > 0) {
						console.warn('Workbox warnings:', warnings.join('\n'));
					}
				} else if (warnings.length > 0) {
					console.warn('Workbox generation warnings:', warnings.join('\n'));
				}

				needsRegeneration = false;
				return worker;
			} catch (err) {
				console.error('Workbox generation error:', err.message);
				throw new Error(`Service worker generation failed: ${err.message}`);
			}
		}

		// Ensure @hapi/inert is registered for static file serving
		if (!server.registrations['@hapi/inert']) {
			await server.register(require('@hapi/inert'));
		}

		// Generate service worker files immediately to get filePaths for route registration
		await generateSw();

		// Register fixed /service-worker.js route for backward compatibility
		server.route({
			path: '/service-worker.js',
			method: 'GET',
			options: {
				auth: false,
			},
			handler: (request, h) => {
				return h
					.response(worker)
					.type('application/javascript');
			},
		});

		// Register dynamic routes for workbox runtime files using @hapi/inert
		generatedFilePaths.forEach(({ relativePath, absolutePath }) => {
			// Skip the service worker file itself (already handled above)
			if (relativePath.includes('service-worker') || relativePath.startsWith('.tmp')) {
				return;
			}

			server.route({
				path: `/${relativePath}`,
				method: 'GET',
				options: {
					auth: false,
					files: {
						relativeTo: path.resolve(path.dirname(absolutePath)),
					},
				},
				handler: {
					file: path.basename(absolutePath),
				},
			});
		});

		// Register service worker registration route
		server.route({
			path: '/service-worker-registration.js',
			method: 'GET',
			options: {
				auth: false,
			},
			handler: (request, h) => {
				const registrationPath = require.resolve('./service-worker-registration.js');
				const registrationContent = fs.readFileSync(registrationPath, 'utf-8');
				return h
					.response(registrationContent)
					.type('application/javascript');
			},
		});

		server.events.on('route', registerRoutes);
	},
};
module.exports = plugin;