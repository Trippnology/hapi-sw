'use strict';

const { expect } = require('chai');
const Hapi = require('@hapi/hapi');
const sw = require('../index');
const fs = require('fs');
const path = require('path');

describe('hapi-sw with Workbox', () => {
	let server;

	beforeEach(async () => {
		server = new Hapi.Server({ port: 9001 });
	});

	afterEach(async () => {
		await server.stop();
	});

	describe('Plugin Registration', () => {
		it('should register successfully with Workbox config', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: __dirname,
					globPatterns: ['*.js'],
					swDest: path.join(__dirname, 'test-sw.js'),
				},
			});
			expect(server.registrations).to.have.property('sw');
		});

		it('should register successfully with legacy sw-precache config', async () => {
			await server.register({
				plugin: sw,
				options: {
					staticFileGlobs: ['*.js'], // Legacy option
					runtimeCaching: [{
						urlPattern: /\/api\//,
						handler: 'fastest', // Legacy handler name
					}],
				},
			});
			expect(server.registrations).to.have.property('sw');
		});

		it('should set default Workbox options when not provided', async () => {
			await server.register({
				plugin: sw,
				options: {
					globPatterns: ['*.js'],
				},
			});
			expect(server.registrations).to.have.property('sw');
		});

		it('should throw error on invalid configuration', async () => {
			try {
				await server.register({
					plugin: sw,
					options: {
						globDirectory: '/invalid/path/that/does/not/exist',
						globPatterns: ['*.js'],
					},
				});
				expect.fail('Should have thrown an error');
			} catch (err) {
				expect(err).to.exist;
			}
		});
	});

	describe('Service Worker Generation', () => {
		it('should generate service worker with Workbox', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: __dirname,
					globPatterns: ['*.js'],
					swDest: path.join(__dirname, '.tmp-sw.js'),
				},
			});

			const response = await server.inject({
				method: 'GET',
				url: '/service-worker.js',
			});

			expect(response.statusCode).to.equal(200);
			expect(response.headers['content-type']).to.include('javascript');
			expect(response.payload).to.include('workbox'); // Should contain Workbox code

			// Clean up
			const swPath = path.join(__dirname, '.tmp-sw.js');
			if (fs.existsSync(swPath)) {
				fs.unlinkSync(swPath);
			}
		});

		it('should cache generated service worker', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: __dirname,
					globPatterns: ['*.js'],
					swDest: path.join(__dirname, '.tmp-sw.js'),
				},
			});

			const response1 = await server.inject('/service-worker.js');
			const response2 = await server.inject('/service-worker.js');

			expect(response1.payload).to.equal(response2.payload);

			// Clean up
			const swPath = path.join(__dirname, '.tmp-sw.js');
			if (fs.existsSync(swPath)) {
				fs.unlinkSync(swPath);
			}
		});

		it('should regenerate when configuration changes', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: __dirname,
					globPatterns: ['*.js'],
					swDest: path.join(__dirname, '.tmp-sw.js'),
				},
			});

			// Add a route with sw configuration
			server.route({
				path: '/api/test',
				method: 'GET',
				config: {
					plugins: {
						sw: {
							templatedURLs: ['./test/fixtures/api.html'],
						},
					},
				},
				handler: () => ({ data: 'test' }),
			});

			const response = await server.inject('/service-worker.js');
			expect(response.statusCode).to.equal(200);
			expect(response.payload).to.include('workbox');

			// Clean up
			const swPath = path.join(__dirname, '.tmp-sw.js');
			if (fs.existsSync(swPath)) {
				fs.unlinkSync(swPath);
			}
		});
	});

	describe('Route-Specific Configuration', () => {
		it('should merge route-scoped templated URLs', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: __dirname,
					globPatterns: ['*.js'],
					swDest: path.join(__dirname, '.tmp-sw.js'),
				},
			});

			server.route({
				path: '/api/data',
				method: 'GET',
				config: {
					plugins: {
						sw: {
							templatedURLs: ['./test/fixtures/data.html'],
						},
					},
				},
				handler: () => ({ data: 'test' }),
			});

			const response = await server.inject('/service-worker.js');
			expect(response.statusCode).to.equal(200);
			expect(response.payload).to.include('workbox');

			// Clean up
			const swPath = path.join(__dirname, '.tmp-sw.js');
			if (fs.existsSync(swPath)) {
				fs.unlinkSync(swPath);
			}
		});

		it('should support legacy dynamicUrlToDependencies', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: __dirname,
					globPatterns: ['*.js'],
					swDest: path.join(__dirname, '.tmp-sw.js'),
				},
			});

			server.route({
				path: '/',
				method: 'GET',
				config: {
					plugins: {
						sw: {
							dynamicUrlToDependencies: ['./test/fixtures/index.html'], // Legacy option
						},
					},
				},
				handler: () => ({ hello: 'world' }),
			});

			const response = await server.inject('/service-worker.js');
			expect(response.statusCode).to.equal(200);
			expect(response.payload).to.include('workbox');

			// Clean up
			const swPath = path.join(__dirname, '.tmp-sw.js');
			if (fs.existsSync(swPath)) {
				fs.unlinkSync(swPath);
			}
		});

		it('should support route-specific runtime caching', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: __dirname,
					globPatterns: ['*.js'],
					swDest: path.join(__dirname, '.tmp-sw.js'),
				},
			});

			server.route({
				path: '/images/{param*}',
				method: 'GET',
				config: {
					plugins: {
						sw: {
							runtimeCaching: {
								urlPattern: /\.(png|jpg)$/,
								handler: 'CacheFirst',
							},
						},
					},
				},
				handler: () => ({ image: 'data' }),
			});

			const response = await server.inject('/service-worker.js');
			expect(response.statusCode).to.equal(200);
			expect(response.payload).to.include('workbox');

			// Clean up
			const swPath = path.join(__dirname, '.tmp-sw.js');
			if (fs.existsSync(swPath)) {
				fs.unlinkSync(swPath);
			}
		});
	});

	describe('Runtime Caching', () => {
		it('should transform handler names correctly', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: __dirname,
					globPatterns: ['*.js'],
					swDest: path.join(__dirname, '.tmp-sw.js'),
					runtimeCaching: [{
						urlPattern: /\/api\//,
						handler: 'fastest', // Should transform to StaleWhileRevalidate
					}],
				},
			});

			const response = await server.inject('/service-worker.js');
			expect(response.statusCode).to.equal(200);
			expect(response.payload).to.include('StaleWhileRevalidate');

			// Clean up
			const swPath = path.join(__dirname, '.tmp-sw.js');
			if (fs.existsSync(swPath)) {
				fs.unlinkSync(swPath);
			}
		});

		it('should support Workbox handler names', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: __dirname,
					globPatterns: ['*.js'],
					swDest: path.join(__dirname, '.tmp-sw.js'),
					runtimeCaching: [{
						urlPattern: /\/api\//,
						handler: 'NetworkFirst', // Workbox format
					}],
				},
			});

			const response = await server.inject('/service-worker.js');
			expect(response.statusCode).to.equal(200);
			expect(response.payload).to.include('NetworkFirst');

			// Clean up
			const swPath = path.join(__dirname, '.tmp-sw.js');
			if (fs.existsSync(swPath)) {
				fs.unlinkSync(swPath);
			}
		});

		it('should transform runtime caching options structure', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: __dirname,
					globPatterns: ['*.js'],
					swDest: path.join(__dirname, '.tmp-sw.js'),
					runtimeCaching: [{
						urlPattern: /\/api\//,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache', // Workbox format
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 86400,
							},
						},
					}],
				},
			});

			const response = await server.inject('/service-worker.js');
			expect(response.statusCode).to.equal(200);
			expect(response.payload).to.include('api-cache');

			// Clean up
			const swPath = path.join(__dirname, '.tmp-sw.js');
			if (fs.existsSync(swPath)) {
				fs.unlinkSync(swPath);
			}
		});
	});

	describe('Error Handling', () => {
		it('should handle generation errors gracefully', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: '/invalid/path',
					globPatterns: ['*.js'],
				},
			});

			const response = await server.inject('/service-worker.js');
			expect(response.statusCode).to.equal(500);
			// The error message should be logged to console, not returned in response
			// This tests that the plugin handles errors gracefully without crashing
		});

		it('should provide deprecation warnings for legacy options', async () => {
			const consoleWarn = console.warn;
			const warnings = [];
			console.warn = (...args) => warnings.push(args.join(' '));

			await server.register({
				plugin: sw,
				options: {
					staticFileGlobs: ['*.js'], // Deprecated option
					runtimeCaching: [{
						urlPattern: /\/api\//,
						handler: 'fastest', // Deprecated handler
					}],
				},
			});

			console.warn = consoleWarn;
			expect(warnings.some(w => w.includes('deprecated'))).to.be.true;
		});
	});

	describe('Service Worker Registration Route', () => {
		it('should serve service worker registration script', async () => {
			await server.register({
				plugin: sw,
				options: {
					globDirectory: __dirname,
					globPatterns: ['*.js'],
				},
			});

			const response = await server.inject({
				method: 'GET',
				url: '/service-worker-registration.js',
			});

			expect(response.statusCode).to.equal(200);
			expect(response.headers['content-type']).to.include('javascript');
			expect(response.payload).to.include('serviceWorker');
			expect(response.payload).to.include('/service-worker.js');
		});
	});

	describe('Configuration Transformation', () => {
		const configTransformer = require('../lib/config-transformer');

		it('should transform handler names correctly', () => {
			expect(configTransformer.transformHandlerName('fastest')).to.equal('StaleWhileRevalidate');
			expect(configTransformer.transformHandlerName('networkFirst')).to.equal('NetworkFirst');
			expect(configTransformer.transformHandlerName('cacheFirst')).to.equal('CacheFirst');
			expect(configTransformer.transformHandlerName('NetworkFirst')).to.equal('NetworkFirst');
		});

		it('should transform runtime caching options', () => {
			const options = {
				cache: {
					name: 'test-cache',
					maxEntries: 10,
					maxAgeSeconds: 3600,
				},
			};

			const transformed = configTransformer.transformRuntimeOptions(options);
			expect(transformed.cacheName).to.equal('test-cache');
			expect(transformed.expiration).to.exist;
			expect(transformed.expiration.maxEntries).to.equal(10);
			expect(transformed.expiration.maxAgeSeconds).to.equal(3600);
		});

		it('should detect deprecated options', () => {
			const warnings = configTransformer.checkDeprecatedOptions({
				staticFileGlobs: ['*.js'],
				runtimeCaching: [{
					handler: 'fastest',
				}],
			});

			expect(warnings.length).to.be.greaterThan(0);
			expect(warnings.some(w => w.includes('staticFileGlobs'))).to.be.true;
			expect(warnings.some(w => w.includes('fastest'))).to.be.true;
		});

		it('should normalize legacy configuration', () => {
			const config = {
				staticFileGlobs: ['*.js'],
				dynamicUrlToDependencies: { '/': ['index.html'] },
				navigateFallbackWhitelist: [/^\/$/],
			};

			const normalized = configTransformer.normalizeConfig(config);
			expect(normalized.globPatterns).to.exist;
			expect(normalized.templatedURLs).to.exist;
			expect(normalized.navigateFallbackAllowlist).to.exist;
			expect(normalized.staticFileGlobs).to.not.exist;
		});

		it('should transform global configuration to Workbox format', () => {
			const swConfig = {
				staticFileGlobs: ['*.{js,css}'],
				runtimeCaching: [{
					urlPattern: /\/api\//,
					handler: 'fastest',
					options: {
						cache: {
							name: 'api-cache',
							maxEntries: 50,
						},
					},
				}],
				verbose: true,
			};

			const workboxConfig = configTransformer.transformGlobalConfig(swConfig);
			expect(workboxConfig.globPatterns).to.exist;
			expect(workboxConfig.runtimeCaching).to.exist;
			expect(workboxConfig.runtimeCaching[0].handler).to.equal('StaleWhileRevalidate');
			expect(workboxConfig.runtimeCaching[0].options.cacheName).to.equal('api-cache');
		});
	});
});