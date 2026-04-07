// Legacy test file - tests have been moved to test/index.test.js
// This file is kept for backward compatibility

const Hapi = require('@hapi/hapi');
const sw = require('./');
const assert = require('chai').assert;

describe('hapi-sw (legacy)', () => {
    it('is a well-formed Hapi plugin', async () => {
        const server = new Hapi.Server({ port: 9001 });
        return server.register(sw).catch((err) => {
            assert.isUndefined(err);
        });
    });
});
