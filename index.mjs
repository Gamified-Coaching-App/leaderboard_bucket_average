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

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Challenge generation triggered." }),
    };
}

async function prepareAndTriggerChallengeGeneration(event) {
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

// Function to make a POST request API call
async function makeApiCall(url, payload) {
    console.log("makeApiCall triggered");
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


// Function to make a POST request API call
async function fetchApiData(url, payload) {

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: payload
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const responseData = await response.json();

        return responseData; // Return the response data
    } catch (error) {
        console.error('There was a problem with the request:', error);
        throw error; // Rethrow the error for handling at higher level
    }
}

async function getAllUniqueBuckets(tableName) {
    console.log("getAllUniqueBuckets triggered");
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

async function calculateAverageSkillForBucket(tableName, bucketId) {
    console.log("calculateAverageSkillForBucket triggered");
    // retrieve user_ids from a given bucketID
    const userIds = await getUsersInBucket(tableName, bucketId);
    const userIdsJSON = JSON.stringify({ user_ids: userIds });
    const userCount = userIds.length;
    // console.log(userIdsJSON);
    // console.log(userIds);
    // console.log(typeof userIds);

    const apiUrl = "https://88pqpqlu5f.execute-api.eu-west-2.amazonaws.com/dev_1/3-months-aggregate";

    // return a 3 months aggregate for each user
    const apiResponse = await fetchApiData(apiUrl, userIdsJSON);

    // Extract values and convert them to numbers
    const values = Object.values(apiResponse).map(value => parseInt(value, 10));
    // console.log("Values: ", values);

    // sheck if all values are zeros
    const allZeros = values.every(value => value === 0);

    // If all zeros, return 0, else filter out zeros
    const updatedValues = allZeros ? [0] : values.filter(value => value !== 0);

    // Calculate the average with updated values
    let average = updatedValues.reduce((sum, value) => sum + value, 0) / updatedValues.length; // Use 'let' instead of 'const'

    // Dev stage: return 2500 meters per day if no data for the bucket
    average = average ? average : 2.5; // Now this line will work without error

    console.log("Average:", average);

    return userCount > 0 ? average / calculateDaysInMonths() : 0;
}


async function getUsersInBucket(tableName, bucketId) {
    console.log("getUsersInBucket triggered");
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

function calculateDaysInMonths() {
    let totalDays = 0;
    const now = new Date();
  
    for (let i = 2; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const daysInMonth = (nextMonth - month) / (1000 * 60 * 60 * 24);
      totalDays += daysInMonth;
    }
      
    // console.log("Total days in this month and the two months before:", totalDays);
    return totalDays;
  }
  