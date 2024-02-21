import AWS from 'aws-sdk';
import https from 'https';

const documentClient = new AWS.DynamoDB.DocumentClient();

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
}

async function prepareAndTriggerChallengeGeneration(event) {
    const tableNameLeaderboard = "leaderboard_mock";
    const seasonLengthDays = 28;

    try {
        const uniqueBuckets = await getAllUniqueBuckets(tableNameLeaderboard);
        let buckets_data = [];

        for (const bucket_id of uniqueBuckets) {
            if (!bucket_id) {
                console.error("Encountered undefined bucketId in uniqueBuckets");
                continue; 
            }
            const average_skill = await calculateAverageSkillForBucket(tableNameLeaderboard, bucket_id, seasonLengthDays);
            // console.log(`averageSkill: ${JSON.stringify(averageSkill, null, 2)}`);
            const users = await getUsersInBucket(tableNameLeaderboard, bucket_id);
            // console.log(`Users: ${JSON.stringify(users, null, 2)}`);

            buckets_data.push({
                bucket_id,
                average_skill,
                users,
            });
            // console.log(`Bucket Data Pushed: ${JSON.stringify(bucketsData[bucketsData.length - 1], null, 2)}`);
        }

        const payload = {
            season_id: "season_2024_02",
            start_date: "2024-02-01",
            end_date: "2024-02-28",
            buckets: buckets_data,
        };

        const apiUrl = 'https://jkipopyatb.execute-api.eu-west-2.amazonaws.com/dev/challenge-creation';

        // Make an API call to trigger challenge creation
        const apiResponse = await makeApiCall(apiUrl, payload);
        console.log("API call response:", apiResponse);
        return apiResponse;
    } catch (error) {
        console.error("Error preparing data for challenge generation:", error);
        throw error;
    }
}

// Function to make an API call
async function makeApiCall(url, payload) {
    return new Promise((resolve, reject) => {
        const dataString = JSON.stringify(payload);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': dataString.length,
            },
        };

        const req = https.request(url, options, (res) => {
            let response = '';

            res.on('data', (chunk) => {
                response += chunk;
            });

            res.on('end', () => {
                console.log("API call ended with response:", response);
                try {
                    const jsonResponse = JSON.parse(response);
                    resolve(jsonResponse);
                } catch (parseError) {
                    console.error("Error parsing API response:", parseError);
                    reject(parseError);
                }
            });
        });

        req.on('error', (e) => {
            console.error("API call error:", e);
            reject(e);
        });

        // Send the request with the payload
        req.write(dataString);
        req.end();
    });
}


async function getAllUniqueBuckets(tableName) {
    let uniqueBuckets = new Set(); 
    let params = {
        TableName: tableName,
        ProjectionExpression: "bucket_id", 
    };

    try {
        let scanResponse;
        do {
            scanResponse = await documentClient.scan(params).promise();
            scanResponse.Items.forEach(item => uniqueBuckets.add(item.bucket_id));
            params.ExclusiveStartKey = scanResponse.LastEvaluatedKey; 
        } while (scanResponse.LastEvaluatedKey);

        return Array.from(uniqueBuckets);
    } catch (error) {
        console.error("Error scanning for unique buckets:", error);
        throw error; 
    }
}

async function calculateAverageSkillForBucket(tableName, bucketId, seasonLengthDays) {
    console.log(`Calculating average skill for bucket: ${bucketId}`);
    let totalSkill = 0;
    let userCount = 0;
    let params = {
        TableName: tableName,
        ProjectionExpression: "aggregate_skills_season",
        FilterExpression: "bucket_id = :bucketId",
        ExpressionAttributeValues: { ":bucketId": bucketId },
    };

    console.log(`DynamoDB Query Params: ${JSON.stringify(params)}`);

    try {
        let scanResponse;
        do {
            scanResponse = await documentClient.scan(params).promise();
            if(scanResponse.Items.length > 0) {
                scanResponse.Items.forEach(item => {
                    totalSkill += item.aggregate_skills_season;
                    userCount += 1;
                });
            } else {
                console.log(`No items found for bucketId ${bucketId}`);
            }
            params.ExclusiveStartKey = scanResponse.LastEvaluatedKey; 
        } while (scanResponse.LastEvaluatedKey);

        return userCount > 0 ? (totalSkill / userCount) / seasonLengthDays : 0;
    } catch (error) {
        console.error(`Error calculating average skill for bucket ${bucketId}:`, error);
        throw error;
    }
}


async function getUsersInBucket(tableName, bucketId) {
    const params = {
        TableName: tableName,
        FilterExpression: "bucket_id = :bucketId",
        ExpressionAttributeValues: {
            ":bucketId": bucketId,
        },
        ProjectionExpression: "user_id", // Only fetch the user_id attribute
    };

    let userIDs = [];
    let items;
    do {
        items = await documentClient.scan(params).promise();
        // Directly map user_id from items to userIDs array
        userIDs.push(...items.Items.map(item => item.user_id));
        params.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (items.LastEvaluatedKey);

    return userIDs;
}
