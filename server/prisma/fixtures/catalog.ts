/**
 * FICTIONAL TEST DATA — not approved services or prices.
 * Used by the dev seed and the isolated test suite until the real catalog
 * (docs/l1-1-api.md decision D3) is approved. Every row has isFixture = true.
 */
export interface CatalogFixture {
    code: string
    name: string
    description: string
    category: string
    priceMnt: number
    durationMin: number
    requiresReferral: boolean
    questionnaire: string
    sortOrder: number
    isActive?: boolean
}

export const CATALOG_FIXTURES: CatalogFixture[] = [
    {
        code: 'HOME_BASIC_CHECK',
        name: 'Гэрийн ердийн үзлэг (тест)',
        description: 'Даралт, сахар, судасны цохилт, хүчилтөрөгч хэмжих. Туршилтын өгөгдөл, бодит үнэ биш.',
        category: 'HOME_VISIT',
        priceMnt: 45000,
        durationMin: 45,
        requiresReferral: false,
        questionnaire: 'GENERAL_V1',
        sortOrder: 10,
    },
    {
        code: 'HOME_FULL_CHECK',
        name: 'Гэрийн бүрэн үзлэг (тест)',
        description: 'Ердийн үзлэг дээр нэмэлт асуумж, зөвлөгөө. Туршилтын өгөгдөл, бодит үнэ биш.',
        category: 'HOME_VISIT',
        priceMnt: 70000,
        durationMin: 60,
        requiresReferral: false,
        questionnaire: 'GENERAL_V1',
        sortOrder: 20,
    },
    {
        code: 'HOME_IV_THERAPY',
        name: 'Гэрт дусал тавих (тест)',
        description: 'Эмчийн заалтын дагуу. Туршилтын өгөгдөл, бодит үнэ биш.',
        category: 'HOME_PROCEDURE',
        priceMnt: 60000,
        durationMin: 90,
        requiresReferral: true,
        questionnaire: 'GENERAL_V1',
        sortOrder: 30,
    },
    {
        code: 'HOME_INJECTION',
        name: 'Гэрт тариа хийх (тест)',
        description: 'Эмчийн заалтын дагуу. Туршилтын өгөгдөл, бодит үнэ биш.',
        category: 'HOME_PROCEDURE',
        priceMnt: 30000,
        durationMin: 30,
        requiresReferral: true,
        questionnaire: 'GENERAL_V1',
        sortOrder: 40,
    },
    {
        code: 'HOME_WOUND_CARE',
        name: 'Шарх боох (тест)',
        description: 'Туршилтын өгөгдөл, бодит үнэ биш.',
        category: 'HOME_PROCEDURE',
        priceMnt: 35000,
        durationMin: 40,
        requiresReferral: false,
        questionnaire: 'GENERAL_V1',
        sortOrder: 50,
    },
]
