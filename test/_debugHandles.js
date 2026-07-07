/* eslint-disable */
exports.mochaHooks = {
    afterAll(done) {
        setTimeout(() => {
            const handles = process._getActiveHandles();
            const requests = process._getActiveRequests();
            console.log("\n[debug] active handles:", handles.length);
            handles.forEach((h, i) => {
                console.log(`  [${i}] ${h.constructor?.name || typeof h}`);
            });
            console.log("[debug] active requests:", requests.length);
            requests.forEach((r, i) => {
                console.log(`  [${i}] ${r.constructor?.name || typeof r}`);
            });
            done();
        }, 1000);
    },
};
