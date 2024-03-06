import { handler } from '../index.mjs'; // Adjust the path as necessary
import * as leaderboardUtils from '../utils.mjs';

jest.mock('../utils.mjs', () => ({
  getAllUniqueBuckets: jest.fn(),
  calculateAverageSkillForBucket: jest.fn(),
  getUsersInBucket: jest.fn(),
  makeApiCall: jest.fn(),
}));

describe('handler function tests', () => {
  beforeEach(() => {
    // Reset mock implementations before each test
    leaderboardUtils.getAllUniqueBuckets.mockReset().mockResolvedValue(['bucket1', 'bucket2']);
    leaderboardUtils.calculateAverageSkillForBucket.mockReset().mockResolvedValue(2.5);
    leaderboardUtils.getUsersInBucket.mockReset().mockResolvedValue(['user1', 'user2']);
    leaderboardUtils.makeApiCall.mockReset().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ message: "API call successful." })
    });
  });

  it('successfully triggers challenge generation', async () => {
    const event = {}; // Mock the event object as needed

    const response = await handler(event);

    expect(response).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "Challenge generation triggered." }),
    });

    // Verify that each utility function was called as expected
    expect(leaderboardUtils.getAllUniqueBuckets).toHaveBeenCalled();
    expect(leaderboardUtils.calculateAverageSkillForBucket).toHaveBeenCalled();
    expect(leaderboardUtils.getUsersInBucket).toHaveBeenCalled();
    expect(leaderboardUtils.makeApiCall).toHaveBeenCalled();
  });

  it('returns an error response on failure', async () => {
    // Simulate an error in one of the utility functions
    leaderboardUtils.getAllUniqueBuckets.mockRejectedValue(new Error('Test error'));

    const event = {}; // Mock the event object as needed

    const response = await handler(event);

    expect(response).toEqual({
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to trigger challenge generation due to an internal error.", details: 'Test error' }),
    });
  });
});
