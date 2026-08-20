const Message = require('../models/Message');

exports.getTimeSeriesAnalytics = async (req, res) => {
    try {
        // Aggregate message volume grouped by day (Time-Series trend)
        const messageTrends = await Message.aggregate([
            {
                $group: {
                    _id: { 
                        $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } 
                    },
                    totalMessages: { $sum: 1 },
                    studentMessages: {
                        $sum: { $cond: [{ $eq: ["$sender", "student"] }, 1, 0] }
                    }
                }
            },
            { $sort: { "_id": 1 } },
            { $limit: 30 } // Last 30 days trend
        ]);

        res.json({ success: true, trends: messageTrends });
    } catch (err) {
        console.error("Time-Series Error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch time series analytics" });
    }
};