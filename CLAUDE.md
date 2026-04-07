# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@trippnology/hapi-sw` - a Hapi.js plugin that dynamically generates Service Workers using [sw-precache](https://github.com/GoogleChrome/sw-precache). Unlike build-time Service Worker generation tools, this plugin generates Service Workers at runtime based on your server's routes and configuration.

## Common Commands

### Testing
```bash
npm test                    # Run all tests with mocha
```

### Running Examples
```bash
cd example
node index.js               # Start example server on port 9000
```

## Architecture

### Plugin Registration Flow
When the plugin registers with a Hapi server, several things happen:

1. **Configuration Validation**: Options are validated against Joi schemas (`internals.globalOptionsSchema`)
2. **Route Registration**: Two routes are automatically added:
   - `/service-worker.js` - Dynamically generates the Service Worker using sw-precache
   - `/service-worker-registration.js` - Serves the browser registration script
3. **Route Event Listener**: Listens for subsequent route additions to merge route-scoped Service Worker configuration

### Route-Scoped Configuration
Routes can define Service Worker behavior via `config.plugins.sw`:

```javascript
server.route({
  path: '/',
  config: {
    plugins: {
      sw: {
        dynamicUrlToDependencies: ['./templates/homepage.html']
      }
    }
  }
})
```

The plugin listens to the `route` event and merges route-specific settings into the global sw-precache configuration using `internals.reduceRouteConfig()`.

### Service Worker Generation
The Service Worker is generated on-demand via the `generateSw()` pre-handler:
- Caches the generated worker to avoid regeneration on subsequent requests
- Regenerates when `needsRegeneration` flag is set (e.g., after new routes with sw config are added)
- Uses `sw-precache.generate()` with the merged configuration

### Configuration Merging Strategy
Different configuration keys are merged differently:
- `dynamicUrlToDependencies`: Creates route-scoped dependency mapping
- `dontCacheBustUrlsMatching`: Creates RegExp from route path when set to `true`
- `runtimeCaching`: Merged directly into global config

## Code Style

- **Indentation**: Tabs, 4 spaces (see .editorconfig)
- **JavaScript**: ES6+ syntax, async/await preferred
- **Validation**: Joi schemas for all configuration options
- **Error Handling**: Uses Hapi's error handling patterns

## Key Dependencies

- `@hapi/hapi`: Web framework (peer dependency)
- `@hapi/inert`: For serving static files in examples
- `sw-precache`: Service Worker generation library
- `joi`: Schema validation
- `@hapi/hoek`: Utility functions (used for object merging)

## Testing

Tests use Mocha and Chai. The test suite validates that the plugin is a well-formed Hapi plugin that can be registered successfully.

## Route Configuration Options

Routes can accept these `sw` plugin options:
- `dynamicUrlToDependencies` - Array of file paths to monitor for changes
- `dontCacheBustUrlsMatching` - RegExp or boolean to disable cache busting
- `navigateFallback` - Enable navigate fallback for the route
- `runtimeCaching` - Runtime caching configuration with handler strategy

All options are validated against `internals.routeOptionSchema`.