/* eslint-disable */
const brain42 = require("../src/brain42");
const brain43 = require("../src/brain43");

exports.mochaHooks = {
    afterAll(done) {
        brain42.shutdownWorkers();
        brain43.shutdownWorkers();
        setTimeout(() => {
            const handles = process._getActiveHandles();
            const requests = process._getActiveRequests();
            if (handles.length > 0 || requests.length > 0) {
                console.log("\n[teardown] remaining handles:", handles.length);
                handles.forEach((h, i) => {
                    console.log(`  [${i}] ${h.constructor?.name || typeof h}`);
                });
                console.log("[teardown] remaining requests:", requests.length);
                requests.forEach((r, i) => {
                    console.log(`  [${i}] ${r.constructor?.name || typeof r}`);
                });
            }
            done();
        }, 500);
    },
};
