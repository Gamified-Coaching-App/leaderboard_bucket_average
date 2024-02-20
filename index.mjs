import AWS from 'aws-sdk';
import https from 'https';

const documentClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    try {
        await prepareAndTriggerChallengeGeneration(event);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Successfully triggered challenge generation." }),
        };
    } catch (error) {
        console.error("Error in handler:", error);

        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to trigger challenge generation." }),
        };
    }
};

async function prepareAndTriggerChallengeGeneration(event) {
    const tableNameLeaderboard = "leaderboard";
    const seasonLengthDays = 28;

    try {
        const uniqueBuckets = await getAllUniqueBuckets(tableNameLeaderboard);
        let bucketsData = [];

        for (const bucketId of uniqueBuckets) {
            if (!bucketId) {
                console.error("Encountered undefined bucketId in uniqueBuckets");
                continue; 
            }
            const averageSkill = await calculateAverageSkillForBucket(tableNameLeaderboard, bucketId, seasonLengthDays);
            const users = await getUsersInBucket(tableNameLeaderboard, bucketId);

            bucketsData.push({
                bucketId,
                averageSkill,
                users: users.map(user => user.user_id),
            });
        }

        const payload = {
            season_id: "season_2024_02",
            start_date: "2024-02-01",
            end_date: "2024-02-28",
            buckets: bucketsData,
        };

        const apiUrl = 'https://jkipopyatb.execute-api.eu-west-2.amazonaws.com/dev/challenge-creation';

        // Make an API call to trigger challenge creation
        await makeApiCall(apiUrl, payload);

    } catch (error) {
        console.error("Error preparing data for challenge generation:", error);
        // Rethrow the error to ensure it's caught by the calling function's catch block
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
                'Content-Length': dataString.length
            }
        };

        const req = https.request(url, options, (res) => {
            let response = '';

            res.on('data', (chunk) => {
                response += chunk;
            });

            res.on('end', () => {
                resolve(JSON.parse(response));
            });
        });

        req.on('error', (e) => {
            reject(e.message);
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
    let totalSkill = 0;
    let userCount = 0;
    let params = {
        TableName: tableName,
        ProjectionExpression: "aggregate_skills_season",
        FilterExpression: "bucket_id = :bucketId",
        ExpressionAttributeValues: { ":bucketId": bucketId },
    };

    try {
        let scanResponse;
        do {
            scanResponse = await documentClient.scan(params).promise();
            scanResponse.Items.forEach(item => {
                totalSkill += item.aggregate_skills_season;
                userCount += 1;
            });
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
    };

    let users = [];
    let items;
    do {
        items = await documentClient.scan(params).promise();
        users.push(...items.Items);
        params.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (items.LastEvaluatedKey);

    return users;
}