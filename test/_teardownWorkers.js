/**
 * Global Mocha teardown: brain42/brain43 spawn worker_threads that keep Node alive
 * unless terminated and awaited before the process exits.
 */
const brain42 = require("../src/brain42");
const brain43 = require("../src/brain43");

exports.mochaHooks = {
    afterAll: async () => {
        await Promise.all([
            brain42.shutdownWorkers(),
            brain43.shutdownWorkers(),
        ]);
    },
};
