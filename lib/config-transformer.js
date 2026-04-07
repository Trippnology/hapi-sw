'use strict';

const Hoek = require('@hapi/hoek');

const internals = {
	deprecatedOptions: {
		'staticFileGlobs': 'globPatterns',
		'dynamicUrlToDependencies': 'templatedURLs',
		'navigateFallbackWhitelist': 'navigateFallbackAllowlist',
		'dontCacheBustUrlsMatching': 'dontCacheBustURLsMatching',
	},
	handlerNameMap: {
		'networkFirst': 'NetworkFirst',
		'cacheFirst': 'CacheFirst',
		'fastest': 'StaleWhileRevalidate',
		'cacheOnly': 'CacheOnly',
		'networkOnly': 'NetworkOnly',
	},
};

/**
 * Transform sw-precache configuration to Workbox format
 * @param {Object} swConfig - sw-precache configuration object
 * @returns {Object} Workbox configuration object
 */
internals.transformGlobalConfig = (swConfig) => {
	const workboxConfig = {
		// Required Workbox options
		globDirectory: swConfig.globDirectory || process.cwd(),
		swDest: swConfig.swDest || '/tmp/service-worker.js',
		mode: swConfig.mode || 'production',

		// Direct mappings
		globPatterns: internals.transformGlobPatterns(swConfig.staticFileGlobs),
		templatedURLs: internals.transformTemplatedURLs(swConfig.dynamicUrlToDependencies),
		dontCacheBustURLsMatching: swConfig.dontCacheBustURLsMatching || swConfig.dontCacheBustUrlsMatching,
		navigateFallback: swConfig.navigateFallback,
		navigateFallbackAllowlist: swConfig.navigateFallbackAllowlist || swConfig.navigateFallbackWhitelist,
		maximumFileSizeToCacheInBytes: swConfig.maximumFileSizeToCacheInBytes,
		skipWaiting: swConfig.skipWaiting || false,
		clientsClaim: swConfig.clientsClaim || false,

		// Complex transformations
		runtimeCaching: internals.transformRuntimeCaching(swConfig.runtimeCaching),
		importScripts: swConfig.importScripts,

		// New Workbox options with sensible defaults
		cleanupOutdatedCaches: swConfig.cleanupOutdatedCaches !== false,
		ignoreURLParametersMatching: swConfig.ignoreUrlParametersMatching || [/^utm_/, /^fbclid$/],
		navigationPreload: swConfig.navigationPreload || false,

		// Note: custom hapi-sw options like 'defaultWorker' are handled separately
	// and not passed to Workbox
	};

	// Handle templateFilePath - convert to importScripts
	if (swConfig.templateFilePath) {
		workboxConfig.importScripts = workboxConfig.importScripts || [];
		workboxConfig.importScripts.push(swConfig.templateFilePath);
	}

	return workboxConfig;
};

/**
 * Transform static file glob patterns
 * @param {Array} staticFileGlobs - sw-precache staticFileGlobs
 * @returns {Array} Workbox globPatterns
 */
internals.transformGlobPatterns = (staticFileGlobs) => {
	if (!staticFileGlobs) {
		return ['**/*.{js,css,html}'];
	}
	return staticFileGlobs;
};

/**
 * Transform dynamic URL dependencies to templated URLs
 * @param {Object} dynamicUrlToDependencies - sw-precache dynamicUrlToDependencies
 * @returns {Object} Workbox templatedURLs
 */
internals.transformTemplatedURLs = (dynamicUrlToDependencies) => {
	if (!dynamicUrlToDependencies) {
		return undefined;
	}

	const templatedURLs = {};
	for (const [url, dependencies] of Object.entries(dynamicUrlToDependencies)) {
		if (Array.isArray(dependencies)) {
			templatedURLs[url] = dependencies;
		} else {
			templatedURLs[url] = [dependencies];
		}
	}
	return templatedURLs;
};

/**
 * Transform runtime caching configuration
 * @param {Array} runtimeCaching - sw-precache runtimeCaching
 * @returns {Array} Workbox runtimeCaching
 */
internals.transformRuntimeCaching = (runtimeCaching) => {
	if (!runtimeCaching) {
		return undefined;
	}

	return runtimeCaching.map((rule) => ({
		urlPattern: rule.urlPattern,
		handler: internals.transformHandlerName(rule.handler),
		method: rule.method ? rule.method.toUpperCase() : 'GET',
		options: internals.transformRuntimeOptions(rule.options),
	}));
};

/**
 * Transform handler name from sw-precache to Workbox format
 * @param {String} handler - sw-precache handler name
 * @returns {String} Workbox handler name
 */
internals.transformHandlerName = (handler) => {
	if (!handler) {
		return 'NetworkFirst';
	}

	// If already in Workbox format (PascalCase), return as-is
	if (internals.handlerNameMap[handler]) {
		return internals.handlerNameMap[handler];
	}

	// Return as-is if it's already a Workbox handler name
	return handler;
};

/**
 * Transform runtime caching options
 * @param {Object} options - sw-precache runtimeCaching options
 * @returns {Object} Workbox runtimeCaching options
 */
internals.transformRuntimeOptions = (options) => {
	if (!options) {
		return undefined;
	}

	const transformed = {};

	// Transform cache.name → cacheName
	if (options.cache && options.cache.name) {
		transformed.cacheName = options.cache.name;
	}

	// Transform remaining cache properties → expiration
	if (options.cache && Object.keys(options.cache).length > 1) {
		const { name, ...expirationConfig } = options.cache;
		if (Object.keys(expirationConfig).length > 0) {
			transformed.expiration = expirationConfig;
		}
	}

	// Merge other options
	return Hoek.merge(transformed, options);
};

/**
 * Check for deprecated configuration options
 * @param {Object} config - Configuration object to check
 * @returns {Array} Array of deprecation warnings
 */
internals.checkDeprecatedOptions = (config) => {
	const warnings = [];

	// Check for deprecated option names
	for (const [old, newOpt] of Object.entries(internals.deprecatedOptions)) {
		if (config[old]) {
			warnings.push(
				`"${old}" is deprecated. Use "${newOpt}" instead. ` +
				'Legacy support will be removed in v3.0.0'
			);
		}
	}

	// Check for deprecated handler names in runtime caching
	if (config.runtimeCaching) {
		config.runtimeCaching.forEach((rule) => {
			if (rule.handler === 'fastest') {
				warnings.push(
					'Handler "fastest" is deprecated. Use "StaleWhileRevalidate" instead. ' +
					'Legacy support will be removed in v3.0.0'
				);
			}
		});
	}

	return warnings;
};

/**
 * Normalize configuration by transforming legacy options
 * @param {Object} config - Configuration object with potential legacy options
 * @returns {Object} Normalized configuration object
 */
internals.normalizeConfig = (config) => {
	const normalized = { ...config };

	// Transform legacy sw-precache options to Workbox
	if (normalized.staticFileGlobs) {
		normalized.globPatterns = normalized.staticFileGlobs;
		delete normalized.staticFileGlobs;
	}

	if (normalized.dynamicUrlToDependencies) {
		normalized.templatedURLs = normalized.dynamicUrlToDependencies;
		delete normalized.dynamicUrlToDependencies;
	}

	if (normalized.navigateFallbackWhitelist) {
		normalized.navigateFallbackAllowlist = normalized.navigateFallbackWhitelist;
		delete normalized.navigateFallbackWhitelist;
	}

	if (normalized.dontCacheBustUrlsMatching) {
		normalized.dontCacheBustURLsMatching = normalized.dontCacheBustUrlsMatching;
		delete normalized.dontCacheBustUrlsMatching;
	}

	// Transform handler names in runtime caching
	if (normalized.runtimeCaching) {
		// Handle both single objects and arrays
		const runtimeCachingArray = Array.isArray(normalized.runtimeCaching)
			? normalized.runtimeCaching
			: [normalized.runtimeCaching];

		normalized.runtimeCaching = runtimeCachingArray.map((rule) => ({
			...rule,
			handler: internals.transformHandlerName(rule.handler),
			options: internals.transformRuntimeOptions(rule.options),
		}));
	}

	return normalized;
};

module.exports = {
	transformGlobalConfig: internals.transformGlobalConfig,
	transformTemplatedURLs: internals.transformTemplatedURLs,
	transformRuntimeCaching: internals.transformRuntimeCaching,
	transformHandlerName: internals.transformHandlerName,
	transformRuntimeOptions: internals.transformRuntimeOptions,
	checkDeprecatedOptions: internals.checkDeprecatedOptions,
	normalizeConfig: internals.normalizeConfig,
};