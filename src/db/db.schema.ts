import z from "zod";

export  const mcqQuestionSchema = z
  .object({
    id: z.string().trim().min(1).describe('Question identifier'),
    text: z.string().trim().min(1).describe('MCQ prompt text'),
    options: z
      .array(z.string().trim().min(1))
      .length(4)
      .describe('Exactly 4 answer options'),
    answer: z.enum(['A', 'B', 'C', 'D']).describe('Correct option label'),
    points: z.number().optional().describe('Points for this question'),
  })
  .strict();

export const essayQuestionSchema = z
  .object({
    id: z.string().trim().min(1).describe('Question identifier'),
    text: z.string().trim().min(1).describe('Essay prompt text'),
    rubric: z.string().trim().min(1).describe('Short grading rubric'),
    points: z.number().optional().describe('Points for this question'),
  })
  .strict();

 export const mcqContentSchema = z
  .object({
    type: z.literal('MCQ').describe('MCQ content type marker'),
    generatedAt: z
      .string()
      .datetime()
      .describe('ISO datetime when content was generated'),
    questions: z
      .array(mcqQuestionSchema)
      .min(1)
      .max(100)
      .describe('Generated MCQ questions'),
  })
  .strict();

export const essayContentSchema = z
  .object({
    type: z.literal('ESSAY').describe('Essay content type marker'),
    generatedAt: z
      .string()
      .datetime()
      .describe('ISO datetime when content was generated'),
    questions: z
      .array(essayQuestionSchema)
      .min(1)
      .max(100)
      .describe('Generated essay questions'),
  })
  .strict();

 export const summaryContentSchema = z
  .object({
    type: z.literal('SUMMARY').describe('Summary content type marker'),
    generatedAt: z
      .string()
      .datetime()
      .describe('ISO datetime when content was generated'),
    summary: z.string().trim().min(1).describe('Generated summary text'),
  })
  .strict();

export const legacyOutputTypeSchema = z.enum([
  'MCQ',
  'ESSAY',
  'SUMMARY',
  'LKPD',
  'REMEDIAL',
  'DISCUSSION_TOPIC',
]);

export type McqContent = z.infer<typeof mcqContentSchema>;
export type EssayContent = z.infer<typeof essayContentSchema>;
export type SummaryContent = z.infer<typeof summaryContentSchema>;