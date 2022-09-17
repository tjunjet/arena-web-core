export class WebRTCStatsLogger {
    constructor(peerConnection, updateInterval) {
        this.peerConnection = peerConnection;
        this.updateInterval = updateInterval;

        this.lastResult = null;

        this.startLogging();
    }

    startLogging() {
        window.setInterval(this.getStats.bind(this), this.updateInterval);
    }

    getStats() {
        this.peerConnection.getStats()
            .then((res) => {
                res.forEach(this.handleReport.bind(this));
                this.lastResult = res;
            });
    }

    handleReport(report) {
        if (report.type !== 'inbound-rtp') {
            return;
        }

        // https://developer.mozilla.org/en-US/docs/Web/API/RTCInboundRtpStreamStats
        const now = report.timestamp;
        const bytes = report.bytesReceived;

        if (this.lastResult && this.lastResult.has(report.id)) {
            // calculate bitrate
            const bitrate = 8 * (bytes - this.lastResult.get(report.id).bytesReceived) /
                (now - this.lastResult.get(report.id).timestamp);

            console.log(`bitrate: ${bitrate}`);
        }
    }
}
