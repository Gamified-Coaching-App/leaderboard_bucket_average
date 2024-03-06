import { getAllUniqueBuckets, calculateAverageSkillForBucket, getUsersInBucket, makeApiCall } from "./utils.mjs";

export async function handler(event) {
    try {
        const response = await prepareAndTriggerChallengeGeneration(event);
    } catch (error) {
        console.error("Error in handler:", error);

        // Return an error response if an error is caught
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to trigger challenge generation due to an internal error.", details: error.message }),
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Challenge generation triggered." }),
    };
}

export async function prepareAndTriggerChallengeGeneration(event) {
    console.log("prepareAndTriggerChallengeGeneration triggered");
    const tableNameLeaderboard = "leaderboard";

    try {
        const uniqueBuckets = await getAllUniqueBuckets(tableNameLeaderboard);
        let buckets = [];

        for (const bucket_id of uniqueBuckets) {
            if (!bucket_id) {
                console.error("Encountered undefined bucketId in uniqueBuckets");
                continue;
            }
            const averageSkill = await calculateAverageSkillForBucket(tableNameLeaderboard, bucket_id);
            // console.log(`averageSkill: ${JSON.stringify(averageSkill, null, 2)}`);
            const users = await getUsersInBucket(tableNameLeaderboard, bucket_id);
            // console.log(`Users: ${JSON.stringify(users, null, 2)}`);

            buckets.push({
                bucket_id,
                average_skill: averageSkill,
                users,
            });
            //console.log(`Bucket Data Pushed: ${JSON.stringify(buckets[buckets.length - 1], null, 2)}`);
        }

        // Get dates for payload
        const currentDate = new Date();
        const year = currentDate.getFullYear(); // Full year (e.g., 2024)
        let month = currentDate.getMonth() + 1; // Month (0-11), add 1 to get the correct month (1-12)
        let day = 1; // Day of the month (1-31)

        // Add leading zeros if needed
        if (month < 10) {
            month = '0' + month;
        }
        if (day < 10) {
            day = '0' + day;
        }

        const seasonIdString = `season_${year}_${month}`;
        // Format the date as "YYYY-MM-DD"
        const seasonStart = `${year}-${month}-${day}`;

        const payload = {
            season_id: seasonIdString,
            start_date: seasonStart,
            buckets: buckets,
        };
        console.log(payload);
        // JSON.stringify(payload)

        const apiUrl = 'https://jkipopyatb.execute-api.eu-west-2.amazonaws.com/dev/challenge-creation';

        const apiResponse = await makeApiCall(apiUrl, payload);
        console.log("API call response:", apiResponse);
        return apiResponse;
    } catch (error) {
        console.error("Error preparing data for challenge generation:", error);
        throw error;
    }
}
  