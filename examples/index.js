const path = require('node:path');

const Hapi = require('@hapi/hapi');

console.log(__dirname);

async function init() {
	const server = Hapi.Server({ host: '0.0.0.0', port: 9000 });

	await server.register([
		require('@hapi/inert'),
		{
			plugin: require('../'),
			options: {
				verbose: true,
				staticFileGlobs: ['*.css'],
				runtimeCaching: [
					{
						urlPattern: /https:\/\/picsum.photos\//,
						handler: 'fastest',
						options: {
							debug: true,
						},
					},
					{
						urlPattern: /https:\/\/unpkg.com\//,
						handler: 'cacheFirst',
						options: {
							debug: true,
						},
					},
				],
			},
		},
	]);

	server.route([
		{
			path: '/',
			method: 'GET',
			config: {
				plugins: {
					sw: {
						dynamicUrlToDependencies: [
							path.join(__dirname, 'index.html'),
						],
					},
				},
			},
			handler: (request, h) => {
				return h.file(path.join(__dirname, 'index.html'));
			},
		},
		{
			path: '/{param*}',
			method: 'GET',
			handler: {
				directory: {
					path: path.resolve(__dirname),
				},
			},
		},
	]);

	await server.start();

	console.log(`Server started on ${server.info.uri}`);
}

init();
