const pkg = require('./package.json');
const swPrecache = require('sw-precache');
const Hoek = require('@hapi/hoek');
const Joi = require('joi');
const fs = require('node:fs');
const path = require('node:path');

const internals = {};

internals.routeOptionSchema = Joi.object({
    dynamicUrlToDependencies: Joi.array().optional(),
    dontCacheBustUrlsMatching: [
        Joi.string().optional(),
        Joi.boolean().optional(),
    ],
    navigateFallback: Joi.boolean().optional(),
    runtimeCaching: Joi.object({
        handler: Joi.string().valid(
            'networkFirst',
            'cacheFirst',
            'fastest',
            'cacheOnly',
            'networkOnly',
        ),
        method: Joi.string()
            .valid('get', 'post', 'put', 'delete', 'head')
            .insensitive()
            .optional()
            .lowercase(),
        options: Joi.object().optional(),
    }).optional(),
});

internals.globalOptionsSchema = Joi.object({
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
    importScripts: Joi.array().items(Joi.string()).optional(),
    logger: Joi.func().optional(),
    maximumFileSizeToCacheInBytes: Joi.number().optional(),
    navigateFallback: Joi.string().optional(),
    navigateFallbackWhitelist: Joi.array().optional(),
    replacePrefix: Joi.string().optional(),
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
                ),
                method: Joi.string()
                    .valid('get', 'post', 'put', 'delete', 'head')
                    .insensitive()
                    .optional()
                    .lowercase(),
                options: Joi.object().optional(),
            }),
        )
        .optional(),
    skipWaiting: Joi.boolean().optional(),
    staticFileGlobs: Joi.array().items(Joi.string()).optional(),
    stripPrefix: Joi.string().optional(),
    stripPrefixMulti: Joi.object().optional(),
    templateFilePath: Joi.string().optional(),
    verbose: Joi.boolean().optional(),
    // custom options below
    defaultWorker: Joi.string().optional(),
});

internals.mergeOptions = (key, value, route) => {
    let result = {};
    switch (key) {
        case 'dynamicUrlToDependencies':
            result[key] = {};
            result[key][route.path] = value;
            break;
        case 'dontCacheBustUrlsMatching':
            if (value === true) {
                result[key] = [new RegExp(route.path)];
            } else {
                result[key] = value;
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
        const { error, value: config } =
            internals.globalOptionsSchema.validate(options);
        if (error) {
            throw error;
        }

        let needsRegeneration = true;
        let worker = config.defaultWorker || '';

        function registerRoutes(route) {
            const settings = Joi.attempt(
                route.settings.plugins.sw,
                internals.routeOptionSchema,
            );
            if (settings) {
                const routeConfig = internals.reduceRouteConfig(
                    settings,
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

            return new Promise((resolve, reject) => {
                swPrecache.generate(config, (err, newWorker) => {
                    if (err) {
                        reject(err);
                    } else {
                        needsRegeneration = false;
                        worker = newWorker;
                        resolve(worker);
                    }
                });
            });
        }

        server.route([
            {
                path: '/service-worker.js',
                method: 'GET',
                options: {
                    auth: false,
                    pre: [{ method: generateSw, assign: 'sw' }],
                },
                handler: (request, h) => {
                    return h
                        .response(request.pre.sw)
                        .type('application/javascript');
                },
            },
            {
                path: '/service-worker-registration.js',
                method: 'GET',
                options: {
                    auth: false,
                },
                handler: (request, h) => {
                    return h.file(
                        require.resolve('./service-worker-registration.js'),
                    );
                },
            },
        ]);

        server.events.on('route', registerRoutes);
    },
};

module.exports = plugin;
