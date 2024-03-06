import AWS from 'aws-sdk';
import { getAllUniqueBuckets } from '../utils.mjs';

// Resetting modules to ensure a clean mock state
beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
});

// Mock the entire AWS SDK
jest.mock('aws-sdk', () => {
    const scanMock = jest.fn();
    return {
        DynamoDB: {
            DocumentClient: jest.fn(() => ({
                scan: scanMock
            })),
        },
        // Mock other AWS SDK methods if necessary
        scanMock,
    };
});

describe('getAllUniqueBuckets function tests', () => {
    const tableName = 'Leaderboard';

    it('should return unique buckets', async () => {
        const expectedBuckets = [{ bucket_id: 'bucket1' }, { bucket_id: 'bucket2' }];
        const expectedResults = new Set(['bucket1', 'bucket2']);

        // Set up the promise to resolve with our expected buckets
        AWS.scanMock.mockImplementation(() => ({
            promise: jest.fn().mockResolvedValue({ Items: expectedBuckets }),
        }));

        // Call the function
        const result = await getAllUniqueBuckets(tableName);
        console.log(result);

        // Assertions
        expect(result).toEqual(Array.from(expectedResults));
        expect(AWS.scanMock).toHaveBeenCalledTimes(1);
    });


    it('should return an empty array when DynamoDB scan returns no items', async () => {
        // Set up the promise to resolve with an empty array
        AWS.scanMock.mockImplementation(() => ({
            promise: jest.fn().mockResolvedValue({ Items: [] }),
        }));
    
        // Call the function
        const result = await getAllUniqueBuckets(tableName);
    
        // Assertions
        expect(result).toEqual([]);
        expect(AWS.scanMock).toHaveBeenCalledTimes(1);
    });
    
    
    it('should throw an error when DynamoDB scan fails', async () => {
        // Set up the promise to reject with an error
        const errorMessage = 'DynamoDB scan failed';
        AWS.scanMock.mockImplementation(() => ({
            promise: jest.fn().mockRejectedValue(new Error(errorMessage)),
        }));
    
        // Call the function and expect it to throw an error
        await expect(getAllUniqueBuckets(tableName)).rejects.toThrow(errorMessage);
        expect(AWS.scanMock).toHaveBeenCalledTimes(1);
    });
    
});