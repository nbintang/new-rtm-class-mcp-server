import { AIJobStatus, AIJobType } from '@prisma/client';
import { DbResolver } from './db.resolver';

describe('DbResolver', () => {
  const validMcqContent = {
    type: 'MCQ' as const,
    generatedAt: '2026-03-11T22:00:00.000Z',
    questions: [
      {
        id: 'q1',
        text: 'Apa ibu kota Indonesia?',
        options: ['Jakarta', 'Bandung', 'Surabaya', 'Medan'],
        answer: 'A' as const,
      },
    ],
  };

  let prisma: {
    aiOutput: { create: jest.Mock };
    aiJob: { update: jest.Mock };
    warn: jest.Mock;
    error: jest.Mock;
  };
  let resolver: DbResolver;

  beforeEach(() => {
    prisma = {
      aiOutput: {
        create: jest.fn().mockResolvedValue({ id: 'output-1' }),
      },
      aiJob: {
        update: jest.fn().mockResolvedValue({ id: 'job-1' }),
      },
      warn: jest.fn(),
      error: jest.fn(),
    };

    resolver = new DbResolver(prisma as never);
  });

  it('saves MCQ output with typed tool', async () => {
    const result = await resolver.saveMcqOutput({
      jobId: '550e8400-e29b-41d4-a716-446655440000',
      materialId: '550e8400-e29b-41d4-a716-446655440001',
      content: validMcqContent,
    });

    expect(prisma.aiOutput.create).toHaveBeenCalledWith({
      data: {
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        materialId: '550e8400-e29b-41d4-a716-446655440001',
        type: AIJobType.MCQ,
        content: validMcqContent,
        isPublished: false,
      },
    });
    const updateCalls = prisma.aiJob.update.mock.calls as Array<[unknown]>;
    const updateArg = updateCalls[0]?.[0] as
      | {
          where: { id: string };
          data: {
            status: AIJobStatus;
            completedAt: Date;
            lastError: null;
          };
        }
      | undefined;

    expect(updateArg).toBeDefined();
    expect(updateArg?.where).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(updateArg?.data.status).toBe(AIJobStatus.succeeded);
    expect(updateArg?.data.completedAt).toBeInstanceOf(Date);
    expect(updateArg?.data.lastError).toBeNull();
    expect(result).toEqual({
      success: true,
      message: 'Successfully saved MCQ output via save_mcq_output',
      outputId: 'output-1',
    });
  });

  it('rejects malformed MCQ content before saving', async () => {
    await expect(
      resolver.saveMcqOutput({
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        materialId: '550e8400-e29b-41d4-a716-446655440001',
        content: {
          ...validMcqContent,
          questions: [
            {
              ...validMcqContent.questions[0],
              options: ['Jakarta', 'Bandung'],
            },
          ],
        },
      }),
    ).rejects.toThrow();

    expect(prisma.aiOutput.create).not.toHaveBeenCalled();
    expect(prisma.aiJob.update).not.toHaveBeenCalled();
  });

  it('routes legacy save_ai_output shim to typed MCQ handler', async () => {
    const result = await resolver.saveAiOutput({
      jobId: '550e8400-e29b-41d4-a716-446655440000',
      materialId: '550e8400-e29b-41d4-a716-446655440001',
      type: 'MCQ',
      content: validMcqContent,
    });

    const createCalls = prisma.aiOutput.create.mock.calls as Array<[unknown]>;
    const createArg = createCalls[0]?.[0] as
      | {
          data: {
            type: AIJobType;
            content: typeof validMcqContent;
          };
        }
      | undefined;

    expect(createArg).toBeDefined();
    expect(createArg?.data.type).toBe(AIJobType.MCQ);
    expect(createArg?.data.content).toEqual(validMcqContent);
    expect(result.success).toBe(true);
  });
});
