import { Resolver, Tool } from '@nestjs-mcp/server';
import { AIJobStatus, AIJobType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import {
  EssayContent,
  essayContentSchema,
  legacyOutputTypeSchema,
  McqContent,
  mcqContentSchema,
  SummaryContent,
  summaryContentSchema,
} from './db.schema';

type TypedSaveParams<TContent> = {
  jobId: string;
  materialId: string;
  content: TContent;
};
type LegacySaveParams = {
  jobId: string;
  materialId: string;
  type: z.infer<typeof legacyOutputTypeSchema>;
  content: unknown;
};

@Resolver()
export class DbResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Tool({
    name: 'save_mcq_output',
    description:
      'Save validated MCQ AI output. Use this only for content shaped as { type: "MCQ", generatedAt, questions[] }.',
    paramsSchema: {
      jobId: z.string().uuid().describe('The ID of the AI job'),
      materialId: z.string().uuid().describe('The ID of the material'),
      content: mcqContentSchema.describe(
        'MCQ content with type=MCQ, generatedAt, and questions[{id,text,options[4],answer}]',
      ),
    },
  })
  async saveMcqOutput(params: TypedSaveParams<McqContent>) {
    return this.saveTypedOutput({
      jobId: params.jobId,
      materialId: params.materialId,
      type: AIJobType.MCQ,
      content: mcqContentSchema.parse(params.content),
      source: 'save_mcq_output',
    });
  }

  @Tool({
    name: 'save_essay_output',
    description:
      'Save validated ESSAY AI output. Use this only for content shaped as { type: "ESSAY", generatedAt, questions[] }.',
    paramsSchema: {
      jobId: z.string().uuid().describe('The ID of the AI job'),
      materialId: z.string().uuid().describe('The ID of the material'),
      content: essayContentSchema.describe(
        'Essay content with type=ESSAY, generatedAt, and questions[{id,text,rubric}]',
      ),
    },
  })
  async saveEssayOutput(params: TypedSaveParams<EssayContent>) {
    return this.saveTypedOutput({
      jobId: params.jobId,
      materialId: params.materialId,
      type: AIJobType.ESSAY,
      content: essayContentSchema.parse(params.content),
      source: 'save_essay_output',
    });
  }

  @Tool({
    name: 'save_summary_output',
    description:
      'Save validated SUMMARY AI output. Use this only for content shaped as { type: "SUMMARY", generatedAt, summary }.',
    paramsSchema: {
      jobId: z.string().uuid().describe('The ID of the AI job'),
      materialId: z.string().uuid().describe('The ID of the material'),
      content: summaryContentSchema.describe(
        'Summary content with type=SUMMARY, generatedAt, and summary',
      ),
    },
  })
  async saveSummaryOutput(params: TypedSaveParams<SummaryContent>) {
    return this.saveTypedOutput({
      jobId: params.jobId,
      materialId: params.materialId,
      type: AIJobType.SUMMARY,
      content: summaryContentSchema.parse(params.content),
      source: 'save_summary_output',
    });
  }

  @Tool({
    name: 'save_ai_output',
    description:
      'Deprecated compatibility shim. Prefer save_mcq_output, save_essay_output, or save_summary_output.',
    paramsSchema: {
      jobId: z.string().uuid().describe('The ID of the AI job'),
      materialId: z.string().uuid().describe('The ID of the material'),
      type: legacyOutputTypeSchema.describe(
        'Legacy output type. Only MCQ, ESSAY, and SUMMARY are supported by this shim.',
      ),
      content: z
        .union([mcqContentSchema, essayContentSchema, summaryContentSchema])
        .describe(
          'Legacy content payload. Shape must match the specified type exactly.',
        ),
    },
  })
  async saveAiOutput(params: LegacySaveParams) {
    this.prisma.warn(
      `Deprecated tool save_ai_output used for type ${params.type}`,
    );

    if (params.type === 'MCQ') {
      return this.saveMcqOutput({
        jobId: params.jobId,
        materialId: params.materialId,
        content: mcqContentSchema.parse(params.content),
      });
    }

    if (params.type === 'ESSAY') {
      return this.saveEssayOutput({
        jobId: params.jobId,
        materialId: params.materialId,
        content: essayContentSchema.parse(params.content),
      });
    }

    if (params.type === 'SUMMARY') {
      return this.saveSummaryOutput({
        jobId: params.jobId,
        materialId: params.materialId,
        content: summaryContentSchema.parse(params.content),
      });
    }

    return {
      success: false,
      message: `Legacy save_ai_output does not support type ${params.type}.`,
    };
  }

  private async saveTypedOutput(params: {
    jobId: string;
    materialId: string;
    type: AIJobType;
    content: McqContent | EssayContent | SummaryContent;
    source: string;
  }) {
    try {
      const output = await this.prisma.aiOutput.create({
        data: {
          jobId: params.jobId,
          materialId: params.materialId,
          type: params.type,
          content: this.toInputJsonValue(params.content),
          isPublished: false,
        },
      });

      await this.prisma.aiJob.update({
        where: { id: params.jobId },
        data: {
          status: AIJobStatus.succeeded,
          completedAt: new Date(),
          lastError: null,
        },
      });

      return {
        success: true,
        message: `Successfully saved ${params.type} output via ${params.source}`,
        outputId: output.id,
      };
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.prisma.error(
        `Failed to save ${params.type} output for job ${params.jobId}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      try {
        await this.prisma.aiJob.update({
          where: { id: params.jobId },
          data: {
            status: AIJobStatus.failed_processing,
            lastError: message,
            completedAt: new Date(),
          },
        });
      } catch (innerError) {
        const innerMessage = this.getErrorMessage(innerError);
        this.prisma.error(
          `Failed to update job status to failed for job ${params.jobId}: ${innerMessage}`,
          innerError instanceof Error ? innerError.stack : undefined,
        );
      }

      return {
        success: false,
        message: `Failed to save ${params.type} output: ${message}`,
      };
    }
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof z.ZodError) {
      return JSON.stringify(error.issues);
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return 'Unknown MCP save error';
  }

  private toInputJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
