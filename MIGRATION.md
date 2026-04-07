# Migration Guide: sw-precache to Workbox

## Overview

This version of hapi-sw migrates from `sw-precache` (deprecated, last updated 2017) to `workbox-build` (actively maintained by Google). This migration provides:

- ✅ **Better performance** and modern service worker features
- ✅ **Active maintenance** and security updates
- ✅ **Improved debugging** and developer experience
- ✅ **Extended functionality** with Workbox plugins
- ✅ **Backward compatibility** for existing configurations

## Breaking Changes

### Version Information
- **Previous version**: `2.0.2` (sw-precache)
- **Current version**: `3.0.0` (Workbox)
- **Major version bump**: Due to breaking changes in configuration options

## Configuration Changes

### Option Name Changes

| sw-precache Option | Workbox Equivalent | Status |
|-------------------|-------------------|---------|
| `staticFileGlobs` | `globPatterns` | ⚠️ Deprecated (legacy supported) |
| `dynamicUrlToDependencies` | `templatedURLs` | ⚠️ Deprecated (legacy supported) |
| `navigateFallbackWhitelist` | `navigateFallbackAllowlist` | ⚠️ Deprecated (legacy supported) |
| `dontCacheBustUrlsMatching` | `dontCacheBustURLsMatching` | ⚠️ Deprecated (legacy supported) |
| `handler: 'fastest'` | `handler: 'StaleWhileRevalidate'` | ⚠️ Deprecated (legacy supported) |
| `options.cache.name` | `options.cacheName` | ✅ **Breaking change** |
| `options.cache` | `options.expiration` | ✅ **Breaking change** |

### New Required Options

Workbox requires these options (with sensible defaults):

```javascript
{
  globDirectory: './',       // Base directory for file patterns (default: process.cwd())
  swDest: 'service-worker.js', // Output path (default: './service-worker.js')
  mode: 'production'         // 'production' or 'development' (default: 'production')
}
```

### Handler Name Changes

All handler names are now PascalCase (both legacy and new formats supported):

```javascript
// sw-precache (lowercase) - Still supported with deprecation warning
'networkFirst' → 'NetworkFirst'  // Recommended
'cacheFirst' → 'CacheFirst'      // Recommended
'fastest' → 'StaleWhileRevalidate' // Recommended
'cacheOnly' → 'CacheOnly'        // Recommended
'networkOnly' → 'NetworkOnly'    // Recommended
```

## Migration Examples

### Example 1: Basic Configuration Migration

**Before (sw-precache v2.0.2)**:
```javascript
await server.register({
  plugin: require('hapi-sw'),
  options: {
    staticFileGlobs: [
      'assets/**/*.{css,js}',
      'assets/img/**.*'
    ],
    runtimeCaching: [{
      urlPattern: /\/api\//,
      handler: 'networkFirst',
      options: {
        cache: {
          name: 'api-cache',
          maxEntries: 50,
        },
      },
    }],
  },
});
```

**After (Workbox v3.0.0 - Recommended)**:
```javascript
await server.register({
  plugin: require('hapi-sw'),
  options: {
    globDirectory: './assets',    // NEW - Required
    globPatterns: [                // was staticFileGlobs
      '**/*.{css,js}',
      'img/**.*'
    ],
    runtimeCaching: [{
      urlPattern: /\/api\//,
      handler: 'NetworkFirst',     // Now PascalCase
      options: {
        cacheName: 'api-cache',    // was options.cache.name
        expiration: {               // was options.cache
          maxEntries: 50,
        },
      },
    }],
  },
});
```

**After (Workbox v3.0.0 - Legacy Support)**:
```javascript
await server.register({
  plugin: require('hapi-sw'),
  options: {
    staticFileGlobs: [             // Still supported with deprecation warning
      'assets/**/*.{css,js}',
      'assets/img/**.*'
    ],
    runtimeCaching: [{
      urlPattern: /\/api\//,
      handler: 'networkFirst',     // Still supported with deprecation warning
      options: {
        cache: {                   // Still supported but transforms to cacheName
          name: 'api-cache',
          maxEntries: 50,
        },
      },
    }],
  },
});
```

### Example 2: Route Configuration Migration

**Before (sw-precache)**:
```javascript
server.route({
  path: '/',
  method: 'GET',
  config: {
    plugins: {
      sw: {
        dynamicUrlToDependencies: ['./templates/index.html'],
      },
    },
  },
  handler: (request, h) => {
    return h.file('./index.html');
  },
});
```

**After (Workbox - Recommended)**:
```javascript
server.route({
  path: '/',
  method: 'GET',
  config: {
    plugins: {
      sw: {
        templatedURLs: ['./templates/index.html'],  // New name
      },
    },
  },
  handler: (request, h) => {
    return h.file('./index.html');
  },
});
```

**After (Workbox - Legacy Support)**:
```javascript
server.route({
  path: '/',
  method: 'GET',
  config: {
    plugins: {
      sw: {
        dynamicUrlToDependencies: ['./templates/index.html'],  // Still works!
      },
    },
  },
  handler: (request, h) => {
    return h.file('./index.html');
  },
});
```

### Example 3: Complex Runtime Caching

**Before (sw-precache)**:
```javascript
runtimeCaching: [
  {
    urlPattern: /https:\/\/cdn\.example\.com\//,
    handler: 'cacheFirst',
    options: {
      cache: {
        name: 'cdn-cache',
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      },
    },
  },
  {
    urlPattern: /\/api\//,
    handler: 'fastest',
    options: {
      cache: {
        name: 'api-cache',
        maxEntries: 50,
      },
    },
  },
]
```

**After (Workbox - Recommended)**:
```javascript
runtimeCaching: [
  {
    urlPattern: /https:\/\/cdn\.example\.com\//,
    handler: 'CacheFirst',           // PascalCase
    options: {
      cacheName: 'cdn-cache',         // Direct option
      expiration: {                   // was cache
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      },
    },
  },
  {
    urlPattern: /\/api\//,
    handler: 'StaleWhileRevalidate',  // was 'fastest'
    options: {
      cacheName: 'api-cache',
      expiration: {
        maxEntries: 50,
      },
    },
  },
]
```

## Migration Steps

### Step 1: Update Dependencies

```bash
# Update hapi-sw to version 3.0.0
npm install hapi-sw@latest

# Remove sw-precache (no longer needed)
npm uninstall sw-precache
```

### Step 2: Update Configuration (Recommended)

1. **Update option names**:
   - `staticFileGlobs` → `globPatterns`
   - `dynamicUrlToDependencies` → `templatedURLs`
   - `navigateFallbackWhitelist` → `navigateFallbackAllowlist`

2. **Update handler names**:
   - `networkFirst` → `NetworkFirst`
   - `cacheFirst` → `CacheFirst`
   - `fastest` → `StaleWhileRevalidate`
   - `cacheOnly` → `CacheOnly`
   - `networkOnly` → `NetworkOnly`

3. **Update runtime caching options**:
   - `options.cache.name` → `options.cacheName`
   - `options.cache` → `options.expiration`

4. **Add required Workbox options**:
   - `globDirectory: './assets'` (or appropriate directory)
   - `swDest: 'service-worker.js'` (optional, has default)
   - `mode: 'production'` (optional, has default)

### Step 3: Test Your Service Worker

1. **Start your server**:
   ```bash
   node server.js
   ```

2. **Open browser DevTools**:
   - Go to Application/Service Workers
   - Register the service worker
   - Check for console warnings

3. **Test caching behavior**:
   - Load resources
   - Check Cache Storage
   - Test offline functionality
   - Verify caching strategies work as expected

4. **Check for deprecation warnings**:
   - Look for yellow warnings in console
   - Update deprecated options gradually

### Step 4: Gradual Migration (Optional)

If you want to migrate gradually, the plugin supports legacy options with deprecation warnings:

```javascript
// Phase 1: Use legacy options (works with warnings)
await server.register({
  plugin: require('hapi-sw'),
  options: {
    staticFileGlobs: ['assets/**/*.{css,js}'], // Shows deprecation warning
    runtimeCaching: [{
      handler: 'networkFirst', // Shows deprecation warning
      options: {
        cache: { name: 'cache' }, // Still works
      },
    }],
  },
});

// Phase 2: Update to new options (no warnings)
await server.register({
  plugin: require('hapi-sw'),
  options: {
    globDirectory: './assets',
    globPatterns: ['**/*.{css,js}'],
    runtimeCaching: [{
      handler: 'NetworkFirst',
      options: {
        cacheName: 'cache',
      },
    }],
  },
});
```

## New Features in Workbox

Workbox provides several new features not available in sw-precache:

### 1. Navigation Preload
```javascript
{
  navigationPreload: true,  // Faster navigation requests
}
```

### 2. Background Sync
```javascript
{
  runtimeCaching: [{
    urlPattern: /\/api\//,
    handler: 'NetworkFirst',
    options: {
      backgroundSync: {
        name: 'api-queue',
        maxRetentionTime: 60 * 24, // 24 hours
      },
    },
  }],
}
```

### 3. Broadcast Updates
```javascript
{
  runtimeCaching: [{
    urlPattern: /\/api\//,
    handler: 'StaleWhileRevalidate',
    options: {
      broadcastUpdate: {
        channelName: 'api-updates',
      },
    },
  }],
}
```

### 4. Cacheable Response
```javascript
{
  runtimeCaching: [{
    urlPattern: /\/api\//,
    handler: 'CacheFirst',
    options: {
      cacheableResponse: {
        statuses: [0, 200],
        headers: {
          'X-Cacheable': 'true',
        },
      },
    },
  }],
}
```

### 5. Range Requests
```javascript
{
  runtimeCaching: [{
    urlPattern: /\.(mp4|webm)$/,
    handler: 'CacheFirst',
    options: {
      rangeRequests: true,  // Support for partial content
    },
  }],
}
```

## Troubleshooting

### Service Worker Not Updating

**Problem**: Service worker doesn't update after configuration changes.

**Solution**:
1. Clear all site data in DevTools
2. Unregister the service worker
3. Refresh the page
4. Check for `skipWaiting` and `clientsClaim` options

```javascript
{
  skipWaiting: true,    // Force service worker to become active
  clientsClaim: true,   // Claim all clients immediately
}
```

### Route Patterns Not Matching

**Problem**: URL patterns don't match as expected.

**Solution**: Ensure RegExp patterns are properly formatted:

```javascript
// Good - RegExp patterns
urlPattern: /\/api\/v\d+\//
urlPattern: /^https:\/\/example\.com\//

// Bad - Express-style wildcards (not supported)
urlPattern: '/api/v*'
```

### Performance Issues

**Problem**: Service worker generation is slow.

**Solution**:
1. Reduce `globPatterns` scope
2. Use specific `globDirectory` instead of root
3. Enable verbose logging to identify issues:

```javascript
{
  verbose: true,  // See generation details
}
```

### Cache Strategy Not Working

**Problem**: Resources aren't cached as expected.

**Solution**:
1. Check browser DevTools → Cache Storage
2. Verify service worker is active
3. Test with `mode: 'development'` for more logging

```javascript
{
  mode: 'development',  // More verbose logging
}
```

## Deprecation Timeline

- **v3.0.0** (Current): Legacy options supported with deprecation warnings
- **v3.1.0**: Enhanced Workbox features
- **v4.0.0**: Legacy options removed (Workbox-only)

## Migration Checklist

Use this checklist to ensure complete migration:

- [ ] Update hapi-sw to version 3.0.0
- [ ] Update `staticFileGlobs` → `globPatterns`
- [ ] Update `dynamicUrlToDependencies` → `templatedURLs`
- [ ] Update handler names to PascalCase
- [ ] Update `options.cache.name` → `options.cacheName`
- [ ] Update `options.cache` → `options.expiration`
- [ ] Add `globDirectory` option
- [ ] Add `swDest` option (if needed)
- [ ] Add `mode` option (if needed)
- [ ] Update route configurations
- [ ] Test service worker registration
- [ ] Test caching strategies
- [ ] Check for deprecation warnings
- [ ] Test offline functionality
- [ ] Verify performance is acceptable

## Need Help?

- **GitHub Issues**: [Report bugs or request features](https://github.com/trippnology/hapi-sw/issues)
- **Workbox Documentation**: [Official Workbox docs](https://developer.chrome.com/docs/workbox)
- **Service Worker APIs**: [MDN Service Worker documentation](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## Summary

This migration maintains **backward compatibility** while providing a clear path to modern Workbox configuration. The plugin will:

- ✅ **Continue working** with existing sw-precache configurations
- ⚠️ **Issue deprecation warnings** for legacy options
- 🚀 **Provide new features** through Workbox integration
- 📈 **Improve performance** and maintainability

You can migrate gradually at your own pace, or jump directly to the new Workbox configuration format. The choice is yours!