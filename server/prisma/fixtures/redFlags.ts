/**
 * PLACEHOLDER red flag questionnaire — NOT approved clinical content.
 * The question texts are deliberately non-clinical placeholders so that the
 * server flow (versioning, completeness, blocking) can be built and tested.
 * Real questions must come from a clinician (docs/l1-1-api.md decision D4).
 * Every row has isFixture = true.
 */
export interface RedFlagQuestionFixture {
  questionnaire: string;
  code: string;
  text: string;
  sortOrder: number;
}

export const RED_FLAG_FIXTURES: RedFlagQuestionFixture[] = [
  {
    questionnaire: "GENERAL_V1",
    code: "TEST_Q1",
    text: "Туршилтын асуулт 1 (эмнэлзүйн бичвэр батлагдаагүй)",
    sortOrder: 10,
  },
  {
    questionnaire: "GENERAL_V1",
    code: "TEST_Q2",
    text: "Туршилтын асуулт 2 (эмнэлзүйн бичвэр батлагдаагүй)",
    sortOrder: 20,
  },
  {
    questionnaire: "GENERAL_V1",
    code: "TEST_Q3",
    text: "Туршилтын асуулт 3 (эмнэлзүйн бичвэр батлагдаагүй)",
    sortOrder: 30,
  },
];

// v2.0 wording, unapproved; separate from the legacy fixture questionnaire.
export const RED_FLAG_V2_FIXTURES: RedFlagQuestionFixture[] = [
  {
    questionnaire: "RF6_A41_V2",
    code: "RF1",
    text: "Цээжээр өвдөж байна уу?",
    sortOrder: 10,
  },
  {
    questionnaire: "RF6_A41_V2",
    code: "RF2",
    text: "Амьсгал давчдаж байна уу?",
    sortOrder: 20,
  },
  {
    questionnaire: "RF6_A41_V2",
    code: "RF3",
    text: "Ухаан алдаж, унасан уу?",
    sortOrder: 30,
  },
  {
    questionnaire: "RF6_A41_V2",
    code: "RF4",
    text: "Идэвхтэй цус алдалт байна уу?",
    sortOrder: 40,
  },
  {
    questionnaire: "RF6_A41_V2",
    code: "RF5",
    text: "Хүнд харшлын шинж (хавдах, тууралт, амьсгаадах) байна уу?",
    sortOrder: 50,
  },
  {
    questionnaire: "RF6_A41_V2",
    code: "RF6",
    text: "Ухаангүй / маш хүнд байдалтай юу?",
    sortOrder: 60,
  },
];
