/**
 * Reusable Mongoose mock model factory for vision-service tests.
 * Pattern adapted from user-service test suite.
 */
export function createMockModel() {
  const mockQuery = {
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(null),
  };

  const mockModelFn = jest.fn().mockImplementation((dto) => ({
    ...dto,
    save: jest.fn().mockResolvedValue({ ...dto, _id: 'mock-id' }),
  }));

  Object.assign(mockModelFn, {
    find: jest.fn().mockReturnValue({ ...mockQuery }),
    findOne: jest.fn().mockReturnValue({ ...mockQuery }),
    findById: jest.fn().mockReturnValue({ ...mockQuery }),
    findByIdAndUpdate: jest.fn().mockReturnValue({ ...mockQuery }),
    findByIdAndDelete: jest.fn().mockReturnValue({ ...mockQuery }),
    findOneAndUpdate: jest.fn().mockReturnValue({ ...mockQuery }),
    countDocuments: jest.fn().mockReturnValue({ ...mockQuery }),
    aggregate: jest.fn().mockReturnValue({ ...mockQuery }),
    deleteOne: jest.fn().mockReturnValue({ ...mockQuery }),
  });

  return mockModelFn as any;
}
