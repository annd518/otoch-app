/**
 * PLACEHOLDER red flag questionnaire — NOT approved clinical content.
 * The question texts are deliberately non-clinical placeholders so that the
 * server flow (versioning, completeness, blocking) can be built and tested.
 * Real questions must come from a clinician (docs/l1-1-api.md decision D4).
 * Every row has isFixture = true.
 */
export interface RedFlagQuestionFixture {
    questionnaire: string
    code: string
    text: string
    sortOrder: number
}

export const RED_FLAG_FIXTURES: RedFlagQuestionFixture[] = [
    {
        questionnaire: 'GENERAL_V1',
        code: 'TEST_Q1',
        text: 'Туршилтын асуулт 1 (эмнэлзүйн бичвэр батлагдаагүй)',
        sortOrder: 10,
    },
    {
        questionnaire: 'GENERAL_V1',
        code: 'TEST_Q2',
        text: 'Туршилтын асуулт 2 (эмнэлзүйн бичвэр батлагдаагүй)',
        sortOrder: 20,
    },
    {
        questionnaire: 'GENERAL_V1',
        code: 'TEST_Q3',
        text: 'Туршилтын асуулт 3 (эмнэлзүйн бичвэр батлагдаагүй)',
        sortOrder: 30,
    },
]

