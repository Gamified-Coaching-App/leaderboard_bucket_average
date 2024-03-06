import AWS from 'aws-sdk';
import https from 'https';

const documentClient = new AWS.DynamoDB.DocumentClient();

// Function to make a POST request API call
export async function makeApiCall(url, payload) {
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
export async function fetchApiData(url, payload) {

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

export async function getAllUniqueBuckets(tableName) {
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

export async function calculateAverageSkillForBucket(tableName, bucketId) {
    console.log("calculateAverageSkillForBucket triggered");
    // retrieve user_ids from a given bucketID
    const userIds = await getUsersInBucket(tableName, bucketId);
    const userIdsJSON = JSON.stringify({ user_ids: userIds });
    const userCount = userIds.length;

    const apiUrl = "https://88pqpqlu5f.execute-api.eu-west-2.amazonaws.com/dev_1/3-months-aggregate";

    // return a 3 months aggregate for each user
    const apiResponse = await fetchApiData(apiUrl, userIdsJSON);

    // Extract values and convert them to numbers
    const values = Object.values(apiResponse).map(value => parseInt(value, 10));

    // sheck if all values are zeros
    const allZeros = values.every(value => value === 0);

    // If all zeros, return 0, else filter out zeros
    const updatedValues = allZeros ? [0] : values.filter(value => value !== 0);

    // Calculate the average with updated values
    let three_month_agg = updatedValues.reduce((sum, value) => sum + value, 0) / updatedValues.length; 

    let average = three_month_agg / calculateDaysInMonths();

    if (average<=0.1) {
        // Dev stage: return 2500 meters per day if no data for the bucket
        average = 2.5; // Now this line will work without error
        console.log("Default average used is:", average, "for bucket:", bucketId);
    }
    else {
        console.log("Bucket average is:", average, "for bucket:", bucketId);
    }

    return userCount > 0 ? average : 0;
}

export async function getUsersInBucket(tableName, bucketId) {
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