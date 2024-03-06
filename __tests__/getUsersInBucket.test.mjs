import AWS from 'aws-sdk';
import { getUsersInBucket } from '../utils.mjs';

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

describe('getUsersInBucket function tests', () => {
    const tableName = 'Leaderboard';

    it('should return user IDs for a valid bucket ID', async () => {
        const bucketId = 'bucket1';
        const expectedUserIds = ['user1', 'user2'];
    
        // Set up the DynamoDB mock to return items for the specified bucket
        AWS.scanMock.mockImplementation(() => ({
            promise: jest.fn().mockResolvedValue({ Items: [{ user_id: 'user1' }, { user_id: 'user2' }] }),
        }));
    
        // Call the function
        const result = await getUsersInBucket(tableName, bucketId);
    
        // Assertions
        expect(result).toEqual(expectedUserIds);
        expect(AWS.scanMock).toHaveBeenCalledTimes(1);
    });
    

    it('should return an empty array for a valid bucket ID with no users', async () => {
        const bucketId = 'bucket1';
    
        // Set up the DynamoDB mock to return no items for the specified bucket
        AWS.scanMock.mockImplementation(() => ({
            promise: jest.fn().mockResolvedValue({ Items: [] }),
        }));
    
        // Call the function
        const result = await getUsersInBucket(tableName, bucketId);
    
        // Assertions
        expect(result).toEqual([]);
        expect(AWS.scanMock).toHaveBeenCalledTimes(1);
    });
    
    
    
    it('should return an empty array for an invalid bucket ID', async () => {
        const bucketId = 'invalidBucket';
    
        // Set up the DynamoDB mock, but it shouldn't be called as the bucket ID is invalid
        AWS.scanMock.mockImplementation(() => ({
            promise: jest.fn().mockResolvedValue({ Items: [] }),
        }));
    
        // Call the function
        const result = await getUsersInBucket(tableName, bucketId);
    
        // Assertions
        expect(result).toEqual([]);
        expect(AWS.scanMock).toHaveBeenCalledTimes(1);
    });
    
    
});